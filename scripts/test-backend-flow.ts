import { prisma } from '../lib/prisma'
import {
  confirmReservation,
  createReservation,
  releaseReservation,
} from '../lib/reservations'

async function main() {
  const product = await prisma.product.create({
    data: {
      name: `Backend Test Product ${Date.now()}`,
      sku: `BACKEND-TEST-${Date.now()}`,
      price: 10,
    },
  })
  const warehouse = await prisma.warehouse.create({
    data: {
      name: `Backend Test Warehouse ${Date.now()}`,
      location: 'Test City',
    },
  })

  await prisma.inventory.create({
    data: {
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 1,
      reserved: 0,
    },
  })

  const [first, second] = await Promise.all([
    createReservation(product.id, warehouse.id, 1),
    createReservation(product.id, warehouse.id, 1),
  ])

  const successes = [first, second].filter((result) => result.success)
  const conflicts = [first, second].filter(
    (result) => !result.success && result.statusCode === 409
  )

  if (successes.length !== 1 || conflicts.length !== 1) {
    throw new Error(
      `Expected exactly one reservation and one 409. Got ${JSON.stringify({
        first,
        second,
      })}`
    )
  }

  const successfulReservation = successes[0]
  if (!successfulReservation?.success) {
    throw new Error('Expected one successful reservation result')
  }

  const reservationId = successfulReservation.data!.id
  const confirmed = await confirmReservation(reservationId)

  if (!confirmed.success) {
    throw new Error(`Confirm failed: ${JSON.stringify(confirmed)}`)
  }

  if (confirmed.data!.status !== 'CONFIRMED') {
    throw new Error(`Confirm failed: ${JSON.stringify(confirmed)}`)
  }

  const inventoryAfterConfirm = await prisma.inventory.findUniqueOrThrow({
    where: {
      productId_warehouseId: {
        productId: product.id,
        warehouseId: warehouse.id,
      },
    },
  })

  if (inventoryAfterConfirm.quantity !== 0 || inventoryAfterConfirm.reserved !== 0) {
    throw new Error(
      `Confirm did not decrement stock correctly: ${JSON.stringify(
        inventoryAfterConfirm
      )}`
    )
  }

  await prisma.inventory.update({
    where: {
      productId_warehouseId: {
        productId: product.id,
        warehouseId: warehouse.id,
      },
    },
    data: {
      quantity: 1,
      reserved: 0,
    },
  })

  const toRelease = await createReservation(product.id, warehouse.id, 1)
  if (!toRelease.success) {
    throw new Error(`Release setup failed: ${JSON.stringify(toRelease)}`)
  }

  const released = await releaseReservation(toRelease.data!.id)
  if (!released.success) {
    throw new Error(`Release failed: ${JSON.stringify(released)}`)
  }

  if (released.data!.status !== 'RELEASED') {
    throw new Error(`Release failed: ${JSON.stringify(released)}`)
  }

  console.log(
    JSON.stringify(
      {
        concurrency: 'one success, one 409',
        confirm: confirmed.data!.status,
        release: released.data!.status,
        productId: product.id,
        warehouseId: warehouse.id,
      },
      null,
      2
    )
  )

  await prisma.reservation.deleteMany({ where: { productId: product.id } })
  await prisma.inventory.deleteMany({ where: { productId: product.id } })
  await prisma.product.delete({ where: { id: product.id } })
  await prisma.warehouse.delete({ where: { id: warehouse.id } })
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
