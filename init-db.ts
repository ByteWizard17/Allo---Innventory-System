import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function initializeDatabase() {
  console.log('Initializing database tables...')
  
  try {
    // Create tables using raw SQL
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Product" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        sku TEXT UNIQUE NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log('✓ Created Product table')

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Warehouse" (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        location TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log('✓ Created Warehouse table')

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Inventory" (
        id TEXT PRIMARY KEY,
        "productId" TEXT NOT NULL,
        "warehouseId" TEXT NOT NULL,
        quantity INT DEFAULT 0,
        reserved INT DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("productId", "warehouseId"),
        FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE,
        FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"(id) ON DELETE CASCADE
      );
    `)
    console.log('✓ Created Inventory table')

    await prisma.$executeRawUnsafe(`
      CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
    `)
    console.log('✓ Created ReservationStatus enum')

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Reservation" (
        id TEXT PRIMARY KEY,
        "productId" TEXT NOT NULL,
        quantity INT NOT NULL,
        status "ReservationStatus" DEFAULT 'PENDING',
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE
      );
    `)
    console.log('✓ Created Reservation table')

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        "responseStatus" INT NOT NULL,
        "responseBody" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP NOT NULL
      );
    `)
    console.log('✓ Created IdempotencyKey table')

    // Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Product_name_idx" ON "Product"(name);
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Product_sku_idx" ON "Product"(sku);
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Warehouse_name_idx" ON "Warehouse"(name);
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Inventory_productId_idx" ON "Inventory"("productId");
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Inventory_warehouseId_idx" ON "Inventory"("warehouseId");
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Reservation_productId_idx" ON "Reservation"("productId");
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Reservation_status_idx" ON "Reservation"(status);
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Reservation_expiresAt_idx" ON "Reservation"("expiresAt");
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");
    `)

    console.log('✓ Created all indexes')
    console.log('✅ Database initialization complete!')
  } catch (error) {
    if ((error as any).message?.includes('already exists')) {
      console.log('✓ Tables already exist')
    } else {
      console.error('Error initializing database:', error)
      throw error
    }
  } finally {
    await prisma.$disconnect()
  }
}

initializeDatabase().catch((e) => {
  console.error(e)
  process.exit(1)
})
