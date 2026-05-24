import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createReservation,
  cleanupExpiredReservations,
} from '@/lib/reservations'
import {
  checkIdempotencyKey,
  storeIdempotencyKey,
} from '@/lib/idempotency'
import { CreateReservationSchema } from '@/lib/schemas'

/**
 * GET /api/reservations
 * List active reservations (debugging/monitoring)
 */
export async function GET(_request: NextRequest) {
  try {
    const reservations = await prisma.reservation.findMany({
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

    return NextResponse.json(
      {
        success: true,
        data: reservations,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch reservations',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reservations
 * Create a new reservation with proper concurrency handling
 * Returns 409 if insufficient stock
 */
export async function POST(request: NextRequest) {
  try {
    // Get idempotency key from headers if present (bonus feature)
    const idempotencyKey = request.headers.get('Idempotency-Key') || undefined

    // Check if this request has been processed before
    if (idempotencyKey) {
      const cached = await checkIdempotencyKey(idempotencyKey)
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status })
      }
    }

    const body = await request.json()

    // Validate input
    const validationResult = CreateReservationSchema.safeParse(body)
    if (!validationResult.success) {
      const errorResponse = {
        success: false,
        error: 'VALIDATION_ERROR',
        details: validationResult.error.errors,
      }

      // Store in idempotency cache if key provided
      if (idempotencyKey) {
        await storeIdempotencyKey(idempotencyKey, 400, errorResponse)
      }

      return NextResponse.json(errorResponse, { status: 400 })
    }

    const { productId, warehouseId, quantity } = validationResult.data

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      const errorResponse = {
        success: false,
        error: 'PRODUCT_NOT_FOUND',
      }

      if (idempotencyKey) {
        await storeIdempotencyKey(idempotencyKey, 404, errorResponse)
      }

      return NextResponse.json(errorResponse, { status: 404 })
    }

    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    })

    if (!warehouse) {
      const errorResponse = {
        success: false,
        error: 'WAREHOUSE_NOT_FOUND',
      }

      if (idempotencyKey) {
        await storeIdempotencyKey(idempotencyKey, 404, errorResponse)
      }

      return NextResponse.json(errorResponse, { status: 404 })
    }

    // Cleanup expired reservations first
    await cleanupExpiredReservations()

    // Create the reservation with concurrency-safe logic
    const result = await createReservation(productId, warehouseId, quantity)

    if (!result.success) {
      const statusCode = result.statusCode || 500
      const errorResponse = {
        success: false,
        error: result.error,
      }

      if (idempotencyKey) {
        await storeIdempotencyKey(idempotencyKey, statusCode, errorResponse)
      }

      return NextResponse.json(errorResponse, { status: statusCode })
    }

    const successResponse = {
      success: true,
      data: result.data,
    }

    // Store successful response in idempotency cache
    if (idempotencyKey) {
      await storeIdempotencyKey(idempotencyKey, 201, successResponse)
    }

    return NextResponse.json(successResponse, { status: 201 })
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    )
  }
}
