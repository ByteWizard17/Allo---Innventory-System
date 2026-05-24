# Deployment Guide

This guide covers deploying the Allo Inventory system to production on Vercel with PostgreSQL.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│          Vercel (Frontend + API)                 │
│  - Next.js App Router                            │
│  - API Routes (Serverless Functions)             │
│  - Cron Jobs (Reservation Cleanup)               │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│     PostgreSQL Database (Supabase/Neon)          │
│  - Products                                       │
│  - Warehouses                                     │
│  - Inventory (with stock levels)                 │
│  - Reservations (with expiry tracking)           │
│  - IdempotencyKey (for safe retries)             │
└─────────────────────────────────────────────────┘
```

## Prerequisites

1. **GitHub Account** - For source control
2. **Vercel Account** - Free tier available at https://vercel.com
3. **PostgreSQL Database** - Use one of:
   - [Supabase](https://supabase.io) - Free tier with 500MB storage
   - [Neon](https://neon.tech) - Free tier with shared compute
   - [Railway](https://railway.app) - Free tier with $5 monthly credit
   - [Render](https://render.com) - Free tier with automatic sleep

## Step-by-Step Deployment

### 1. Prepare Your Repository

Create a new GitHub repository:

```bash
git init
git add .
git commit -m "Initial commit: Allo Inventory System"
git branch -M main
git remote add origin https://github.com/yourusername/allo-inventory.git
git push -u origin main
```

### 2. Set Up PostgreSQL Database

#### Option A: Using Supabase (Recommended)

1. Go to https://supabase.io and sign up
2. Create a new project:
   - Name: `allo-inventory`
   - Region: Choose closest to your users
   - Password: Generate strong password (save it!)
3. Go to Project Settings → Database
4. Copy the Connection String (PostgreSQL)
5. Example format: `postgresql://[user]:[password]@[host]:[port]/[database]`

#### Option B: Using Neon

1. Go to https://neon.tech and sign up
2. Create a new project: `allo-inventory`
3. Go to Connection Details → PostgreSQL
4. Copy the connection string

#### Option C: Using Railway

1. Go to https://railway.app and sign up
2. Create new project → Provision PostgreSQL
3. Go to PostgreSQL plugin → Variables
4. Copy `DATABASE_URL`

### 3. Deploy to Vercel

#### Option A: Using Vercel Dashboard (GUI)

1. Go to https://vercel.com/new
2. Select "Import Git Repository"
3. Paste your GitHub repository URL
4. Click "Import"
5. Configure environment variables:
   - Click "Environment Variables"
   - Add `DATABASE_URL` (from your PostgreSQL setup)
   - Add `CRON_SECRET` (generate random string: `openssl rand -hex 32`)
6. Click "Deploy"
7. Wait for deployment to complete (~2-3 minutes)

#### Option B: Using Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Link your project
vercel link

# Set environment variables
vercel env add DATABASE_URL
# Paste your PostgreSQL connection string

vercel env add CRON_SECRET
# Generate and paste: openssl rand -hex 32

# Deploy
vercel --prod
```

### 4. Run Migrations in Production

After deployment, you need to run migrations on the production database:

```bash
# Option A: Using Vercel CLI
vercel env pull
npm run prisma:migrate -- --skip-generate

# Option B: SSH into production
# Or use your database provider's dashboard to run migrations manually

# Option C: Run migrations via Node
DATABASE_URL="your_prod_url" npm run prisma:migrate
```

### 5. Seed Production Database

Populate with initial data:

```bash
DATABASE_URL="your_prod_url" npm run prisma:seed
```

**Output:**

```
Starting database seed...
Created warehouses: { warehouseNY, warehouseLA, warehouseChicago }
Created products: { productLaptop, productMouse, productKeyboard, productMonitor }
Database seed completed successfully!
```

### 6. Verify Deployment

1. Visit your Vercel deployment URL (shown in dashboard)
2. You should see:
   - Product listing page with 4 sample products
   - Each product showing warehouse availability
   - "Proceed to Checkout" button
3. Test the full flow:
   - Click "Proceed to Checkout"
   - Select warehouse and quantity
   - Click "Reserve Items"
   - Timer should start counting down (15 minutes)
   - Click "Confirm Purchase" or "Cancel Reservation"

### 7. Configure Cron Jobs

Vercel Cron is automatically configured via `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/internal/cleanup",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Verify it's working:**

1. Go to Vercel Dashboard → Your Project
2. Click "Cron Jobs" (if available)
3. You should see: `/api/internal/cleanup` running every 5 minutes
4. Check logs for successful cleanup

**Alternative: If Cron not available**

- Manually trigger cleanup: `curl -X POST https://yourapp.vercel.app/api/internal/cleanup -H "x-cron-secret: YOUR_CRON_SECRET"`
- Or use a third-party cron service like Cronitor/EasyCron

### 8. Configure Custom Domain (Optional)

In Vercel Dashboard:

1. Go to Settings → Domains
2. Click "Add"
3. Enter your domain (e.g., inventory.example.com)
4. Follow DNS instructions for your registrar

## Environment Variables

| Variable              | Description                  | Example                               |
| --------------------- | ---------------------------- | ------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `CRON_SECRET`         | Secret token for cron jobs   | `abc123def456...`                     |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL        | `https://inventory.example.com`       |

**Never** commit `.env` file to Git!

## Monitoring & Debugging

### Check Deployment Logs

```bash
vercel logs [project-name]
```

### Check Cron Job Execution

- Vercel Dashboard → Cron Jobs tab
- Look for `/api/internal/cleanup`
- Click to see recent invocations and logs

### Check Database Connection

```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# List tables
psql $DATABASE_URL -c "\dt"

# Check reservation status
psql $DATABASE_URL -c "SELECT * FROM \"Reservation\" WHERE \"expiresAt\" > NOW();"
```

### View Application Logs

```bash
# Real-time logs
vercel logs [project-name] --follow

# Specific function
vercel logs /api/reservations
```

## Troubleshooting

### "Database connection failed"

- ✅ Verify `DATABASE_URL` is set in Vercel dashboard
- ✅ Check PostgreSQL provider allows Vercel IP ranges
- ✅ Test connection locally: `psql $DATABASE_URL -c "SELECT 1;"`

### "Migrations failed"

- ✅ Ensure database exists: `createdb allo_inventory`
- ✅ Run migrations again: `DATABASE_URL="..." npm run prisma:migrate`
- ✅ Check for schema conflicts: `prisma db push --skip-generate`

### "Cron jobs not running"

- ✅ Verify `vercel.json` exists in root
- ✅ Redeploy: `git push` triggers new deployment
- ✅ Check CRON_SECRET is set
- ✅ Review Vercel dashboard for cron status

### "Reservation confirmation fails with 410"

- ✅ Normal! Reservations expire after 15 minutes
- ✅ Create a new reservation and confirm within time window
- ✅ Check if cleanup job is running too aggressively

### "Stock levels show 0 after reservation"

- ✅ Expected! Stock shows available = total - reserved
- ✅ After confirming purchase, stock decrements permanently
- ✅ After cancelling, stock is released back to available

## Performance Optimization

### Database Indexing

Already configured in `schema.prisma`:

```prisma
@@index([status])
@@index([expiresAt])
@@index([sku])
```

These ensure fast queries on:

- Finding expired reservations
- Filtering by status
- Product lookups by SKU

### Caching (Future)

For production with high traffic, consider:

```bash
npm install redis
```

Then cache:

- Product listings (5 minute TTL)
- Warehouse list (1 hour TTL)
- Real-time inventory (volatile, don't cache)

### Database Query Optimization

Use Prisma's built-in query optimization:

```typescript
// Good: Only select fields you need
const products = await prisma.product.findMany({
  select: {
    id: true,
    name: true,
    price: true,
    inventories: {
      select: {
        quantity: true,
        reserved: true,
      },
    },
  },
});

// Bad: Fetches entire relations
const products = await prisma.product.findMany({
  include: { inventories: true },
});
```

## Backup & Disaster Recovery

### Automated Backups

- **Supabase**: Daily backups, 7-day retention (free tier)
- **Neon**: Continuous backups, point-in-time recovery
- **Railway**: Daily backups included
- **Render**: Daily backups included

### Manual Backup

```bash
# Dump database
pg_dump $DATABASE_URL > backup.sql

# Restore database
psql $DATABASE_URL < backup.sql
```

## Scaling Considerations

### Current Limits (Free Tier)

- Database: 10GB storage
- Vercel: 100GB bandwidth/month
- Cron jobs: Limited invocations

### When to Upgrade

- ✅ > 100k products
- ✅ > 1 million reservations/month
- ✅ > 10k concurrent users
- ✅ Need sub-100ms latency

### Upgrade Path

1. PostgreSQL: Upgrade to larger instance
2. Vercel: Upgrade to Pro or Enterprise
3. Add Redis for caching
4. Add CDN (Cloudflare, Vercel Edge)
5. Database read replicas for scaling reads

## CI/CD Pipeline

Automatic testing on every push:

```bash
# GitHub Actions runs:
1. npm install
2. npm run type-check
3. npm run prisma:migrate (on test database)
4. npm run prisma:seed
5. npm run build
6. npm run lint
```

View pipeline: GitHub → Actions tab

## Rollback

If something goes wrong after deployment:

```bash
# Option 1: Redeploy previous version
vercel rollback

# Option 2: Manual rollback
git revert HEAD~1
git push origin main
# Vercel automatically redeploys

# Option 3: Vercel dashboard
# Deployments → Click previous version → "Promote to Production"
```

## Cost Breakdown (Estimate)

| Service       | Free Tier       | Cost/Month |
| ------------- | --------------- | ---------- |
| Vercel        | 100GB bandwidth | $0         |
| Supabase      | 500MB database  | $0-25      |
| Custom Domain | -               | $10-15     |
| **Total**     | -               | **$10-40** |

## Next Steps

1. ✅ Deploy to production
2. ✅ Monitor for errors (first 24 hours)
3. ✅ Test all user flows
4. ✅ Set up error tracking (Sentry)
5. ✅ Configure analytics (Mixpanel, Amplitude)
6. ✅ Set up uptime monitoring (UptimeRobot)
7. ✅ Create runbook for on-call support

## Support & Documentation

- Vercel Docs: https://vercel.com/docs
- Prisma Docs: https://www.prisma.io/docs
- PostgreSQL Docs: https://www.postgresql.org/docs
- Next.js Docs: https://nextjs.org/docs
