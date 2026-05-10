---
phase: 07-auth-improvements
fixed_at: 2026-05-10T15:22:58Z
review_path: .planning/phases/07-auth-improvements/07-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-05-10T15:22:58Z
**Source review:** .planning/phases/07-auth-improvements/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, CR-02, CR-03, CR-04, WR-01, WR-02, WR-03, WR-06)
- Fixed: 8
- Skipped: 0

Note: WR-04 (auth.js owner JWT) and WR-05 (products.js require inline) were explicitly excluded from scope per task instructions.

---

## Fixed Issues

### CR-01: Refresh Token Rotation Non-Atomic

**Files modified:** `backend/routes/customers.js`
**Commit:** `1280deb`
**Applied fix:** Wrapped the DELETE old token + INSERT new token sequence in a single `db.transaction()` call. Extracted the raw token generation and cookie-setting out of `issueTokenPair` for the refresh handler so both DB writes happen atomically. A crash between writes no longer silently logs out the user.

---

### CR-02: authLimiter Applied to /refresh

**Files modified:** `backend/routes/customers.js`, `backend/server.js`
**Commit:** `33ca437`
**Applied fix:** Added `express-rate-limit` import to `customers.js` and defined a local `authLimiter` (10 req/hr) applied only to `signup`, `login`, `forgot-password`, and `reset-password` route handlers. Added `refreshLimiter` (60 req/15min) in `server.js` and replaced the `authLimiter` on `app.use("/api/customers")` with `refreshLimiter`. The `/refresh`, `/logout`, and `/me` routes are now subject only to the generous limiter.

---

### CR-03: Email Verification Link Uses APP_URL Instead of BACKEND_URL

**Files modified:** `backend/utils/email.js`, `backend/.env.example`, `backend/server.js`
**Commit:** `747f39c`
**Applied fix:** Changed `sendVerificationEmail` to build the link using `BACKEND_URL` (fallback: `http://localhost:9000`) instead of `APP_URL`. The `/api/customers/verify-email` endpoint lives on the backend, not the frontend. Updated `.env.example` to document `BACKEND_URL` with production and dev guidance. Added `BACKEND_URL` to the production env vars check in `server.js`.

---

### CR-04: customer_name Unvalidated in SMS

**Files modified:** `backend/routes/checkouts.js`
**Commit:** `d29ba2f`
**Applied fix:** Added sanitisation before SMS interpolation: strips all characters except letters, spaces, hyphens and apostrophes via regex, then slices `firstName` to 30 characters max. This prevents SMS-injection payloads (newlines, fake fields, phishing URLs) and overlong messages.

---

### WR-01: Multiple Active Password Reset Tokens

**Files modified:** `backend/routes/customers.js`
**Commit:** `8ba7314`
**Applied fix:** Added a `DELETE FROM password_reset_tokens WHERE customer_id = $1` before the `INSERT` in the `/forgot-password` handler. Any unexpired tokens for that customer are invalidated before the new one is issued, enforcing the security invariant that a new reset link invalidates all prior ones.

---

### WR-02: email_verified Set to Integer 1 (Type Mismatch)

**Files modified:** `backend/routes/customers.js`, `backend/migrations/20260510152258-email-verified-boolean.js`, `backend/migrations/sqls/20260510152258-email-verified-boolean-up.sql`, `backend/migrations/sqls/20260510152258-email-verified-boolean-down.sql`
**Commit:** `6535af8`
**Applied fix:** Created a new db-migrate migration (`20260510152258-email-verified-boolean`) that alters the `email_verified` column from `INTEGER DEFAULT 0` to `BOOLEAN DEFAULT FALSE` using `USING (email_verified::boolean)`. Changed the `verify-email` handler to write `true` instead of `1`. Run `db-migrate up` to apply the schema change.

---

### WR-03: runRecoveryTask Token Cleanup Silently Skipped on Error

**Files modified:** `backend/routes/checkouts.js`
**Commit:** `0a9b8c6`
**Applied fix:** Split `runRecoveryTask` into two independent `try/catch` blocks: the first covers the abandoned-cart loop, the second covers the three token-cleanup DELETE statements. An error in the checkout loop (malformed JSON, SMS failure, etc.) no longer prevents the token cleanup from running.

---

### WR-06: times_used Incremented on Checkout Save Not Order Completion

**Files modified:** `backend/routes/checkouts.js`
**Commit:** `6c42553`
**Applied fix:** Removed the `UPDATE promo_codes SET times_used = times_used + 1` block from `POST /api/checkouts` entirely. Added a comment explaining that `times_used` must be incremented in the payments/orders confirmation flow. This prevents abandoned carts and repeated upserts from exhausting promo code usage limits prematurely.

---

## Skipped Issues

None.

---

_Fixed: 2026-05-10T15:22:58Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
