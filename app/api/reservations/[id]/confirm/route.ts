import { NextRequest, NextResponse } from 'next/server'
import { confirmReservation } from '@/lib/reservations'
import {
  checkIdempotencyKey,
  storeIdempotencyKey,
} from '@/lib/idempotency'

/**
 * POST /api/reservations/:id/confirm
 * Confirm a reservation (payment succeeded)
 * Returns 410 if reservation has expired
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get idempotency key from headers if present (bonus feature)
    const idempotencyKey = request.headers.get('Idempotency-Key') || undefined

    // Check if this request has been processed before
    if (idempotencyKey) {
      const cached = await checkIdempotencyKey(idempotencyKey)
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status })
      }
    }

    // Confirm the reservation
    const result = await confirmReservation(id)

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
      await storeIdempotencyKey(idempotencyKey, 200, successResponse)
    }

    return NextResponse.json(successResponse, { status: 200 })
  } catch (error) {
    console.error('Error confirming reservation:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    )
  }
}
