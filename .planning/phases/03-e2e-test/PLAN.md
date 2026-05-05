# PLAN — Phase 03: End-to-End Test

Verify the full customer journey from landing page to order fulfillment.

## Goal
A successful, verified transaction where a customer signs up, adds a product to the cart, completes checkout, and the owner sees the order in the dashboard.

## Context
- **Stack**: Express.js + sql.js (SQLite).
- **Previous Phases**: Phase 01 (Variants) and Phase 02 (Product Edit) are complete.
- **Dependencies**: Razorpay test keys or UPI manual flow must be functional.

---

## Wave 1: Test Environment Setup

### 03-PLAN-01: Create Standalone E2E Test Script
Create a script that performs the following sequence without requiring a browser (API-level E2E).

1. **Signup**: `POST /api/customers` with fresh credentials.
2. **Login**: `POST /api/auth/login` to get JWT.
3. **Verify Profile**: `GET /api/auth/me` to ensure session persistence.
4. **Checkout (COD)**: `POST /api/payments/create-order` with `payment_method: 'cod'`.
   - *Note: Using COD avoids Razorpay modal simulation for initial verification.*
5. **Dashboard Verification**: Owner login → `GET /api/orders` → Verify the new order exists.

**File**: `backend/tests/e2e.js`

---

## Wave 2: Verification

### 03-PLAN-02: Manual Verification (UI)
Perform the same flow through the browser to verify frontend wiring.

1. **Frontend**: Open `localhost:3000`.
2. **Signup**: Create account.
3. **Checkout**: Place a COD order.
4. **Dashboard**: Login as owner at `/dashboard` and verify order status.

---

## Success Criteria
- [ ] Automated script `node backend/tests/e2e.js` passes.
- [ ] Manual order appears in Owner Dashboard stats and list.
- [ ] Stock decrements correctly after checkout.
