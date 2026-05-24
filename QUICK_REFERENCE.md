# Quick Reference Guide

Fast lookup for common tasks in the Allo Inventory system.

## Local Development

### First-Time Setup

```bash
npm install
cp .env.example .env
# Edit .env with your local database URL
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

### Start Dev Server

```bash
npm run dev
# Open http://localhost:3000
```

### Run Migrations

```bash
npm run prisma:migrate
```

### Reset Database (Careful!)

```bash
npm run prisma:migrate reset
npm run prisma:seed
```

## API Quick Tests

### Get All Products

```bash
curl http://localhost:3000/api/products | jq
```

### Create Reservation

```bash
PRODUCT_ID="..."
WAREHOUSE_ID="..."

curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT_ID\",
    \"warehouseId\": \"$WAREHOUSE_ID\",
    \"quantity\": 1
  }" | jq
```

### Confirm Reservation

```bash
RES_ID="..."

curl -X POST http://localhost:3000/api/reservations/$RES_ID/confirm \
  -H "Content-Type: application/json" | jq
```

### Release Reservation

```bash
curl -X POST http://localhost:3000/api/reservations/$RES_ID/release \
  -H "Content-Type: application/json" | jq
```

## Common Tasks

### Add New Product Type

1. Update `prisma/schema.prisma` if adding fields
2. Run migration: `npm run prisma:migrate`
3. Update seed: `prisma/seed.ts`
4. Re-seed: `npm run prisma:seed`

### Add New Warehouse

```bash
psql $DATABASE_URL -c "
  INSERT INTO \"Warehouse\" (id, name, location, \"createdAt\", \"updatedAt\")
  VALUES (gen_random_uuid(), 'New Warehouse', 'Location', NOW(), NOW());
"
```

### Adjust Reservation Duration

```typescript
// In lib/reservations.ts
export async function createReservation(...) {
  // Change: 15 * 60 * 1000 to desired milliseconds
  const reservationExpiry = expiresAt ||
    new Date(Date.now() + 15 * 60 * 1000)  // ← Change here
}
```

### Change Cleanup Frequency

```json
// In vercel.json
{
  "crons": [
    {
      "path": "/api/internal/cleanup",
      "schedule": "*/5 * * * *" // ← Change here (cron format)
    }
  ]
}
```

## Debugging

### Check Database Connection

```bash
psql $DATABASE_URL -c "SELECT version();"
```

### View Active Reservations

```bash
psql $DATABASE_URL -c "
  SELECT id, status, \"expiresAt\"
  FROM \"Reservation\"
  WHERE status = 'PENDING';
"
```

### View Stock Levels

```bash
psql $DATABASE_URL -c "
  SELECT p.name, w.name, i.quantity, i.reserved
  FROM \"Inventory\" i
  JOIN \"Product\" p ON i.\"productId\" = p.id
  JOIN \"Warehouse\" w ON i.\"warehouseId\" = w.id;
"
```

### Check for Stuck Locks

```bash
psql $DATABASE_URL -c "
  SELECT * FROM pg_locks
  WHERE NOT granted;
"
```

## Git Workflow

### Make a Change

```bash
git checkout -b feature/my-feature
# Make changes
git add .
git commit -m "Add my feature"
git push origin feature/my-feature
# Create Pull Request on GitHub
```

### Deploy

```bash
git push origin main
# Vercel automatically deploys
# Check status: https://vercel.com/dashboard
```

### Rollback

```bash
git revert HEAD~1
git push origin main
```

## Environment Variables

### Local Development (.env)

```
DATABASE_URL=postgresql://user:pass@localhost:5432/allo_inventory
NEXT_PUBLIC_API_URL=http://localhost:3000
CRON_SECRET=dev-secret-123
```

### Production (Vercel Dashboard)

```
DATABASE_URL=postgresql://...@host.com:5432/db
CRON_SECRET=prod-secret-long-random-string
```

## File Locations

| File                            | Purpose                  |
| ------------------------------- | ------------------------ |
| `lib/reservations.ts`           | Core reservation logic   |
| `lib/idempotency.ts`            | Idempotency key helpers  |
| `app/api/reservations/route.ts` | POST /api/reservations   |
| `app/checkout/[id]/page.tsx`    | Frontend checkout page   |
| `prisma/schema.prisma`          | Database schema          |
| `vercel.json`                   | Vercel deployment config |

## Database Queries

### List All Tables

```bash
psql $DATABASE_URL -c "\dt"
```

### View Table Structure

```bash
psql $DATABASE_URL -c "\d+ \"Inventory\""
```

### Count Records

```bash
psql $DATABASE_URL -c "
  SELECT
    'Product' as table_name, COUNT(*) FROM \"Product\"
  UNION ALL
  SELECT 'Warehouse', COUNT(*) FROM \"Warehouse\"
  UNION ALL
  SELECT 'Inventory', COUNT(*) FROM \"Inventory\"
  UNION ALL
  SELECT 'Reservation', COUNT(*) FROM \"Reservation\";
"
```

### Export Data

```bash
pg_dump $DATABASE_URL > backup.sql
```

### Restore Data

```bash
psql $DATABASE_URL < backup.sql
```

## Testing Commands

### Run Type Check

```bash
npm run type-check
```

### Build Project

```bash
npm run build
```

### Check for Linting Issues

```bash
npm run lint
```

## Performance Monitoring

### Check Slow Queries

```bash
psql $DATABASE_URL -c "
  SELECT query, calls, mean_time, max_time
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;
"
```

### View Table Sizes

```bash
psql $DATABASE_URL -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

## API Response Examples

### 201 - Success

```json
{
  "success": true,
  "data": {
    "id": "clk123...",
    "productId": "prod123...",
    "quantity": 1,
    "status": "PENDING",
    "expiresAt": "2026-05-23T14:20:00Z"
  }
}
```

### 409 - Conflict (Insufficient Stock)

```json
{
  "success": false,
  "error": "INSUFFICIENT_STOCK"
}
```

### 410 - Gone (Reservation Expired)

```json
{
  "success": false,
  "error": "RESERVATION_EXPIRED"
}
```

### 404 - Not Found

```json
{
  "success": false,
  "error": "PRODUCT_NOT_FOUND"
}
```

## Useful Links

- **Documentation**: See README.md
- **Deployment Guide**: See DEPLOYMENT.md
- **Testing Guide**: See TESTING.md
- **Concurrency Details**: See CONCURRENCY.md
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js Docs**: https://nextjs.org/docs

## Support Contacts

- Database Issues: Check Supabase/Neon dashboard
- Deployment Issues: Check Vercel dashboard
- Code Issues: Review code comments and documentation

## Performance Targets

| Metric                 | Target   | Current |
| ---------------------- | -------- | ------- |
| GET /api/products      | < 100ms  | ~50ms   |
| POST /api/reservations | < 200ms  | ~150ms  |
| Concurrent reserves    | > 20/sec | 20+/sec |
| Page load              | < 1s     | ~500ms  |
| Cron execution         | < 5s     | ~2s     |

## Emergency Procedures

### Database Connection Lost

```bash
# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# If provider down, check their status page
# Supabase: https://status.supabase.io
# Neon: https://status.neon.tech
```

### Cron Job Not Running

```bash
# Check Vercel dashboard → Cron Jobs
# Redeploy to trigger:
git push origin main

# Or trigger manually:
curl -X POST https://yourdomain.com/api/internal/cleanup \
  -H "x-cron-secret: $CRON_SECRET"
```

### Out of Memory

```bash
# Check database size
psql $DATABASE_URL -c "SELECT pg_database_size(current_database());"

# Clean up old idempotency keys
npm run prisma:db push -- -- --schema=<path>

# Or manually:
psql $DATABASE_URL -c "
  DELETE FROM \"IdempotencyKey\" WHERE \"expiresAt\" < NOW();
"
```

## Quick Links

- **Codebase**: https://github.com/yourusername/allo-inventory
- **Live App**: https://allo-inventory.vercel.app
- **Database**: Supabase/Neon dashboard
- **Deployment**: Vercel dashboard
