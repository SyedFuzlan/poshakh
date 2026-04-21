# Testing Patterns

**Analysis Date:** 2026-04-22

## Test Framework

**Backend Runner:**
- Jest 29 (`jest` package in `backend/devDependencies`)
- Config: `backend/jest.config.js`
- Transformer: `@swc/jest` with SWC TypeScript + decorator support (no Babel)
- Test environment: `node`
- Setup file: `backend/integration-tests/setup.js` (clears MikroORM MetadataStorage)

**Frontend Runner:**
- None configured — no `jest.config.*`, `vitest.config.*`, or `playwright.config.*` found in `frontend/`
- No test dependencies in `frontend/package.json` (no jest, vitest, testing-library, or playwright)

**Backend Run Commands:**
```bash
# Integration tests — HTTP layer (hits running Medusa server)
TEST_TYPE=integration:http npm run test:integration:http

# Integration tests — module layer
TEST_TYPE=integration:modules npm run test:integration:modules

# Unit tests
TEST_TYPE=unit npm run test:unit
```

All backend test commands use `--runInBand` (serial execution) and `--forceExit`.

## Test File Organization

**Backend — Integration HTTP tests:**
- Location: `backend/integration-tests/http/*.spec.ts`
- Currently contains: `backend/integration-tests/http/health.spec.ts` (1 test)

**Backend — Module unit tests:**
- Expected location per `jest.config.js`: `backend/src/modules/*/__tests__/**/*.ts`
- Currently: No test files found in `backend/src/modules/`

**Backend — Unit tests:**
- Expected location per `jest.config.js`: `backend/src/**/__tests__/**/*.unit.spec.ts`
- Currently: No test files found in `backend/src/`

**Frontend:**
- No test files found anywhere in `frontend/src/`

## What Is Tested

**Only passing test in the project:**

```typescript
// backend/integration-tests/http/health.spec.ts
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api }) => {
    describe("Ping", () => {
      it("ping the server health endpoint", async () => {
        const response = await api.get('/health')
        expect(response.status).toEqual(200)
      })
    })
  },
})
```

This is a scaffold test verifying only that the server starts and responds to `/health`. It tests no business logic.

## Testing Gaps — Critical

**Frontend — Zero test coverage:**
- `frontend/src/store/index.ts` — Zustand store with all cart, auth, and order logic is completely untested
- `frontend/src/lib/auth.ts` — OTP send/verify functions are untested
- `frontend/src/lib/cart.ts` — Medusa cart sync functions are untested
- `frontend/src/lib/products.ts` — product fetch, fallback logic, and `mapMedusaProduct` are untested
- `frontend/src/lib/session.ts` — HMAC cookie signing/verification is untested (security-critical)
- `frontend/src/app/api/otp/send/route.ts` — OTP routing logic (including DEV_TEST_PHONE bypass) is untested
- `frontend/src/app/api/auth/` — all auth route handlers are untested
- All React components — zero component tests

**Backend — Near-zero test coverage:**
- `backend/src/api/store/auth/` — custom OTP auth routes are untested
- `backend/src/api/store/checkout/` — checkout flow is untested
- `backend/src/modules/` — all custom modules have no `__tests__` directories
- `backend/src/workflows/` — all custom workflows are untested
- `backend/src/subscribers/` — event subscribers are untested

## Testing Infrastructure

**Backend setup file:**
```javascript
// backend/integration-tests/setup.js
const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")
MetadataStorage.clear()
```

**Backend Jest config type-switching pattern:**
```javascript
// backend/jest.config.js
if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"];
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"];
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"];
}
```

The `TEST_TYPE` env var controls which suite runs — there is no default match pattern, so running `jest` without `TEST_TYPE` will find zero tests.

**Medusa test utility:**
- `@medusajs/test-utils` 2.13.6 provides `medusaIntegrationTestRunner` — wraps test suite setup with a real Medusa app instance and an `api` client for HTTP assertions

## Recommended Testing Approach

**Priority order for new tests:**

**1. Frontend — add Vitest + React Testing Library**
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom
```
Config file: `frontend/vitest.config.ts`

**2. Frontend unit tests — start with security-critical lib functions:**
- `frontend/src/lib/session.ts` — test `createSignedCookie` and `verifySignedCookie` with known inputs/outputs
- `frontend/src/lib/products.ts` — test `mapMedusaProduct` with mocked Medusa API response shapes and fallback behaviour
- `frontend/src/store/index.ts` — test store actions (addToCart, removeFromCart, updateQuantity, updateLineItemId)

**3. Frontend component tests — test critical flows:**
- `frontend/src/components/CartDrawer.tsx` — test item render, quantity change, remove, checkout button
- `frontend/src/components/SessionProvider.tsx` — test session restoration on mount

**4. Backend integration tests — expand HTTP suite:**
- Add specs for `POST /store/auth/send-otp` and `POST /store/auth/verify-otp` to `backend/integration-tests/http/`

**5. Backend unit tests — follow module `__tests__` convention:**
- Place unit specs at `backend/src/modules/<module-name>/__tests__/<name>.unit.spec.ts`

**Mocking approach for frontend (Vitest):**
```typescript
// Mock fetch in lib function tests
vi.stubGlobal('fetch', vi.fn())

// Mock Zustand store in component tests
vi.mock('@/store', () => ({
  useStore: vi.fn(() => ({ cart: [], setCartOpen: vi.fn() }))
}))
```

**Assertion library:** Jest's built-in `expect` on the backend; Vitest's compatible `expect` API on the frontend (same syntax, different import).

## Pre-commit Enforcement

**Currently:** No pre-commit hooks, no Husky, no lint-staged detected.

**Recommended:** Add to `frontend/package.json` scripts per CLAUDE.md:
```bash
npm run test && npm run lint && npm run type-check
```
`type-check` script is not yet defined — add `"type-check": "tsc --noEmit"`.

---

*Testing analysis: 2026-04-22*
