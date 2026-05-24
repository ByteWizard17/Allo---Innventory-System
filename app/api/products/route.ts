import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/products
 * Returns all products with available stock per warehouse
 */
export async function GET(_request: NextRequest) {
  try {
    await prisma.$transaction(async (tx) => {
      const expiredReservations = await tx.reservation.findMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          status: 'PENDING',
        },
      })

      for (const reservation of expiredReservations) {
        await tx.$executeRaw`
          UPDATE "Inventory"
          SET "reserved" = GREATEST("reserved" - ${reservation.quantity}, 0), "updatedAt" = NOW()
          WHERE "productId" = ${reservation.productId}
            AND "warehouseId" = ${reservation.warehouseId}
        `

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: 'RELEASED' },
        })
      }
    })

    const products = await prisma.product.findMany({
      include: {
        inventories: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    const formattedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      sku: product.sku,
      warehouses: product.inventories.map((inv) => ({
        warehouseId: inv.warehouse.id,
        warehouseName: inv.warehouse.name,
        location: inv.warehouse.location,
        totalStock: inv.quantity,
        reserved: inv.reserved,
        available: inv.quantity - inv.reserved,
      })),
    }))

    return NextResponse.json(
      {
        success: true,
        data: formattedProducts,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch products',
      },
      { status: 500 }
    )
  }
}
