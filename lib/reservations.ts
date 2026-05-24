import { prisma } from './prisma'
import type { Prisma } from '@prisma/client'

const RESERVATION_MINUTES = 15

function reservationIncludes() {
  return {
    product: true,
    warehouse: true,
  }
}

/**
 * Creates a reservation with proper concurrency handling.
 * Uses a database transaction to ensure atomicity.
 * Checks available stock (total - reserved) and fails with 409 if insufficient.
 */
export async function createReservation(
  productId: string,
  warehouseId: string,
  quantity: number,
  expiresAt?: Date
) {
  const reservationExpiry =
    expiresAt || new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updatedRows = await tx.$executeRaw`
        UPDATE "Inventory"
        SET "reserved" = "reserved" + ${quantity}, "updatedAt" = NOW()
        WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
          AND ("quantity" - "reserved") >= ${quantity}
      `

      if (updatedRows === 0) {
        const inventory = await tx.inventory.findUnique({
          where: {
            productId_warehouseId: {
              productId,
              warehouseId,
            },
          },
        })

        if (!inventory) {
          throw new Error('INVENTORY_NOT_FOUND')
        }

        throw new Error('INSUFFICIENT_STOCK')
      }

      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          expiresAt: reservationExpiry,
          status: 'PENDING',
        },
        include: reservationIncludes(),
      })

      return reservation
    })

    return { success: true, data: result }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INSUFFICIENT_STOCK') {
        return { success: false, error: 'INSUFFICIENT_STOCK', statusCode: 409 }
      }
      if (error.message === 'INVENTORY_NOT_FOUND') {
        return { success: false, error: 'NOT_FOUND', statusCode: 404 }
      }
    }
    return { success: false, error: 'UNKNOWN_ERROR', statusCode: 500 }
  }
}

/**
 * Confirms a reservation, permanently decrementing the stock.
 * Returns 410 if reservation has expired.
 */
export async function confirmReservation(reservationId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: reservationIncludes(),
      })

      if (!reservation) {
        throw new Error('RESERVATION_NOT_FOUND')
      }

      if (reservation.status === 'CONFIRMED') {
        return reservation
      }

      if (reservation.status === 'RELEASED') {
        throw new Error('INVALID_STATUS')
      }

      if (reservation.expiresAt < new Date()) {
        await releaseInventoryHold(
          tx,
          reservation.productId,
          reservation.warehouseId,
          reservation.quantity
        )
        await tx.reservation.update({
          where: { id: reservationId },
          data: { status: 'RELEASED' },
        })
        throw new Error('RESERVATION_EXPIRED')
      }

      const updatedRows = await tx.$executeRaw`
        UPDATE "Inventory"
        SET
          "quantity" = "quantity" - ${reservation.quantity},
          "reserved" = "reserved" - ${reservation.quantity},
          "updatedAt" = NOW()
        WHERE "productId" = ${reservation.productId}
          AND "warehouseId" = ${reservation.warehouseId}
          AND "reserved" >= ${reservation.quantity}
          AND "quantity" >= ${reservation.quantity}
      `

      if (updatedRows === 0) {
        throw new Error('INVENTORY_STATE_CONFLICT')
      }

      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'CONFIRMED' },
        include: reservationIncludes(),
      })

      return updated
    })

    return { success: true, data: result }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'RESERVATION_NOT_FOUND') {
        return { success: false, error: 'NOT_FOUND', statusCode: 404 }
      }
      if (error.message === 'RESERVATION_EXPIRED') {
        return { success: false, error: 'RESERVATION_EXPIRED', statusCode: 410 }
      }
      if (error.message === 'INVALID_STATUS') {
        return { success: false, error: 'INVALID_STATUS', statusCode: 400 }
      }
      if (error.message === 'INVENTORY_STATE_CONFLICT') {
        return { success: false, error: 'INVENTORY_STATE_CONFLICT', statusCode: 409 }
      }
    }
    return { success: false, error: 'UNKNOWN_ERROR', statusCode: 500 }
  }
}

/**
 * Releases a reservation, freeing up the reserved stock.
 */
export async function releaseReservation(reservationId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: reservationIncludes(),
      })

      if (!reservation) {
        throw new Error('RESERVATION_NOT_FOUND')
      }

      if (reservation.status === 'RELEASED') {
        return reservation
      }

      if (reservation.status === 'CONFIRMED') {
        throw new Error('INVALID_STATUS')
      }

      await releaseInventoryHold(
        tx,
        reservation.productId,
        reservation.warehouseId,
        reservation.quantity
      )

      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'RELEASED' },
        include: reservationIncludes(),
      })

      return updated
    })

    return { success: true, data: result }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'RESERVATION_NOT_FOUND') {
        return { success: false, error: 'NOT_FOUND', statusCode: 404 }
      }
      if (error.message === 'INVALID_STATUS') {
        return { success: false, error: 'INVALID_STATUS', statusCode: 400 }
      }
    }
    return { success: false, error: 'UNKNOWN_ERROR', statusCode: 500 }
  }
}

/**
 * Gets all active (non-expired) reservations.
 */
export async function getActiveReservations() {
  return prisma.reservation.findMany({
    where: {
      expiresAt: {
        gt: new Date(),
      },
      status: 'PENDING',
    },
    include: {
      product: true,
      warehouse: true,
    },
  })
}

async function releaseInventoryHold(
  tx: Prisma.TransactionClient,
  productId: string,
  warehouseId: string,
  quantity: number
) {
  await tx.$executeRaw`
    UPDATE "Inventory"
    SET "reserved" = GREATEST("reserved" - ${quantity}, 0), "updatedAt" = NOW()
    WHERE "productId" = ${productId}
      AND "warehouseId" = ${warehouseId}
  `
}

/**
 * Cleans up expired reservations and returns reserved stock.
 * Should be called periodically (via cron job or background worker).
 */
export async function cleanupExpiredReservations() {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find all expired pending reservations
      const expiredReservations = await tx.reservation.findMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          status: 'PENDING',
        },
      })

      // Release each expired reservation
      for (const reservation of expiredReservations) {
        await releaseInventoryHold(
          tx,
          reservation.productId,
          reservation.warehouseId,
          reservation.quantity
        )

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: 'RELEASED' },
        })
      }

      return { count: expiredReservations.length }
    })

    return result
  } catch (error) {
    console.error('Error cleaning up expired reservations:', error)
    throw error
  }
}
