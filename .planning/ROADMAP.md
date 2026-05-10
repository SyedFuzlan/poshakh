# ROADMAP — Poshakh

**Project:** Poshakh — Indian fashion e-commerce  
**Stack:** Next.js 15 · Express.js · SQLite (sql.js) · Razorpay · Tailwind  
**Source of truth:** `PROGRESS.md` (updated each session)  
**Last imported:** 2026-04-29

---

## Milestone: v1 Production Launch

Move from ~80% functional local app to fully deployed, customer-ready store.

---

## Phase 01 — Product Descriptions & Variants

**Goal:** Products have descriptions and size variants that are stored in the DB, served via API, and shown on the product detail page.

**Status:** complete (2026-04-29)  
**Plans:** 3/3 complete

**Wave 1**
- [x] 01-PLAN-01.md — DB migration: add description column + product_variants table

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-PLAN-02.md — API update: GET /:id with LEFT JOIN variants, POST / variant insert, dashboard form

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-PLAN-03.md — UI update: wire size selector to real variants, OOS states, remove dead Medusa code

**Cross-cutting constraints:**
- `db.prepare().run()/.get()/.all()` pattern required in all backend route tasks
- `product.variants` shape `{ id, size, stock }` produced by Plan 02 and consumed by Plan 03

---

## Phase 02 — Product Update Endpoint

**Goal:** Owner can edit product name, price, description, stock from the dashboard without deleting and re-adding.

**Status:** complete (2026-05-05)  
**Plans:** 2/2 complete

**Wave 1**
- [x] 02-PLAN-01.md — Add `PATCH /api/products/:id` backend endpoint to `backend/routes/products.js`

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-PLAN-02.md — Wire edit modal in owner dashboard (`backend/dashboard/index.html`)

---

## Phase 03 — End-to-End Test

**Goal:** Full verified purchase flow — signup → browse → cart → checkout → order in dashboard.

**Status:** not-started

### Plans

- [ ] 03-01: Sign up test customer, add ₹10 test product to cart, complete checkout (Razorpay test + UPI), verify order appears in `/dashboard`

---

## Phase 04 — Production Deploy

**Goal:** App live on the internet. Real customers can browse and buy.

**Status:** not-started

### Plans

- [ ] 04-01: Set `COOKIE_SECURE=true`, configure `NEXT_PUBLIC_BACKEND_URL` for live server
- [ ] 04-02: Choose hosting (Railway/Render backend, Vercel frontend), deploy both
- [ ] 04-03: Configure Razorpay webhook URL to production endpoint
- [ ] 04-04: Smoke test live URL — signup, cart, checkout

---

---

## Milestone: Security & Stability (Audit Fixes)

Critical security, correctness, and production-readiness fixes surfaced by staff-level backend audit.

---

## Phase 05 — Critical Hotfixes

**Goal:** Fix all deploy-blocking bugs: priceNum typo crashes product creation, requireOwner skips role check, PII logged in error handlers, promo times_used never incremented.

**Status:** complete (2026-05-09)

**Plans:** 4/4 complete

### Wave 1 (parallel)
- [x] 05-PLAN-01.md — Fix priceNum undefined typo (products.js lines 271 and 314)
- [x] 05-PLAN-02.md — Add role guard to requireOwner middleware
- [x] 05-PLAN-03.md — Add promo_code column to checkouts + increment times_used on checkout creation

### Wave 2 (after Wave 1)
- [x] 05-PLAN-04.md — Sanitize PII in all error handlers (logger.js serializers + generic 500 responses across all routes)

---

## Phase 06 — Security Hardening

**Goal:** Hash owner password, timing-safe webhook HMAC, enforce webhook secret, add rate limiting to unprotected routes, payment idempotency keys.

**Status:** complete (2026-05-09)  
**Plans:** 4/4 complete

### Wave 1 (parallel)
- [x] 06-PLAN-01.md — Hash owner password with bcrypt in auth.js; update server.js env validation; document in .env.example
- [x] 06-PLAN-02.md — Razorpay webhook: `crypto.timingSafeEqual` + enforce WEBHOOK_SECRET presence (500 not 200 ignored)
- [x] 06-PLAN-03.md — Add `checkoutLimiter` (20 req/15min) to `/api/checkouts` mount in server.js

### Wave 2 *(blocked on Wave 1 — Plan 02 — completion)*
- [x] 06-PLAN-04.md — Partial UNIQUE INDEX on orders(razorpay_payment_id); 409 on UNIQUE constraint in verify handler

**Cross-cutting constraints:**
- Plans 02 and 04 both modify `backend/routes/payments.js` — Plan 04 must execute after Plan 02
- Plans 01 and 03 both modify `backend/server.js` — different line regions, execute sequentially within Wave 1

---

## Phase 07 — Auth Improvements

**Goal:** Replace 30-day JWT with short-lived access + refresh tokens, add logout endpoint, email verification, password reset.

**Status:** planned (2026-05-10)  
**Plans:** 4 plans in 3 waves

### Wave 1 (parallel — no shared files)
- [ ] 07-01-PLAN.md — DB schema foundation: 3 token tables in db.js, cookie-parser in server.js, RESEND_API_KEY + APP_URL in .env.example
- [ ] 07-02-PLAN.md — Refresh token system: replace signCustomerToken (30d) with signAccessToken (15m) + issueTokenPair helper, update login/signup, add POST /refresh + POST /logout endpoints

### Wave 2 *(blocked on Wave 1 completion)*
- [ ] 07-03-PLAN.md — Email utility (utils/email.js) + email verification: signup transaction wrapping, POST /verify-email endpoint
- [ ] 07-04-PLAN.md — Password reset: POST /forgot-password (anti-enumeration), POST /reset-password (single-use token), runRecoveryTask token cleanup

**Cross-cutting constraints:**
- Plans 01 and 02 target different files (db.js/server.js vs customers.js) — safe to run in parallel
- Plans 03 and 04 both modify customers.js — must run sequentially (Plan 03 before Plan 04) or as a merged execution
- Plan 03 depends on Plan 02 (issueTokenPair, hashToken, generateToken helpers must exist)
- Plan 04 depends on Plan 02 (hashToken, generateToken helpers) and Plan 03 (sendPasswordResetEmail import)

---

## Phase 08 — PostgreSQL Migration

**Goal:** Replace sql.js (SQLite in-memory) with PostgreSQL + pg-pool. Add migration system, indexes, parameterized queries, DB transactions for payment flow.

**Status:** complete (2026-05-10)

### Plans

- [x] 08-01: Install pg, pg-pool; rewrite db.js connection layer
- [x] 08-02: Migrate all CREATE TABLE statements to db-migrate migration files
- [x] 08-03: Add indexes on customers(phone, email), orders(status), products(category)
- [x] 08-04: Wrap payment create+inventory deduction in DB transaction
- [x] 08-05: Fix all dynamic WHERE string concatenations to parameterized queries

---

## Phase 09 — Inventory & Orders

**Goal:** Prevent overselling via stock reservation, enforce valid order state transitions.

**Status:** not-started

### Plans

- [ ] 09-01: Add `reserved_qty` column; reserve stock on order create, release on timeout/fail
- [ ] 09-02: Order state machine — validate transitions (pending→confirmed→processing→shipped→delivered)

---

## Phase 10 — Missing Core Features

**Goal:** Soft deletes, return/refund flow, webhook retry idempotency, API versioning (/api/v1/).

**Status:** planned (2026-05-10)  

### Plans

- [ ] 10-01: Soft deletes — add `deleted_at` to products/orders/customers; filter in all queries
- [ ] 10-02: Return/refund flow — POST /api/orders/:id/return, owner approval, Razorpay refund API
- [ ] 10-03: Webhook idempotency — store processed Razorpay event IDs, skip duplicates
- [ ] 10-04: API versioning — prefix all routes `/api/v1/`

---

## Phase 11 — Observability & DevOps

**Goal:** Request ID correlation, replace console.log with logger, Prometheus metrics, graceful shutdown, Dockerfile, fix .gitignore.

**Status:** not-started

### Plans

- [ ] 11-01: Request ID middleware (crypto.randomUUID), propagate to all log entries
- [ ] 11-02: Replace all console.log/console.error with pino logger
- [ ] 11-03: Add prom-client — http_request_duration, orders_created, stock_level, payment_errors
- [ ] 11-04: Graceful shutdown — drain pending requests, cancel recovery task on SIGTERM
- [ ] 11-05: Multi-stage Dockerfile + GET /health endpoint; add data/ to .gitignore

---

## Phase 12 — Test Suite

**Goal:** 80%+ integration test coverage on payment flow, inventory concurrency, order state machine, auth flows, requireOwner middleware.

**Status:** not-started

### Plans

- [ ] 12-01: Payment flow tests — create-order→verify→webhook, idempotency, bad signature
- [ ] 12-02: Inventory concurrency test — 2 simultaneous orders for qty=1, only one succeeds
- [ ] 12-03: Order state machine tests — all invalid transitions return 400
- [ ] 12-04: Auth flow tests — signup→verify→login→refresh→logout, password reset
- [ ] 12-05: requireOwner middleware — non-owner JWT returns 403

---

## Backlog

(Items deferred from prior phases go here as `999.x`)
