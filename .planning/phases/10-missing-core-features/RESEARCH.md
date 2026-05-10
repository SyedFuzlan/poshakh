# Research: Phase 10 — Missing Core Features

## Objective
Implement soft deletes, return/refund flows, webhook idempotency, and API versioning.

## 1. Soft Deletes
### tables to cover
- `products`, `categories`, `customers`, `product_variants`.
- *Note*: We shouldn't soft delete `orders` usually, but we can add `cancelled_at` which we already have `status='cancelled'`.

### Implementation details
- Add `deleted_at TIMESTAMP` column to target tables.
- Update all `SELECT` queries to include `WHERE deleted_at IS NULL`.
- On `DELETE`, set `deleted_at = NOW()`.
- For `slug` uniqueness: When deleting a product, append `-deleted-${timestamp}` to the slug to free up the original slug for reuse.

## 2. Return & Refund Flow
### steps
1. **Request Return**: Customer calls `POST /api/orders/:id/return`.
    - Status changes to `return_requested`.
    - Reason stored in `order_status_history`.
2. **Admin Approval**: Admin calls `PATCH /api/orders/:id` with `status='returned'`.
3. **Refund Trigger**:
    - If `payment_method='razorpay'`, use `razorpay.payments.refund(paymentId)`.
    - Handle partial refunds? (MVP: Full refund only).
4. **Inventory**: Restock items automatically upon approval.

## 3. Webhook Idempotency
- **Table**: `processed_webhooks (event_id PRIMARY KEY, provider TEXT, created_at TIMESTAMP)`.
- **Logic**: In `POST /api/payments/webhook`, check if `event_id` exists before processing.

## 4. API Versioning
- **Move**: Mount all routes under `/api/v1/...`.
- **Redirects**: Optionally keep `/api/...` as a redirect or deprecation warning.
- **Goal**: `/api/v1/products`, `/api/v1/auth`, etc.
