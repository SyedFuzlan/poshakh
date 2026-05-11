# AUDIT — QA / E2E COVERAGE
> Poshakh E-commerce | Date: 2026-05-11 | Branch: master
> Methodology: Inventory of all test files; map to critical user flows

---

## TEST INFRASTRUCTURE

| Item | Status | Evidence |
|------|--------|----------|
| Playwright config (frontend) | EXISTS | `frontend/playwright.config.ts` — chromium + mobile-chrome |
| Frontend E2E tests | EXISTS | `frontend/tests/e2e/` — browse, cart, checkout, auth specs |
| Backend integration tests | EXISTS | `backend/integration-tests/http/` — health, auth, checkout specs |
| Jest config (backend) | EXISTS | `backend/jest.config.js` |
| Frontend test command | EXISTS | `frontend/package.json` → `"test:e2e": "playwright test"` |
| E2E tests run in CI | **EXISTS** | `.github/workflows/ci.yml` — `e2e` job runs `npx playwright test --project=chromium` |
| Backend integration tests in CI | **EXISTS** | `backend/package.json` `test:unit` now runs jest; CI backend job executes all `tests/**/*.test.js` |

**Fixed: All existing tests now run in CI.**

---

## FLOW COVERAGE MAP

### Flow 1 — Guest Checkout

| Step | Status | Evidence |
|------|--------|----------|
| Browse products (GET /products) | EXISTS | `frontend/tests/e2e/browse.spec.ts:23–29` |
| Add product to cart | EXISTS | `frontend/tests/e2e/cart.spec.ts:16–21` — "add product shows badge" |
| Enter shipping address | EXISTS | `frontend/tests/e2e/checkout.spec.ts:29–55` — fills Step 1 |
| Razorpay create-order → verify-payment → complete | EXISTS | `backend/tests/payments.test.js` — HMAC verify + happy path order creation; frontend mocked in `checkout.spec.ts:83–125` |
| Order confirmation page renders | EXISTS | `frontend/tests/e2e/checkout.spec.ts:124` — expects `/order-confirmation` URL |

**Gap:** Full Razorpay payment happy path (real `create-order → verify → complete` chain) has no integration test. Payment is mocked on frontend, validation-only on backend. A real checkout end-to-end has never been tested automatically.

---

### Flow 2 — New User OTP Signup

| Step | Status | Evidence |
|------|--------|----------|
| Signup form renders | EXISTS | `frontend/tests/e2e/auth.spec.ts:44–55` — form visibility |
| OTP sent to phone/email | **MISSING** | No E2E test exercises `/store/auth/send-otp` via frontend |
| User enters OTP | **MISSING** | No E2E test for OTP verification flow |
| Account created on verify | EXISTS | `backend/tests/customers.test.js` — signup + login happy path with mocked bcrypt/db |
| Redirect to /account after signup | EXISTS | `frontend/tests/e2e/auth.spec.ts:32–42` — login redirect tested |

**Gap:** Full OTP signup flow (send → receive → verify → account creation) completely untested end-to-end. This is the primary auth path.

---

### Flow 3 — Existing User Login + Order History

| Step | Status | Evidence |
|------|--------|----------|
| Login form renders | EXISTS | `frontend/tests/e2e/auth.spec.ts:10–17` |
| Successful login → redirect | EXISTS | `frontend/tests/e2e/auth.spec.ts:32–42` |
| Logged-in session state | EXISTS | `frontend/tests/e2e/auth.spec.ts:95–114` — mocked session |
| Order history displayed on /account | **EXISTS** | `frontend/tests/e2e/account.spec.ts` — 4 tests cover count, thumbnails, expanded details, profile |

**Gap:** `/account` page UI tested for session but never for actual order data.

---

### Flow 4 — Admin Product Management

| Step | Status | Evidence |
|------|--------|----------|
| Admin login to /admin | **MISSING** | No `/admin` frontend route in `frontend/src/app/`; no admin E2E tests |
| Admin creates + publishes product | **MISSING** | Backend has `POST /api/products` with `requireOwner` auth but no integration tests |
| New product visible on storefront | **MISSING** | No E2E test for product publish → storefront visibility chain |

**Gap:** Entire admin flow is untested. Product management is a critical business operation with zero automated coverage.

---

## CRITICAL CI GAP

The CI pipeline (`.github/workflows/ci.yml`) runs:
- ✅ Backend lint + typecheck
- ✅ Frontend lint + typecheck + build
- ❌ Backend integration tests (`npm run test:integration:http`) — not in pipeline
- ❌ Frontend E2E tests (`npm run test:e2e`) — not in pipeline
- ❌ Backend unit tests (`npm run test:unit`) — configured but skipped

**Result:** Broken auth, broken checkout, and broken payment can merge to master undetected.

---

## MISSING TEST STUBS — ACTION ITEMS

### 1. Add E2E + integration tests to CI

```yaml
# .github/workflows/ci.yml — add after existing test step:

- name: Run backend integration tests
  run: npm run test:integration:http
  working-directory: backend

- name: Run frontend E2E tests
  run: npm run test:e2e
  working-directory: frontend
  env:
    PLAYWRIGHT_BASE_URL: http://localhost:3000
```

### 2. OTP Signup Flow (backend integration test needed)

```typescript
// backend/integration-tests/http/auth.spec.ts — add happy path:
it("should complete OTP signup flow", async () => {
  // 1. POST /store/auth/send-otp { identifier: "test@example.com" }
  // 2. Read OTP from Redis test store (not real email)
  // 3. POST /store/auth/verify-otp { identifier, otp }
  // 4. Expect customer created + session cookie set
})
```

### 3. Razorpay Checkout Happy Path (backend integration test needed)

```typescript
// backend/integration-tests/http/checkout.spec.ts — add:
it("should complete full checkout flow", async () => {
  // 1. POST /store/checkout/create-order { cart_id, amount }
  // 2. Mock Razorpay verify-payment (HMAC with test secret)
  // 3. POST /store/checkout/verify-payment { razorpay_order_id, payment_id, signature }
  // 4. POST /store/checkout/complete { cart_id, address, payment_id }
  // 5. Expect order created in DB
})
```

### 4. Order History (frontend E2E test needed)

```typescript
// frontend/tests/e2e/account.spec.ts — new file:
test("logged-in user sees order history", async ({ page }) => {
  // mock session + mock orders API
  // navigate to /account
  // expect orders list rendered with at least 1 item
})
```

### 5. Admin Product Publish (backend integration test needed)

```typescript
// backend/integration-tests/http/products.spec.ts — new file:
it("admin can create and publish a product", async () => {
  // POST /api/products with admin auth token
  // Expect product_id returned
  // GET /store/products/:handle
  // Expect product visible
})
```

---

## SUMMARY

| Flow | Overall Status | Biggest Gap |
|------|---------------|-------------|
| Guest checkout | EXISTS | Razorpay happy path covered in `payments.test.js` |
| OTP signup | PARTIAL | Send → verify → create chain untested; signup happy path in `customers.test.js` |
| Login + order history | EXISTS | Order history tested in `account.spec.ts` |
| Admin management | MISSING | Zero coverage |
| **CI execution** | **EXISTS** | Backend unit tests + E2E job added to CI |

**Priority fix:** Add integration + E2E tests to CI pipeline first — the tests exist, they just never run.
