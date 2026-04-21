# Codebase Concerns

**Analysis Date:** 2026-04-22

---

## CRITICAL

---

### Order History Lost on Page Refresh

- **Issue:** Orders are stored exclusively in Zustand in-memory state (`orders: Order[]`). There is no `persist` middleware applied to the store, no localStorage persistence, and no API fetch of real order history from Medusa. When the user refreshes the browser or closes the tab, all order history is gone.
- **Files:** `frontend/src/store/index.ts` (line 29–30), `frontend/src/app/account/page.tsx` (line 10)
- **Impact:** Users see "You haven't placed any orders yet" after every refresh. Order history is entirely non-functional in production. The Account page order count display (`ORDERS (N)`) resets to zero on every new session.
- **Fix approach:** Either (a) fetch order history from Medusa backend via `/store/orders?customer_id=X` on account page load, or (b) add Zustand `persist` middleware with localStorage as a short-term stopgap. Approach (a) is correct for production.

---

### Email OTP Delivery Is Not Implemented

- **Issue:** The send-OTP route checks `isPhone` — if the identifier is an email address, it falls through to a `console.log` in dev and does nothing in production. There is no email delivery path.
- **Files:** `backend/src/api/store/auth/send-otp/route.ts` (lines 47–56). Comment on line 51: `"Email OTP delivery can be added here (Resend SDK)"`.
- **Impact:** Any user who tries to sign in or register via email OTP in production receives a `{ success: true }` response but never gets an OTP. This is a silent, invisible failure for the user.
- **Fix approach:** Integrate Resend SDK (`npm install resend`) and send a transactional OTP email. Resend free tier covers 3,000 emails/month.

---

### No OTP Brute-Force Protection on Verify Endpoint

- **Issue:** The verify-OTP route (`backend/src/api/store/auth/verify-otp/route.ts`) has no attempt counter or lockout. An attacker who knows a target phone number can try all 900,000 possible 6-digit combinations within the 10-minute TTL.
- **Files:** `backend/src/api/store/auth/verify-otp/route.ts` (all lines), `backend/src/lib/otp-store.ts`
- **Impact:** The OTP system provides no real second-factor security. Any account reachable by phone number is susceptible to automated enumeration.
- **Fix approach:** Store an attempt counter in Redis alongside the OTP (e.g., `otp_attempts:{identifier}`). After 5 failed attempts, delete the OTP entry and return 429. Also apply rate limiting (matching the send-OTP pattern already in `otp-store.ts`) on the verify path.

---

### Razorpay Key Leaked to Frontend via API Response

- **Issue:** The `create-order` route returns `key_id: process.env.RAZORPAY_KEY_ID` in the JSON response body. While Razorpay key IDs are considered semi-public, the pattern of reading it from the backend response rather than hardcoding it client-side means it is passed through the network unnecessarily. More critically, if `RAZORPAY_KEY_SECRET` is ever accidentally included in a future change to this response, it would be a critical secret leak.
- **Files:** `backend/src/api/store/checkout/create-order/route.ts` (line 25)
- **Impact:** Architectural risk; establishes a habit of returning credentials from the backend. Current key ID exposure is acceptable per Razorpay docs, but the pattern is fragile.
- **Fix approach:** Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` as a frontend environment variable and read it directly in the client. Remove `key_id` from the backend response entirely.

---

### Medusa Order Not Created on Razorpay Payment Failure Recovery

- **Issue:** `finishOrder()` in checkout calls `/store/checkout/complete` in a try/catch that logs a warning and proceeds on failure (line 186: `"Medusa order creation failed (order still saved locally)"`). Payment succeeds in Razorpay but no order record is written to Medusa. The customer has paid but the merchant has no backend record.
- **Files:** `frontend/src/app/checkout/page.tsx` (lines 152–194)
- **Impact:** Silent data loss in production. Merchant can miss fulfillment for paid orders. Customer sees confirmation screen but order is invisible in Medusa Admin.
- **Fix approach:** The Medusa cart-complete call must be mandatory, not best-effort. On failure, route to an error recovery screen, not order confirmation. Alternatively, trigger the Medusa order via a Razorpay webhook (`payment.captured`) on the backend so the frontend never has to handle this.

---

## HIGH

---

### Redis Single Point of Failure — No Fallback

- **Issue:** `getRedisClient()` creates a singleton ioredis client. If Redis is unavailable (connection refused, Upstash down), every OTP send or verify request throws an unhandled exception that propagates as a 500. There is no in-process fallback, no graceful degradation, and no reconnect strategy beyond `maxRetriesPerRequest: 3`.
- **Files:** `backend/src/lib/redis.ts` (all lines), `backend/src/lib/otp-store.ts`
- **Impact:** OTP auth is fully unavailable whenever Redis is unreachable. During Redis cold-start in development, the backend crashes on first OTP request.
- **Fix approach:** Wrap Redis calls in try/catch within `otp-store.ts` and surface a clear user-facing error. For high availability, configure ioredis with `retryStrategy` and add health-check endpoint that verifies Redis connectivity.

---

### No Input Validation on Backend API Routes

- **Issue:** All three checkout routes and both OTP routes accept `req.body as any` without schema validation. There is no Zod, Joi, or any other validator in use. Any shape of payload is accepted and destructured directly.
- **Files:** `backend/src/api/store/checkout/create-order/route.ts` (line 4), `backend/src/api/store/checkout/complete/route.ts` (line 17), `backend/src/api/store/auth/send-otp/route.ts` (line 27–31)
- **Impact:** Malformed payloads can cause runtime errors that surface as 500s. Injection of unexpected types (e.g., object in `identifier`) bypasses the phone regex check and could manipulate Redis key names.
- **Fix approach:** Add Zod validation at the top of each route handler. Medusa v2 supports Zod-based route validation natively.

---

### MSG91 Reliability Risk — No Delivery Confirmation

- **Issue:** The SMS OTP send function checks only HTTP status (line 20: `if (!res.ok)`), not MSG91's response body for delivery status. MSG91 returns `200 OK` even when the message fails to deliver (e.g., invalid DLT template, insufficient balance). There is also no retry logic.
- **Files:** `backend/src/api/store/auth/send-otp/route.ts` (lines 15–23)
- **Impact:** Users may receive `{ success: true }` from the frontend but never get an SMS. No alerting or logging when delivery fails.
- **Fix approach:** Parse MSG91 response body and inspect `type` field (`"success"` vs `"error"`). Log failures. Consider migrating to Twilio Verify which provides true delivery receipts.

---

### No Next.js Route Protection Middleware

- **Issue:** There is no `middleware.ts` at `frontend/src/middleware.ts`. Protected pages (`/account`, `/checkout`) rely only on client-side `useEffect` redirects that execute after the page renders.
- **Files:** `frontend/src/app/account/page.tsx` (lines 14–16), no `frontend/src/middleware.ts`
- **Impact:** Unauthenticated users see a flash of account content before the redirect fires. Bot scrapers and server-side rendering receive full page content for authenticated routes.
- **Fix approach:** Create `frontend/src/middleware.ts` using the Next.js Middleware API to inspect `poshakh_token` cookie and redirect to `/` on missing or invalid token for protected routes.

---

### `DEV_TEST_PHONE` Bypass Could Leak to Production

- **Issue:** The OTP send and verify routes contain a hardcoded bypass: if `DEV_TEST_PHONE` env var is set and the mobile matches, auth is bypassed entirely with a synthetic customer object (lines 12–15 in send route, lines 21–35 in verify route).
- **Files:** `frontend/src/app/api/otp/send/route.ts` (lines 12–15), `frontend/src/app/api/otp/verify/route.ts` (lines 21–35)
- **Impact:** If `DEV_TEST_PHONE` is ever set in a production `.env`, anyone knowing that phone number can log in as any customer without an OTP. There is no guard against this.
- **Fix approach:** Add `if (process.env.NODE_ENV === "production") throw new Error(...)` guard, or remove the bypass entirely and document it as a test-only env variable that must never appear in production config.

---

### Checkout Allows Unauthenticated Users Without Guest Flow

- **Issue:** The checkout page renders fully for unauthenticated users. The email field shows as empty/readonly with a "Sign in for faster checkout" note. The `customer?.email` fallback on line 179 generates `${addr.phone}@poshakh.in` as a synthetic email — this fake email is sent to Medusa as the order email.
- **Files:** `frontend/src/app/checkout/page.tsx` (lines 179, 290–293)
- **Impact:** Medusa receives orders with fake `@poshakh.in` emails that customers never see. Guest users cannot receive order confirmation emails. Data integrity in Medusa customer records is corrupted.
- **Fix approach:** Either enforce authentication before checkout, or implement a true guest checkout flow that captures a real email address from the user.

---

## MEDIUM

---

### Orders State Not Fetched from Medusa — Account Page Is Purely Local

- **Issue:** The account page reads `orders` directly from Zustand (line 10). No API call to Medusa's `/store/orders` endpoint is made. Orders that exist in Medusa (placed in a previous session or on another device) are invisible.
- **Files:** `frontend/src/app/account/page.tsx` (lines 10, 45)
- **Impact:** A customer logging in on a new device sees zero order history. This is a broken user experience for any returning customer.
- **Fix approach:** On account page mount (after `customer` is available), fetch `/store/orders?customer_id={id}` from Medusa and populate the `orders` state.

---

### PIN Code Field Has No Format Validation

- **Issue:** The PIN code input uses `maxLength={6}` but accepts any 6 characters including letters. There is no regex validation to enforce 6-digit Indian postal codes.
- **Files:** `frontend/src/app/checkout/page.tsx` (line 337)
- **Impact:** Invalid PIN codes can be submitted to Medusa and stored against the customer's address.
- **Fix approach:** Add `pattern="[0-9]{6}"` to the input and validate client-side before allowing step progression.

---

### AI Feature Stubs Pollute Production with Console Logs

- **Issue:** Three AI library files (`imageGenerator.ts`, `searchAssistant.ts`, `styleAssistant.ts`) are placeholder stubs that only call `console.log` and return hardcoded values. They exist in production code paths.
- **Files:** `frontend/src/lib/ai/imageGenerator.ts` (line 7), `frontend/src/lib/ai/searchAssistant.ts` (line 8), `frontend/src/lib/ai/styleAssistant.ts` (line 6)
- **Impact:** Console noise in production. Any feature using these stubs silently returns dummy data without the user or developer knowing. The `aiSearch` stub returns results based on simple `.includes()` matching — not actual AI search.
- **Fix approach:** Either implement with real SDKs (Vercel AI SDK, OpenAI) or guard behind a feature flag and throw a `NotImplementedError` so usage is obvious.

---

### Shipping Option Matching Is Fragile String-Based Lookup

- **Issue:** `finishOrder()` finds the shipping option by checking if the Medusa option name `.includes("standard")` or `.includes("express")`. This breaks if the Medusa shipping option names ever change.
- **Files:** `frontend/src/app/checkout/page.tsx` (lines 167–171)
- **Impact:** Wrong shipping option ID could be attached to orders. If no match is found, `shippingOptions[0]` is used as a fallback with no indication this happened.
- **Fix approach:** Expose shipping option IDs as constants that mirror seeded Medusa data, or filter by a deterministic property (e.g., price amount = 0 for free, price amount > 0 for express).

---

### Cart State Not Persisted in Zustand — Lost on Refresh

- **Issue:** The `cart` array in Zustand has no persistence middleware. The `cartId` is loaded from `localStorage` on init (line 53) but the cart item array itself (`cart: []`) resets to empty on every refresh. The UI cart and the Medusa cart diverge.
- **Files:** `frontend/src/store/index.ts` (lines 52–53)
- **Impact:** Users lose their in-memory cart on refresh. They must re-add items. The Medusa cart ID persists in localStorage but the frontend cart display is empty.
- **Fix approach:** Add Zustand `persist` middleware for `cart` and `cartId`, or re-fetch Medusa cart items from `GET /store/carts/{cartId}` on app load using the stored cart ID.

---

### `(window as any).Razorpay` Uses Untyped Global

- **Issue:** Razorpay's browser SDK is dynamically injected via script tag and accessed as `(window as any).Razorpay`. No TypeScript types are used.
- **Files:** `frontend/src/app/checkout/page.tsx` (lines 210, 223)
- **Impact:** No type safety on Razorpay configuration object. Runtime errors in the payment handler (e.g., misspelled callback key) will not be caught at compile time.
- **Fix approach:** Install `@types/razorpay` or define a local interface for the Razorpay constructor and handler response shape.

---

### `(pc as any)` and `req.body as any` in Checkout Backend

- **Issue:** The complete-order route uses `as any` casts on the payment collection result and the entire request body.
- **Files:** `backend/src/api/store/checkout/complete/route.ts` (lines 17, 65, 68, 77)
- **Impact:** Type errors in Medusa's workflow output shape will not be caught at compile time. Regressions in Medusa v2 updates that change workflow result shapes will surface only at runtime.
- **Fix approach:** Import and use the proper Medusa workflow result types. Define a typed interface for the expected request body.

---

### No Confirmation Email to Customer After Order

- **Issue:** After a successful order, the confirmation page displays a payment ID and informs the customer that "Our team will reach out via WhatsApp within 24 hours." No automated email confirmation is sent.
- **Files:** `frontend/src/app/order-confirmation/page.tsx` (line 39)
- **Impact:** Manual fulfilment process is not scalable. If the WhatsApp follow-up doesn't happen, the customer has no record of their order beyond the browser session.
- **Fix approach:** Implement a Medusa subscriber on `order.placed` event that sends a transactional order confirmation email via Resend.

---

### `medusa.ts` SDK Instance Is Unused

- **Issue:** `frontend/src/lib/medusa.ts` exports a configured `@medusajs/js-sdk` client instance, but all API calls in the codebase use raw `fetch()` directly against `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.
- **Files:** `frontend/src/lib/medusa.ts`, `frontend/src/lib/cart.ts`, `frontend/src/lib/products.ts`, `frontend/src/app/checkout/page.tsx`
- **Impact:** Two parallel API integration approaches exist. The SDK provides type safety and auth token handling that the raw fetch calls lack. Maintenance burden doubles when either approach is updated.
- **Fix approach:** Standardize all Medusa API calls through the JS SDK instance. Remove raw `fetch` calls to the Medusa backend.

---

## LOW

---

### Only One Integration Test — Health Check Only

- **Issue:** The entire test suite consists of a single test that pings `/health`. There are no unit tests, no component tests, and no integration tests for OTP auth, checkout, or payment flows.
- **Files:** `backend/integration-tests/http/health.spec.ts`
- **Impact:** Any regression in OTP, checkout, or payment will only be detected in production. The "run tests before commit" policy in CLAUDE.md cannot be meaningfully enforced.
- **Fix approach:** Add integration tests for: OTP send/verify cycle, Razorpay order creation, cart-complete workflow, and verify-payment signature check. Add frontend component tests for checkout step progression.

---

### `next.config.ts` Allows All HTTPS Image Domains

- **Issue:** `remotePatterns` includes `{ protocol: "https", hostname: "**" }` which permits Next.js Image Optimization to proxy images from any HTTPS host on the internet.
- **Files:** `frontend/next.config.ts` (lines 14–17)
- **Impact:** The image optimization endpoint can be abused as an open proxy. Attackers can trigger image fetches to arbitrary external hosts through the Next.js server.
- **Fix approach:** Restrict to specific hostnames used in production (e.g., Cloudinary CDN domain, Supabase storage domain, Medusa upload domain).

---

### Static Product Fallback Contains Real Pricing

- **Issue:** `products.ts` has a hardcoded `staticProducts` array with real product names and prices. This is used as a fallback when `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` is empty, and also as a permanent fallback on Medusa fetch errors.
- **Files:** `frontend/src/lib/products.ts` (lines 62–108)
- **Impact:** If Medusa goes down in production, static products with incorrect/stale prices are shown to users. A customer could add a static product to cart (with a local price) and attempt checkout — cart/order data would be inconsistent.
- **Fix approach:** Show an error state when Medusa is unavailable rather than silently serving stale data. Remove the static fallback from production paths.

---

### No Medusa Webhook Handling for Razorpay Events

- **Issue:** There is no Razorpay webhook endpoint in the backend. Payment state changes (refunds, failed captures, disputes) are not communicated to Medusa.
- **Files:** No webhook route exists in `backend/src/api/`
- **Impact:** Refunds processed in Razorpay dashboard are invisible to Medusa. Disputed payments are not flagged. Order status can diverge from actual payment status.
- **Fix approach:** Implement `POST /store/webhooks/razorpay` endpoint that validates Razorpay webhook signature and updates Medusa order/payment state accordingly.

---

### Session Cookie Has No Expiry Enforcement Server-Side

- **Issue:** The `poshakh_token` cookie is set with `maxAge: 60 * 60 * 24 * 7` (7 days). The `/api/auth/me` route verifies the HMAC signature but does not check an expiry timestamp embedded in the payload. A valid token remains valid indefinitely server-side even if the cookie maxAge has elapsed (e.g., if the cookie is extracted and replayed).
- **Files:** `frontend/src/lib/session.ts`, `frontend/src/app/api/auth/me/route.ts`
- **Impact:** Stolen session tokens do not expire server-side. Low risk currently given the absence of sensitive financial operations in the frontend session, but a concern for production hardening.
- **Fix approach:** Add `expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000` to the signed payload and validate it in `verifySignedCookie`.

---

### No i18n Support Despite Global Product Ambition

- **Issue:** All user-facing strings are hardcoded in English directly in JSX. No i18n library (next-intl, i18next) is installed.
- **Files:** All frontend page and component files
- **Impact:** Not a production blocker today, but retrofitting i18n later requires touching every component. The CLAUDE.md states "Internationalised — use i18n keys, never hardcode display strings" as a production standard — this is currently violated everywhere.
- **Fix approach:** Adopt `next-intl` and migrate UI strings to translation keys. Prioritize checkout and account pages first.

---

*Concerns audit: 2026-04-22*
