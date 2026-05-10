# PLAN: Phase 10 — Missing Core Features

## Wave 1: Data Integrity & Safety

**Goal:** Implement soft deletes and webhook idempotency.

### Task 1.1: Soft Deletes
- [ ] Migration: Add `deleted_at` column to `products`, `categories`, `customers`, `product_variants`.
- [ ] Update `backend/routes/products.js`:
    - Filter `deleted_at IS NULL` in categories and products listing.
    - Update `DELETE /api/products/:id` to set `deleted_at = NOW()` and append suffix to slug.
- [ ] Update `backend/routes/customers.js`: Filter deleted customers.

### Task 1.2: Webhook Idempotency
- [ ] Migration: Create `processed_webhooks` table.
- [ ] Update `backend/routes/payments.js`:
    - Wrap `POST /webhook` logic in a check for existing `event_id`.
    - Insert `event_id` upon successful processing.

---

## Wave 2: Return & Refund Flow

**Goal:** Allow customers to request returns and admins to issue refunds.

### Task 2.1: Return Request API
- [ ] Add `POST /api/orders/:id/return` to `backend/routes/orders.js`.
- [ ] Validate that order status is `delivered`.
- [ ] Update status to `return_requested`.

### Task 2.2: Refund Logic
- [ ] Update `PATCH /api/orders/:id` in `backend/routes/orders.js`:
    - When status changes to `returned`, if `payment_method` is Online, trigger Razorpay refund.
    - Restock inventory (already handled for 'cancelled', reuse logic).

---

## Wave 3: API Versioning

**Goal:** Transition to a versioned API structure.

### Task 3.1: Versioned Routes
- [ ] Update `backend/server.js` to mount routes under `/api/v1`.
- [ ] Update `frontend` environment variables or API client to use the new base URL.
    - *Note*: This requires a coordinated change in the frontend.

---

## Verification Plan

### Manual Tests
1. **Soft Delete**:
   - Delete a product.
   - Verify it's gone from `GET /api/products`.
   - Verify it still exists in the DB with `deleted_at` set.
2. **Refund**:
   - Create a test order and pay via Razorpay.
   - Admin sets status to `returned`.
   - Verify Razorpay dashboard shows refund (or check API response).
3. **Idempotency**:
   - Send the same Razorpay webhook payload twice.
   - Verify the second one is ignored (logged as duplicate).
