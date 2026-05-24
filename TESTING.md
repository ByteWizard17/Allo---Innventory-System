# Testing Guide

Comprehensive testing instructions for the Allo Inventory system.

## Quick Start Testing

### 1. Local Setup

```bash
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

### 2. Manual Testing Flow

1. Open http://localhost:3000
2. See 4 products with warehouse stock levels
3. Click "Proceed to Checkout" on any product
4. Select a warehouse and quantity
5. Click "Reserve Items"
6. See 15-minute countdown timer
7. Click "Confirm Purchase" → Success
8. Return to homepage → Stock decreased

## API Testing

### Test 1: List Products with Stock

```bash
curl -X GET http://localhost:3000/api/products | jq
```

**Expected:**

- ✅ 200 OK
- ✅ 4 products in response
- ✅ Each product has warehouses array
- ✅ Each warehouse shows totalStock, reserved, available

### Test 2: List Warehouses

```bash
curl -X GET http://localhost:3000/api/warehouses | jq
```

**Expected:**

- ✅ 200 OK
- ✅ 3 warehouses: NY, LA, Chicago

### Test 3: Create Reservation (Happy Path)

```bash
# Get product and warehouse IDs
PRODUCT=$(curl -s http://localhost:3000/api/products | jq -r '.data[0].id')
WAREHOUSE=$(curl -s http://localhost:3000/api/products | jq -r '.data[0].warehouses[0].warehouseId')

# Create reservation
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT\",
    \"warehouseId\": \"$WAREHOUSE\",
    \"quantity\": 1
  }" | jq
```

**Expected:**

- ✅ 201 Created
- ✅ Response includes reservation id
- ✅ Status is "PENDING"
- ✅ expiresAt is 15 minutes from now

### Test 4: Create Reservation (Insufficient Stock) - 409

```bash
# Create reservation for more units than available
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT\",
    \"warehouseId\": \"$WAREHOUSE\",
    \"quantity\": 1000
  }" | jq
```

**Expected:**

- ✅ 409 Conflict
- ✅ Error: "INSUFFICIENT_STOCK"

### Test 5: Confirm Reservation (Happy Path)

```bash
# Create reservation
RES=$(curl -s -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT\",
    \"warehouseId\": \"$WAREHOUSE\",
    \"quantity\": 1
  }" | jq -r '.data.id')

# Confirm it
curl -X POST http://localhost:3000/api/reservations/$RES/confirm \
  -H "Content-Type: application/json" | jq
```

**Expected:**

- ✅ 200 OK
- ✅ Status changed to "CONFIRMED"
- ✅ Stock permanently decremented

### Test 6: Confirm Reservation (Expired) - 410

```bash
# Create reservation
RES=$(curl -s -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT\",
    \"warehouseId\": \"$WAREHOUSE\",
    \"quantity\": 1
  }" | jq -r '.data.id')

# Set expiration to past (using database directly)
psql $DATABASE_URL -c \
  "UPDATE \"Reservation\" SET \"expiresAt\" = NOW() - INTERVAL '1 minute' WHERE id = '$RES';"

# Try to confirm
curl -X POST http://localhost:3000/api/reservations/$RES/confirm | jq
```

**Expected:**

- ✅ 410 Gone
- ✅ Error: "RESERVATION_EXPIRED"

### Test 7: Release Reservation (Happy Path)

```bash
# Create reservation
RES=$(curl -s -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT\",
    \"warehouseId\": \"$WAREHOUSE\",
    \"quantity\": 1
  }" | jq -r '.data.id')

# Get stock before release
BEFORE=$(curl -s http://localhost:3000/api/products | \
  jq -r '.data[0].warehouses[0].available')

# Release it
curl -X POST http://localhost:3000/api/reservations/$RES/release | jq

# Get stock after release (should be same as before)
AFTER=$(curl -s http://localhost:3000/api/products | \
  jq -r '.data[0].warehouses[0].available')

echo "Before: $BEFORE, After: $AFTER (should be equal)"
```

**Expected:**

- ✅ 200 OK
- ✅ Status changed to "CANCELLED"
- ✅ Available stock increased by 1

## Concurrency Testing (Core Requirement)

### Scenario: Two Customers, One Unit

**Setup:**

1. Create product with exactly 1 unit in warehouse
2. Fire 2 simultaneous requests

**Test:**

```bash
# Adjust seed data first (optional - or use existing)
# We'll use products that have low stock

PRODUCT=$(curl -s http://localhost:3000/api/products | \
  jq -r '.data[] | select(.warehouses[0].available == 1) | .id' | head -1)
WAREHOUSE=$(curl -s http://localhost:3000/api/products | \
  jq -r ".data[] | select(.id == \"$PRODUCT\") | .warehouses[0].warehouseId")

echo "Testing with: Product=$PRODUCT, Warehouse=$WAREHOUSE"

# Fire two simultaneous requests
{
  curl -s -X POST http://localhost:3000/api/reservations \
    -H "Content-Type: application/json" \
    -d "{
      \"productId\": \"$PRODUCT\",
      \"warehouseId\": \"$WAREHOUSE\",
      \"quantity\": 1
    }" | jq '{ status: .status // .error, code: .code // 200 }'
} &

{
  sleep 0.01  # Small delay to ensure concurrent execution
  curl -s -X POST http://localhost:3000/api/reservations \
    -H "Content-Type: application/json" \
    -d "{
      \"productId\": \"$PRODUCT\",
      \"warehouseId\": \"$WAREHOUSE\",
      \"quantity\": 1
    }" | jq '{ status: .status // .error, code: .code // 200 }'
} &

wait
```

**Expected:**

- ✅ One request: 201 Created (success)
- ✅ Other request: 409 Conflict (insufficient stock)
- ❌ NOT both should succeed
- ❌ NOT both should fail

### Stress Test: 10 Concurrent Requests

```bash
# Use GNU parallel or xargs
PRODUCT=$(curl -s http://localhost:3000/api/products | jq -r '.data[0].id')
WAREHOUSE=$(curl -s http://localhost:3000/api/products | \
  jq -r '.data[0].warehouses[0].warehouseId')

# Run 10 concurrent requests
for i in {1..10}; do
  curl -s -X POST http://localhost:3000/api/reservations \
    -H "Content-Type: application/json" \
    -d "{
      \"productId\": \"$PRODUCT\",
      \"warehouseId\": \"$WAREHOUSE\",
      \"quantity\": 1
    }" &
done
wait

# Count results: should see 1+ successes, rest failures
```

**Expected:**

- ✅ Exactly 1 success (201)
- ✅ Rest are 409 Conflict
- ✅ No double-booking

## Idempotency Testing (Bonus Feature)

### Test: Same Request Twice with Idempotency Key

```bash
PRODUCT=$(curl -s http://localhost:3000/api/products | jq -r '.data[0].id')
WAREHOUSE=$(curl -s http://localhost:3000/api/products | \
  jq -r '.data[0].warehouses[0].warehouseId')
KEY="test-key-$(date +%s)"

# First request
echo "=== First Request ==="
RESPONSE1=$(curl -s -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d "{
    \"productId\": \"$PRODUCT\",
    \"warehouseId\": \"$WAREHOUSE\",
    \"quantity\": 1
  }")

RES_ID=$(echo $RESPONSE1 | jq -r '.data.id')
echo $RESPONSE1 | jq

# Second request with same key
echo -e "\n=== Second Request (Should be Identical) ==="
RESPONSE2=$(curl -s -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d "{
    \"productId\": \"$PRODUCT\",
    \"warehouseId\": \"$WAREHOUSE\",
    \"quantity\": 1
  }")

echo $RESPONSE2 | jq

# Compare
if [ "$(echo $RESPONSE1 | jq '.data.id')" = "$(echo $RESPONSE2 | jq '.data.id')" ]; then
  echo "✅ Idempotency working: Same ID returned"
else
  echo "❌ Idempotency failed: Different IDs"
fi

# Check database: should only have 1 reservation
COUNT=$(curl -s http://localhost:3000/api/reservations | jq '.data | length')
echo "Total reservations: $COUNT (should be 1)"
```

**Expected:**

- ✅ Both responses identical (same body, same status)
- ✅ Same reservation ID in both responses
- ✅ Only 1 reservation in database
- ✅ Stock only reserved once

## Expiry & Cleanup Testing

### Test 1: Manual Cleanup Trigger

```bash
# Manually call cleanup endpoint
curl -X POST http://localhost:3000/api/internal/cleanup \
  -H "x-cron-secret: your-secret-key" | jq
```

**Expected:**

- ✅ 200 OK
- ✅ Returns count of cleaned up reservations
- ✅ Returns count of cleaned up idempotency keys

### Test 2: Verify Expired Reservations Are Cleaned

```bash
# Create a reservation
RES=$(curl -s -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT\",
    \"warehouseId\": \"$WAREHOUSE\",
    \"quantity\": 1
  }" | jq -r '.data.id')

# Manually expire it
psql $DATABASE_URL -c \
  "UPDATE \"Reservation\" SET \"expiresAt\" = NOW() - INTERVAL '10 minutes' WHERE id = '$RES';"

# Check it exists as PENDING
psql $DATABASE_URL -c "SELECT id, status, \"expiresAt\" FROM \"Reservation\" WHERE id = '$RES';"

# Run cleanup
curl -s -X POST http://localhost:3000/api/internal/cleanup \
  -H "x-cron-secret: your-secret" | jq

# Check it's now CANCELLED
psql $DATABASE_URL -c "SELECT id, status, \"expiresAt\" FROM \"Reservation\" WHERE id = '$RES';"
```

**Expected:**

- ✅ Before cleanup: status = "PENDING"
- ✅ After cleanup: status = "CANCELLED"
- ✅ Stock returned to available

## Error Handling Testing

### Test: Invalid Product ID

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"invalid-id\",
    \"warehouseId\": \"$WAREHOUSE\",
    \"quantity\": 1
  }" | jq
```

**Expected:**

- ✅ 404 Not Found or 400 Bad Request
- ✅ Clear error message

### Test: Invalid Warehouse ID

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT\",
    \"warehouseId\": \"invalid-warehouse\",
    \"quantity\": 1
  }" | jq
```

**Expected:**

- ✅ 404 Not Found

### Test: Invalid Quantity

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT\",
    \"warehouseId\": \"$WAREHOUSE\",
    \"quantity\": -5
  }" | jq
```

**Expected:**

- ✅ 400 Bad Request
- ✅ Validation error details

## Frontend Testing

### User Flow 1: Happy Path

1. ✅ Homepage loads with products
2. ✅ Stock shows correct available amounts
3. ✅ Click "Proceed to Checkout"
4. ✅ Select warehouse
5. ✅ Enter quantity
6. ✅ "Reserve Items" button works
7. ✅ Countdown timer appears
8. ✅ "Confirm Purchase" succeeds
9. ✅ Redirects to homepage
10. ✅ Product stock decreased

### User Flow 2: Insufficient Stock

1. ✅ Select quantity > available
2. ✅ See error: "Not enough stock"
3. ✅ Can reduce quantity and retry

### User Flow 3: Reservation Expiry

1. ✅ Create reservation
2. ✅ Wait 15 minutes (or manually set in DB)
3. ✅ Timer hits 0:00
4. ✅ "Confirm Purchase" button disabled or shows error
5. ✅ See error: "Reservation expired"

### User Flow 4: Manual Cancellation

1. ✅ Create reservation
2. ✅ Click "Cancel Reservation"
3. ✅ Confirmation dialog appears
4. ✅ After cancellation, back to product page
5. ✅ Stock available again

## Database Integrity Testing

### Verify No Overselling

```bash
# Total stock should >= total reserved across all products
psql $DATABASE_URL -c "
  SELECT
    p.name,
    w.name,
    i.quantity,
    i.reserved,
    (i.quantity - i.reserved) as available,
    CASE
      WHEN i.reserved > i.quantity THEN 'ERROR'
      ELSE 'OK'
    END as status
  FROM \"Inventory\" i
  JOIN \"Product\" p ON i.\"productId\" = p.id
  JOIN \"Warehouse\" w ON i.\"warehouseId\" = w.id
  ORDER BY status DESC;
"
```

**Expected:**

- ✅ All rows show status "OK"
- ✅ reserved <= quantity always
- ✅ available >= 0 always

### Verify Reservation State Machine

```bash
# Reservations should only be in valid states
psql $DATABASE_URL -c "
  SELECT status, COUNT(*) as count
  FROM \"Reservation\"
  GROUP BY status;
"
```

**Expected:**

- ✅ Only status: PENDING, CONFIRMED, CANCELLED
- ✅ No invalid statuses

## Performance Testing

### Measure API Response Times

```bash
# Time a product listing request
time curl -s http://localhost:3000/api/products > /dev/null

# Time a reservation creation
time curl -s -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"...\",\"warehouseId\":\"...\",\"quantity\":1}" > /dev/null
```

**Expected:**

- ✅ GET /api/products < 100ms
- ✅ POST /api/reservations < 200ms (due to transaction)

### Load Testing with Apache Bench

```bash
# Test 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:3000/api/products

# Should see:
# Requests per second > 50
# Failed requests = 0
```

## Test Checklist

- [ ] API returns correct HTTP status codes
- [ ] Concurrency: 2 simultaneous → 1 success, 1 conflict
- [ ] Expired reservations return 410
- [ ] Idempotency: Same request returns same response
- [ ] Database: No overselling possible
- [ ] Frontend: All user flows work
- [ ] Cleanup job runs and expires reservations
- [ ] Error messages visible to users
- [ ] Stock levels accurate everywhere
- [ ] No N+1 query problems

## Debugging Tips

### Enable Database Query Logging

```typescript
// In lib/prisma.ts
export const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});
```

### Check Recent Errors

```bash
vercel logs [project] --grep error
```

### Monitor Stock Changes

```bash
# Watch stock levels change in real-time
watch -n 1 "psql $DATABASE_URL -c \
  \"SELECT p.name, i.quantity, i.reserved FROM \\\"Inventory\\\" i \
   JOIN \\\"Product\\\" p ON i.\\\"productId\\\" = p.id;\""
```

### Check Reservation Timeline

```bash
psql $DATABASE_URL -c "
  SELECT
    id,
    status,
    \"createdAt\",
    \"expiresAt\",
    NOW() - \"expiresAt\" as time_since_expiry
  FROM \"Reservation\"
  ORDER BY \"createdAt\" DESC
  LIMIT 10;
"
```
