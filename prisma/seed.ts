import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Clear existing data (skip if tables don't exist)
  try {
    await prisma.reservation.deleteMany({})
    await prisma.inventory.deleteMany({})
    await prisma.product.deleteMany({})
    await prisma.warehouse.deleteMany({})
    await prisma.idempotencyKey.deleteMany({})
    console.log('Cleared existing data')
  } catch (e) {
    console.log('Tables not yet created - skipping deletion')
  }

  // Create warehouses
  const warehouseNY = await prisma.warehouse.create({
    data: {
      name: 'New York Warehouse',
      location: 'New York, NY',
    },
  })

  const warehouseLA = await prisma.warehouse.create({
    data: {
      name: 'Los Angeles Warehouse',
      location: 'Los Angeles, CA',
    },
  })

  const warehouseChicago = await prisma.warehouse.create({
    data: {
      name: 'Chicago Warehouse',
      location: 'Chicago, IL',
    },
  })

  console.log('Created warehouses:', { warehouseNY, warehouseLA, warehouseChicago })

  const products = [
    {
      name: '4K Ultra HD Monitor',
      description: '27-inch 4K monitor with HDR support',
      price: 399.99,
      sku: 'MONITOR-001',
      stock: [
        { warehouseId: warehouseLA.id, quantity: 25 },
        { warehouseId: warehouseChicago.id, quantity: 35 },
      ],
    },
    {
      name: 'High-Performance Laptop',
      description: 'Latest generation laptop with premium specs',
      price: 1299.99,
      sku: 'LAPTOP-001',
      stock: [
        { warehouseId: warehouseNY.id, quantity: 50 },
        { warehouseId: warehouseLA.id, quantity: 30 },
        { warehouseId: warehouseChicago.id, quantity: 40 },
      ],
    },
    {
      name: 'Mechanical Keyboard',
      description: 'RGB mechanical keyboard with custom switches',
      price: 149.99,
      sku: 'KEYBOARD-001',
      stock: [
        { warehouseId: warehouseNY.id, quantity: 75 },
        { warehouseId: warehouseChicago.id, quantity: 60 },
      ],
    },
    {
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with precision tracking',
      price: 29.99,
      sku: 'MOUSE-001',
      stock: [
        { warehouseId: warehouseNY.id, quantity: 200 },
        { warehouseId: warehouseLA.id, quantity: 150 },
      ],
    },
    {
      name: 'Noise-Cancelling Headphones',
      description: 'Over-ear headphones with adaptive ANC and 40-hour battery life',
      price: 249.99,
      sku: 'HEADPHONE-001',
      stock: [
        { warehouseId: warehouseNY.id, quantity: 42 },
        { warehouseId: warehouseLA.id, quantity: 18 },
        { warehouseId: warehouseChicago.id, quantity: 7 },
      ],
    },
    {
      name: 'USB-C Docking Station',
      description: '12-in-1 dock with dual display output, ethernet, and fast charging',
      price: 119.99,
      sku: 'DOCK-001',
      stock: [
        { warehouseId: warehouseNY.id, quantity: 36 },
        { warehouseId: warehouseLA.id, quantity: 22 },
      ],
    },
    {
      name: 'Smart Fitness Watch',
      description: 'GPS smartwatch with health tracking and water resistance',
      price: 199.99,
      sku: 'WATCH-001',
      stock: [
        { warehouseId: warehouseLA.id, quantity: 55 },
        { warehouseId: warehouseChicago.id, quantity: 28 },
      ],
    },
    {
      name: 'Portable Bluetooth Speaker',
      description: 'Compact waterproof speaker with room-filling sound',
      price: 89.99,
      sku: 'SPEAKER-001',
      stock: [
        { warehouseId: warehouseNY.id, quantity: 95 },
        { warehouseId: warehouseLA.id, quantity: 64 },
        { warehouseId: warehouseChicago.id, quantity: 12 },
      ],
    },
    {
      name: 'Ergonomic Office Chair',
      description: 'Adjustable mesh chair with lumbar support for long workdays',
      price: 299.99,
      sku: 'CHAIR-001',
      stock: [
        { warehouseId: warehouseNY.id, quantity: 14 },
        { warehouseId: warehouseChicago.id, quantity: 9 },
      ],
    },
    {
      name: 'Standing Desk Converter',
      description: 'Desktop riser for quick sit-stand workspace conversion',
      price: 179.99,
      sku: 'DESK-CONV-001',
      stock: [
        { warehouseId: warehouseLA.id, quantity: 11 },
        { warehouseId: warehouseChicago.id, quantity: 4 },
      ],
    },
    {
      name: 'Compact Air Purifier',
      description: 'HEPA air purifier for bedrooms, studios, and small offices',
      price: 139.99,
      sku: 'PURIFIER-001',
      stock: [
        { warehouseId: warehouseNY.id, quantity: 26 },
        { warehouseId: warehouseLA.id, quantity: 3 },
      ],
    },
    {
      name: 'Travel Power Bank',
      description: '20,000mAh power bank with USB-C PD fast charging',
      price: 59.99,
      sku: 'POWERBANK-001',
      stock: [
        { warehouseId: warehouseNY.id, quantity: 120 },
        { warehouseId: warehouseLA.id, quantity: 86 },
        { warehouseId: warehouseChicago.id, quantity: 44 },
      ],
    },
  ]

  for (const productData of products) {
    const product = await prisma.product.create({
      data: {
        name: productData.name,
        description: productData.description,
        price: productData.price,
        sku: productData.sku,
      },
    })

    for (const stock of productData.stock) {
      await prisma.inventory.create({
        data: {
          productId: product.id,
          warehouseId: stock.warehouseId,
          quantity: stock.quantity,
          reserved: 0,
        },
      })
    }
  }

  console.log(`Created ${products.length} products with inventory`)

  console.log('Database seed completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('Disconnected from database')
  })
  .catch(async (e) => {
    console.error('Seed error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
