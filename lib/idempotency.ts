import { prisma } from './prisma'

/**
 * Helper for implementing idempotency.
 * Stores and retrieves responses based on an idempotency key.
 * Keys expire after 24 hours.
 */
export async function checkIdempotencyKey(key: string) {
  if (!key) return null

  const record = await prisma.idempotencyKey.findUnique({
    where: { key },
  })

  if (!record) return null

  // Check if expired
  if (record.expiresAt < new Date()) {
    await prisma.idempotencyKey.delete({ where: { key } })
    return null
  }

  return {
    status: record.responseStatus,
    body: JSON.parse(record.responseBody),
  }
}

export async function storeIdempotencyKey(
  key: string,
  status: number,
  body: unknown
) {
  await prisma.idempotencyKey.upsert({
    where: { key },
    create: {
      key,
      responseStatus: status,
      responseBody: JSON.stringify(body),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
    update: {},
  })
}

/**
 * Cleanup expired idempotency keys (should be run periodically)
 */
export async function cleanupIdempotencyKeys() {
  const result = await prisma.idempotencyKey.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })

  return result
}
