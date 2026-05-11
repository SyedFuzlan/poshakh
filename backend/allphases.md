 Prompt Diagnosis

  Strengths: Correct instinct — GSD agents are right tool for structured multi-phase execution.

  Issues:

  ┌──────────────────────────────────┬─────────────────────────────────────────────────┬────────────────────────────────────────┐
  │              Issue               │                     Impact                      │             Suggested Fix              │
  ├──────────────────────────────────┼─────────────────────────────────────────────────┼────────────────────────────────────────┤
  │ "Give all issues to one          │ GSD plans one phase at a time; 50 issues = one  │ Split into 7–8 focused phases, one     │
  │ gsd-plan-phase"                  │ giant unexecutable blob                         │ gsd-plan-phase each                    │
  ├──────────────────────────────────┼─────────────────────────────────────────────────┼────────────────────────────────────────┤
  │ No grouping by dependency order  │ DB migration must happen before features that   │ Order phases by dependency chain       │
  │                                  │ depend on PostgreSQL                            │                                        │
  ├──────────────────────────────────┼─────────────────────────────────────────────────┼────────────────────────────────────────┤
  │ Mix of critical bugs +           │ Planning a typo fix alongside a DB migration is │ Separate hotfixes (hours) from         │
  │ architectural shifts             │  noise                                          │ migrations (days)                      │
  └──────────────────────────────────┴─────────────────────────────────────────────────┴────────────────────────────────────────┘

  ---
  Recommended GSD Workflow

  ┌─────────┬────────────────────┬──────────────────────────────────┐
  │  Type   │     Component      │             Purpose              │
  ├─────────┼────────────────────┼──────────────────────────────────┤
  │ Command │ /gsd-plan-phase    │ One per phase below              │
  ├─────────┼────────────────────┼──────────────────────────────────┤
  │ Command │ /gsd-execute-phase │ Execute after each plan approved │
  ├─────────┼────────────────────┼──────────────────────────────────┤
  │ Command │ /gsd-verify-work   │ Gate between phases              │
  ├─────────┼────────────────────┼──────────────────────────────────┤
  │ Command │ /gsd-code-review   │ After each phase                 │
  ├─────────┼────────────────────┼──────────────────────────────────┤
  │ Scope   │ EPIC               │ 8 phases, multi-session          │
  └─────────┴────────────────────┴──────────────────────────────────┘

  ---
  Phase Breakdown (give each one to its own /gsd-plan-phase)

  Phase 1 — Critical Hotfixes (deploy-blockers, do first)

  Fix all deploy-blocking bugs in the Node.js/Express backend:

  1. products.js:271 — `priceNum` is undefined (typo). Change to `price * 100`.
  2. middleware/requireOwner.js:17 — Missing role check. Add:
     if (payload.role !== 'owner') return res.status(403).json({error:'Forbidden'})
  3. All error handlers — Sanitize PII before logging (no JWT tokens, passwords, card tokens in logs).
  4. promo.js:66–102 — `times_used` not incremented on promo apply. Fix to atomic increment.

  Tech stack: Node.js + Express + SQLite (sql.js) + Pino logger
  Files: routes/products.js, middleware/requireOwner.js, routes/promo.js, utils/logger.js
  No new dependencies. No schema changes. Hotfixes only.
  Acceptance: All 4 bugs fixed, existing tests pass.

  Phase 2 — Security Hardening

  Harden security in the Node.js/Express e-commerce backend:

  1. Hash owner password with bcrypt (currently plaintext in .env + direct string compare)
     - auth.js:20–29: replace string compare with bcrypt.compare()
     - Update PROD_ENV_CHECKLIST.md to note hashed password requirement

  2. Razorpay webhook HMAC: use crypto.timingSafeEqual() instead of direct comparison
     - payments.js:333–337

  3. Razorpay webhook: enforce signature verification even if WEBHOOK_SECRET env missing
     - payments.js:327–331: throw on missing secret, do not skip silently

  4. Add rate limiting to /api/customers/signup and /api/checkouts (currently unprotected)
     - server.js: apply existing apiLimiter middleware to these routes

  5. Payment idempotency: track razorpay_payment_id before inserting order; return same
     order if duplicate key hit — prevents double-charge on retried requests
     - payments.js:258–264

  Tech stack: Node.js + Express + bcryptjs + express-rate-limit
  Files: routes/auth.js, routes/payments.js, server.js, .env.example
  No schema changes required.
  Acceptance: All 5 security issues fixed, webhook rejects unsigned requests.

  Phase 3 — Auth: Refresh Tokens + Email Verification + Password Reset

  Implement production-grade auth flows in Node.js/Express/SQLite backend:

  1. Refresh token system: replace 30-day JWT with short-lived access token (15min) +
     refresh token (7d, stored in DB). Add POST /api/auth/refresh endpoint.
     Add POST /api/auth/logout endpoint (invalidate refresh token).

  2. Email verification: on customer signup, generate verification token, store in DB,
     send email (use existing email utility or nodemailer). Add GET /api/auth/verify-email?token=X

  3. Password reset: POST /api/auth/forgot-password → email token →
     POST /api/auth/reset-password?token=X { newPassword }

  DB schema additions needed: refresh_tokens table, email_verification_tokens table,
  password_reset_tokens table. Add via db.js initDb().

  Tech stack: Node.js + Express + sql.js + jsonwebtoken + bcryptjs + nodemailer (or existing email lib)
  Files: routes/auth.js, routes/customers.js, db.js, utils/ (new email helper if needed)
  Acceptance: Signup requires verification, password reset works, tokens rotate on refresh.

  Phase 4 — Database Migration: SQLite → PostgreSQL

  Migrate backend database from sql.js (SQLite in-memory) to PostgreSQL.

  This is the most critical architectural change. Steps:

  1. Replace sql.js with pg (node-postgres) + connection pooling (pg-pool)
  2. Replace custom db.js persistence layer with pg Pool.query()
  3. Implement proper migration system using node-postgres-migrate or db-migrate
     - Extract all CREATE TABLE statements from db.js initDb() into migration files
     - Add indexes: customers(phone), customers(email), orders(status), products(category)
  4. Replace all raw string-concatenated WHERE clauses with parameterized queries ($1, $2)
     - Audit orders.js:227–239 specifically
  5. Wrap multi-step payment processing in DB transactions
     - payments.js: createOrder + updateInventory must be atomic
  6. Update .env.example with DATABASE_URL
  7. Update Dockerfile for PostgreSQL connection

  Tech stack: Node.js + Express → PostgreSQL + pg + pg-pool + db-migrate
  Files: db.js (full rewrite), server.js, all routes/*.js (query syntax update), Dockerfile, .env.example
  DO NOT change API response shapes or business logic — only data layer.
  Acceptance: All existing routes work with PostgreSQL, no sql.js references remain.

  Phase 5 — Inventory Reservation + Order State Machine

  Fix inventory overselling and add order state machine in Node.js/Express/PostgreSQL backend:

  1. Inventory reservation system:
     - On POST /api/payments/create-order: reserve stock (decrement reserved_qty, check available = total - reserved)
     - If payment not verified within 15min, release reservation (cron job or TTL)
     - On payment verify: convert reservation to actual sale (decrement stock_qty, clear reserved)
     - On payment fail: release reservation
     - Schema change: add reserved_qty column to products/variants table

  2. Order state machine — valid transitions only:
     pending → confirmed → processing → shipped → delivered
     pending → cancelled (if not yet processing)
     Any other transition: 400 Bad Request
     - orders.js:250–340: add transition validation before UPDATE

  Tech stack: Node.js + Express + PostgreSQL
  Files: routes/payments.js, routes/orders.js, db.js (migration for reserved_qty)
  Acceptance: Concurrent orders cannot oversell. Invalid state transitions rejected.

  Phase 6 — Missing Core Features

  Implement missing e-commerce features in Node.js/Express/PostgreSQL backend:

  1. Soft deletes: add deleted_at column to products, orders, customers tables.
     All DELETE endpoints set deleted_at = NOW(). All SELECT queries add WHERE deleted_at IS NULL.

  2. Return/Refund flow:
     - POST /api/orders/:id/return — customer initiates return request
     - PATCH /api/orders/:id/return/:returnId — owner approves/rejects
     - On approval: trigger Razorpay refund API, update order status to 'refunded'
     - DB schema: returns table (id, order_id, reason, status, created_at)

  3. Webhook retry idempotency:
     - payments.js: store processed webhook event IDs in DB
     - On duplicate webhook (Razorpay retries): return 200 immediately, skip processing
     - DB schema: webhook_events table (razorpay_event_id, processed_at)

  4. API versioning: prefix all routes with /api/v1/ in server.js

  Tech stack: Node.js + Express + PostgreSQL + Razorpay SDK
  Files: routes/payments.js, routes/orders.js, routes/products.js, server.js, db.js
  Acceptance: Soft deletes work, refund flow triggers Razorpay refund, duplicate webhooks idempotent.

  Phase 7 — Observability + DevOps

  Production observability and DevOps hardening for Node.js/Express backend:

  1. Request ID middleware: generate UUID per request, attach to all log entries
     - server.js: add middleware before routes using crypto.randomUUID()
     - Replace all console.log() calls with logger.* (audit routes/auth.js:84, routes/orders.js:37)

  2. Prometheus metrics: add prom-client
     - Track: http_request_duration_ms (histogram), orders_created_total (counter),
       stock_level (gauge per product), payment_errors_total (counter)
     - Expose GET /metrics endpoint (protected, owner-only)

  3. Graceful shutdown: server.js:140–151
     - On SIGTERM: stop accepting new connections, wait for pending requests (10s timeout), then exit
     - Cancel background checkoutRecovery task

  4. Dockerfile: create multi-stage Dockerfile for backend
     - Stage 1: build/install
     - Stage 2: production image (node:20-alpine)
     - Include health check endpoint GET /health

  5. Add data/ to .gitignore (database file not tracked)

  Tech stack: Node.js + Express + pino + prom-client + Docker
  Files: server.js, utils/logger.js, Dockerfile (new), .gitignore
  Acceptance: All logs have request IDs, /metrics works, graceful shutdown tested, Docker build succeeds.

  Phase 8 — Test Suite

  Build integration test suite for Node.js/Express/PostgreSQL e-commerce backend:

  Priority test coverage (in order):
  1. Payment flow: create-order → verify-payment → webhook → order confirmed
     - Test idempotency: duplicate webhook = no double-processing
     - Test signature verification: invalid sig = 400

  2. Inventory: concurrent order test — 2 simultaneous orders for qty=1 product
     - Only one should succeed; other gets 409

  3. Order state machine: test all invalid transitions return 400

  4. Auth: signup → verify-email → login → refresh → logout flow
     Password reset token flow.

  5. requireOwner middleware: non-owner JWT returns 403

  6. Products: create/update/delete (soft delete) with price in paise

  Test framework: Jest + supertest (already in package.json)
  Use a test PostgreSQL DB (separate from dev DB)
  Files: tests/ directory (expand existing), jest.config.js
  Target: 80%+ coverage on routes/payments.js, routes/orders.js, routes/auth.js
  DO NOT mock the database — use real PostgreSQL test DB (integration tests only).

  ---
  Execution Order (critical)

  Phase 1 (hotfixes)  →  Phase 2 (security)  →  Phase 3 (auth)
                                                       ↓
  Phase 4 (PostgreSQL migration)  ← must complete before phases 5–8
                                                       ↓
  Phase 5 (inventory + state machine)  →  Phase 6 (features)
                                                       ↓
                          Phase 7 (observability)  →  Phase 8 (tests)

  Phase 4 is the gate. Phases 5–8 assume PostgreSQL.

  ---
  Your Plan Assessment

  Plan works — with one fix: don't give all 50 issues to one gsd-plan-phase. One plan per phase above. Each phase is bounded, has
  clear acceptance criteria, and builds on the previous one.

  Run each as:
  /gsd-plan-phase    # paste one phase prompt above
  /gsd-execute-phase # after plan approved
  /gsd-verify-work   # before moving to next phase

  Phases 1–3 can start immediately on existing SQLite. Phase 4 is the DB migration — do it before Phase 5+.

✻ Worked for 1m 12s

※ recap: Auditing and fixing the Poshakh e-commerce backend across 8 structured GSD phases. Next action: run `/gsd-plan-phase` with
  the Phase 1 hotfixes prompt to fix the 4 critical deploy-blocking bugs first.