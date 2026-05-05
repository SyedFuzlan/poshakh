> ⚠️ **ARCHIVED — 2026-04-29**
> Medusa.js has been removed. This plan described fixes to the Medusa checkout and cart flows which no longer exist. Do not act on this document. Current state and next steps are in **PROGRESS.md**.

---

# PLAN.md — Poshakh Full-Stack Completion
**Date:** 2026-04-28  
**Owner:** Engineering Team  
**Status:** EXECUTING

---

## Root Cause Summary

| # | Symptom | Root Cause | File |
|---|---------|-----------|------|
| 1 | Orders never appear in Medusa admin | Stale closure: `finishOrder` captures `shippingOptions=[]` at render time. Razorpay callback fires after React re-renders but uses old closure. `shipping_option_id` is `undefined` → 422. | `checkout/page.tsx` |
| 2 | `[DEV] Simulate Payment` also fails | Same stale closure. `setShippingOptions` schedules a state update; `finishOrder` runs synchronously with old value. | `checkout/page.tsx` |
| 3 | Order appears twice in account history | `finishOrder` calls `addOrder`, then `order-confirmation/page.tsx` calls it again in `useEffect`. | `order-confirmation/page.tsx` |
| 4 | No Medusa order ID on orders | `checkout/complete` returns `order_id` but it's discarded. Local orders have fake `ORD-{ts}` IDs only. | `checkout/page.tsx`, `types/index.ts` |
| 5 | Cart items lost on page refresh | `cart` array is never persisted to localStorage. Only `cartId` survives. | `store/index.ts` |

---

## Phase 1 — Fix Checkout (CRITICAL — blocks all order creation)

**Goal:** A real order appears in Medusa admin after payment.

### Task 1.1 — Fix stale closure: pass `activeShippingOptions` to `finishOrder`
**File:** `frontend/src/app/checkout/page.tsx`

- Change `finishOrder` signature to accept `effectiveShippingOptions?: ShippingOption[]`
- Inside `finishOrder`, use `effectiveShippingOptions ?? shippingOptions` to find the shipping option
- In `handleRazorpay`, pass `activeShippingOptions` to the Razorpay callback so it can forward to `finishOrder`
- In `handleSimulate`, capture fetched shipping options in a local variable and pass to `finishOrder`

### Task 1.2 — Store Medusa order_id
**File:** `frontend/src/types/index.ts`  
Add `medusaOrderId?: string` field to `Order` interface.

**File:** `frontend/src/app/checkout/page.tsx`  
Parse `order_id` from `checkout/complete` response and include it in the order object passed to `addOrder`.

### Task 1.3 — Verify email validation works
The `||` fix (from previous session) should work for phone-only customers (`+91...@poshakh.in` is valid per RFC 5321).
No code change needed — verify during E2E test.

---

## Phase 2 — Fix Order History

### Task 2.1 — Remove double addOrder
**File:** `frontend/src/app/order-confirmation/page.tsx`  
Remove `addOrder(pendingOrder)` from the `useEffect`. `finishOrder` already calls it. Keep `setPendingOrder(null)` to clear transient state.

---

## Phase 3 — Cart Persistence

### Task 3.1 — Persist cart items to localStorage
**File:** `frontend/src/store/index.ts`

- Initialize `cart` from `localStorage.getItem("poshakh_cart")` (parse JSON array, default to `[]`)
- In `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart` mutations: persist updated `cart` to localStorage
- `clearCart` should also remove `localStorage.removeItem("poshakh_cart")` and `localStorage.removeItem("poshakh_cart_id")`
- Items restored from localStorage may have stale `lineItemId` if the Medusa cart expired — set `lineItemId: undefined` on restore so they get re-synced at checkout time

---

## Phase 4 — E2E Verification

### Task 4.1 — Create admin user (if not already done)
```bash
docker compose exec api npx medusa user -e admin@poshakh.com -p Admin123!
```
Admin URL: http://localhost:9000/app

### Task 4.2 — Simulate payment test
- Open http://localhost:3000
- Add 1 product to cart
- Go to checkout, fill address
- Click [DEV] Simulate Payment
- Verify: redirected to /order-confirmation
- Verify: order appears in /account with correct items and shipping address
- Verify: order appears in Medusa admin at http://localhost:9000/app

### Task 4.3 — Confirm no duplicate orders
- Check /account — order should appear exactly once

---

## Phase 5 — Backend Hardening

### Task 5.1 — Webhook handler: complete orphaned orders
**File:** `backend/src/api/webhooks/razorpay/route.ts`

On `payment.captured` event, if `cartId` is found via `rp_order:{orderId}`, trigger `completeCartWorkflow` so Razorpay webhook acts as a fallback if frontend checkout-complete call fails.

This makes the system resilient: even if the browser closes after payment, the webhook completes the order.

---

## Done Signal
- Place simulated order → appears in Medusa admin dashboard with revenue tracked
- Place simulated order → appears exactly once in /account order history with correct Medusa order ID
- Cart items survive page refresh
- Webhook handler logs "cart_id found" and triggers order completion as fallback

---

## Files Changed
| File | Change |
|------|--------|
| `frontend/src/app/checkout/page.tsx` | Fix stale closure, capture order_id |
| `frontend/src/app/order-confirmation/page.tsx` | Remove duplicate addOrder |
| `frontend/src/types/index.ts` | Add medusaOrderId to Order |
| `frontend/src/store/index.ts` | Persist cart to localStorage |
| `backend/src/api/webhooks/razorpay/route.ts` | Complete orphaned orders from webhook |
