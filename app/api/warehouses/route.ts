import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/warehouses
 * Returns all warehouses
 */
export async function GET(_request: NextRequest) {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: warehouses,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch warehouses',
      },
      { status: 500 }
    )
  }
}
