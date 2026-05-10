# PLAN: Phase 09 — Inventory & Orders

## Wave 1: Stock Reservation

**Goal:** Prevent overselling by holding stock during the payment window.

### Task 1.1: Database Schema Update
- [ ] Create a migration to add `reserved_stock` to `product_variants`.
- [ ] Create `inventory_reservations` table to track specific holds.
    ```sql
    CREATE TABLE inventory_reservations (
      id SERIAL PRIMARY KEY,
      checkout_id TEXT NOT NULL,
      variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ```

### Task 1.2: Reservation Logic in Checkout
- [ ] Update `POST /api/checkouts` (or create `POST /api/checkouts/:id/reserve`) to:
    1. Check if `(stock - reserved_stock) >= requested_qty` for all items.
    2. Atomic increment of `reserved_stock` in `product_variants`.
    3. Insert rows into `inventory_reservations`.
- [ ] Ensure this is wrapped in a DB transaction.

### Task 1.3: Reservation Release (Background Task)
- [ ] Update `runRecoveryTask` in `backend/routes/checkouts.js` to:
    1. Find expired rows in `inventory_reservations`.
    2. For each, decrement `reserved_stock` in `product_variants`.
    3. Delete the expired reservation row.

### Task 1.4: Order Completion Cleanup
- [ ] Update `saveOrder` in `backend/routes/payments.js` to:
    1. Decrement `stock` (already does this).
    2. Decrement `reserved_stock` for the items being purchased.
    3. Delete associated `inventory_reservations`.

---

## Wave 2: Order State Machine

**Goal:** Ensure orders follow a logical lifecycle and prevent illegal state jumps.

### Task 2.1: Transition Validation
- [ ] Define a `VALID_TRANSITIONS` map in `backend/routes/orders.js`.
    ```javascript
    const VALID_TRANSITIONS = {
      'pending': ['paid', 'confirmed', 'cancelled', 'failed'],
      'paid': ['processing', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': [],
      'failed': ['pending'] // maybe allow retry
    };
    ```
- [ ] Update `PATCH /api/orders/:id` to check if `req.body.status` is a valid next state for the current `order.status`.

### Task 2.2: Consistent History Logging
- [ ] Ensure every status change (even auto-updates like Razorpay confirmation) creates a row in `order_status_history`.

---

## Verification Plan

### Automated Tests (Manual verification via API)
1. **Overselling**:
   - Set stock=1, reserved=0.
   - User A initiates checkout (reserve=1).
   - User B attempts checkout (should fail with "Out of Stock").
   - Wait for timeout.
   - User B attempts checkout again (should succeed).
2. **State Machine**:
   - Create order (pending).
   - Attempt to PATCH status to 'delivered' (should fail with 400).
   - Attempt to PATCH status to 'shipped' (should fail with 400).
   - Move to 'paid' -> 'processing' -> 'shipped' -> 'delivered' (should succeed).
