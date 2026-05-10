# Research: Phase 09 — Inventory & Orders

## Objective
Prevent overselling via stock reservation and enforce valid order state transitions.

## 1. Stock Reservation Strategy

### Proposed Mechanism
1.  **Schema Change**: Add `reserved_stock` to `product_variants`.
2.  **Reservation Trigger**: When `POST /api/checkouts` is called (or a new `POST /api/checkouts/reserve` endpoint), we increment `reserved_stock`.
    *   *Correction*: `POST /api/checkouts` is currently used for abandoned cart tracking. It's called as the user fills the form.
    *   *Better approach*: Reserve stock only when the user clicks "Pay Now" or "Place Order".
3.  **Availability Check**: `AVAILABLE = (stock - reserved_stock)`.
4.  **Transitions**:
    *   **Payment Success**: `stock -= qty`, `reserved_stock -= qty`.
    *   **Payment Failure / Timeout**: `reserved_stock -= qty`.
    *   **Order Cancellation**: `stock += qty` (if already deducted).

### Release Mechanism
*   Background task in `routes/checkouts.js` (currently `runRecoveryTask`) can be expanded to check for expired reservations.
*   We'll need a `checkout_reservations` table to track which variants are reserved for which checkout ID, OR include it in `checkouts.items_json` and use `checkouts.updated_at`.
*   A dedicated table `inventory_reservations (id, checkout_id, variant_id, quantity, expires_at)` is cleaner for tracking.

## 2. Order State Machine

### Valid States
*   `pending`: Initial state for all orders.
*   `paid`: Payment confirmed (Razorpay).
*   `confirmed`: COD order accepted by admin.
*   `processing`: Packing.
*   `shipped`: Courier tracking added.
*   ... (as per existing logic)

### Transitions & Guards
*   `pending` -> `paid`: Only via Razorpay webhook/verify.
*   `pending` -> `cancelled`: User or Admin.
*   `paid` -> `shipped`: Admin only (requires courier details).
*   `shipped` -> `delivered`: Admin only.

### REST Implementation
*   `PATCH /api/orders/:id` should validate the transition using a state map.

## 3. Database Schema Updates
1.  `product_variants`: Add `reserved_stock INTEGER DEFAULT 0`.
2.  `inventory_reservations`: New table to track active holds.
    *   `id` SERIAL
    *   `checkout_id` TEXT (link to checkouts)
    *   `variant_id` INTEGER
    *   `quantity` INTEGER
    *   `expires_at` TIMESTAMP
