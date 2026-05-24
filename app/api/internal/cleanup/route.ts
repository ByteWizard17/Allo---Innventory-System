import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredReservations } from '@/lib/reservations'
import { cleanupIdempotencyKeys } from '@/lib/idempotency'

/**
 * Internal API for cleanup tasks
 * Should be called by a cron job or background worker
 * Protect with CRON_SECRET environment variable
 */
export async function POST(request: NextRequest) {
  try {
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
    // x-cron-secret is kept for manual/local calls.
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const xCronSecret = request.headers.get('x-cron-secret')
    const isAuthorized =
      cronSecret &&
      (authHeader === `Bearer ${cronSecret}` || xCronSecret === cronSecret)

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Clean up expired reservations
    const expiredCount = await cleanupExpiredReservations()

    // Clean up expired idempotency keys
    const idempotencyResult = await cleanupIdempotencyKeys()

    return NextResponse.json(
      {
        success: true,
        message: 'Cleanup completed',
        expiredReservations: expiredCount.count,
        expiredIdempotencyKeys: idempotencyResult.count,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Cleanup failed',
      },
      { status: 500 }
    )
  }
}
