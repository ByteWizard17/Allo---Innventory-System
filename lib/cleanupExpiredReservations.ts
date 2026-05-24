import { prisma } from './prisma'

export async function cleanupExpiredReservations() {
  try {
    const result = await prisma.reservation.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        status: 'PENDING',
      },
    })

    console.log(`Cleaned up ${result.count} expired reservations`)
    return result
  } catch (error) {
    console.error('Error cleaning up expired reservations:', error)
    throw error
  }
}
