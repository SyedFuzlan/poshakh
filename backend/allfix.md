 Full audit complete. Here's the report:

  ---
  Backend Audit Report

  1. Stack

  Node.js + Express, SQLite via sql.js (in-memory with file persistence), Razorpay, JWT auth, Pino logging, Zod validation.

  2. Audit Table

  ┌───────────────┬─────────────────────────────────────────┬──────────┬──────────────────────────┬─────────────────────────────┐
  │   Category    │                  Issue                  │ Severity │        File:Line         │       Recommendation        │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Security      │ Owner password stored plaintext in      │ CRITICAL │ auth.js:20–29            │ Hash with bcrypt; never     │
  │               │ .env, compared directly (no bcrypt)     │          │                          │ store plaintext             │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Security      │ requireOwner does NOT check role ===    │ CRITICAL │ requireOwner.js:7–24     │ Add if (payload.role !==    │
  │               │ "owner" — any valid JWT passes          │          │                          │ "owner") return 403         │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Security      │ PII/secrets logged in error handlers    │ CRITICAL │ Multiple                 │ Sanitize before logging     │
  │               │ (JWT tokens, passwords)                 │          │                          │                             │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Security      │ Webhook secret validation skipped if    │ HIGH     │ payments.js:327–331      │ Enforce verification;       │
  │               │ env var missing (silent failure)        │          │                          │ reject unsigned webhooks    │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Security      │ No CSRF protection on state-changing    │ HIGH     │ server.js                │ Add SameSite cookies or     │
  │               │ endpoints                               │          │                          │ CSRF tokens                 │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Security      │ No rate limiting on /api/checkouts or   │ MEDIUM   │ server.js:93–100         │ Apply rate limiter to all   │
  │               │ /api/customers/signup                   │          │                          │ auth/checkout routes        │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Security      │ Webhook HMAC comparison not timing-safe │ MEDIUM   │ payments.js:333–337      │ Use timingSafeEqual         │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Database      │ sql.js (SQLite in-memory) → not safe    │ CRITICAL │ db.js:51–74              │ Migrate to PostgreSQL with  │
  │               │ for concurrent writes                   │          │                          │ connection pooling          │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Database      │ No migration system; schema changes     │ HIGH     │ db.js:96–110             │ Use db-migrate, Flyway, or  │
  │               │ inline in initDb() with silent catch    │          │                          │ Knex migrations             │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │               │ _save() called after every write — no   │          │                          │                             │
  │ Database      │ locking; race conditions on concurrent  │ HIGH     │ db.js:51–65              │ Switch to WAL or real DB    │
  │               │ orders                                  │          │                          │                             │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Database      │ Missing indexes on phone, email,        │ MEDIUM   │ db.js                    │ Add explicit CREATE INDEX   │
  │               │ category, status columns                │          │                          │ statements                  │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Database      │ Inconsistent price columns: price vs    │ MEDIUM   │ products.js:79–82,       │ Standardize to price_paise; │
  │               │ price_paise                             │          │ payments.js:79,96        │  drop price                 │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ API Design    │ No idempotency keys for payments        │ HIGH     │ payments.js:258–264      │ Track idempotency keys      │
  │               │ (duplicate charges on retry)            │          │                          │ before inserting orders     │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ API Design    │ No pagination on /api/orders (no total  │ MEDIUM   │ orders.js:212–245        │ Return {orders, total,      │
  │               │ count returned)                         │          │                          │ limit, offset}              │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ API Design    │ Inconsistent error response shape       │ MEDIUM   │ Multiple                 │ Standardize to {success,    │
  │               │ ({error} vs {success:false, error})     │          │                          │ error?, data?}              │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ API Design    │ No API versioning (/api/v1/)            │ MEDIUM   │ server.js                │ Add /api/v1/ prefix         │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Auth          │ 30-day JWT, no refresh tokens, no       │ HIGH     │ customers.js:32–38       │ Short-lived access tokens   │
  │               │ rotation                                │          │                          │ (15min) + refresh tokens    │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Auth          │ No logout endpoint; tokens valid until  │ MEDIUM   │ auth.js                  │ Token blacklist (Redis) or  │
  │               │ natural expiry                          │          │                          │ refresh token revocation    │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Missing       │ No inventory reservation — concurrent   │          │                          │ Reserve stock at order      │
  │ Feature       │ orders oversell same stock              │ CRITICAL │ payments.js:70–199       │ creation; release on        │
  │               │                                         │          │                          │ timeout                     │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Missing       │ Promo code times_used not incremented   │ HIGH     │ promo.js:66–102          │ Increment counter           │
  │ Feature       │ on apply                                │          │                          │ atomically on use           │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Missing       │ No email verification for signups       │ HIGH     │ customers.js             │ Add verification token flow │
  │ Feature       │                                         │          │                          │  before activation          │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Missing       │ No password reset flow                  │ HIGH     │ —                        │ Forgot password → email →   │
  │ Feature       │                                         │          │                          │ reset token → new password  │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Missing       │ No order state machine (can jump        │ HIGH     │ orders.js:250–340        │ Define valid transitions;   │
  │ Feature       │ pending → any status freely)            │          │                          │ validate before update      │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Missing       │ No return/refund flow                   │ HIGH     │ —                        │ Implement return request +  │
  │ Feature       │                                         │          │                          │ refund processing           │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Missing       │ No webhook retry logic (failed save =   │ HIGH     │ payments.js:321–368      │ Idempotency + retry with    │
  │ Feature       │ orphaned payment)                       │          │                          │ exponential backoff         │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Code Quality  │ priceNum undefined in product creation  │ CRITICAL │ products.js:271          │ Change priceNum → price     │
  │               │ (typo crash)                            │          │                          │                             │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Code Quality  │ Silent catch {} blocks swallow errors   │ MEDIUM   │ db.js:109,               │ Log or rethrow              │
  │               │                                         │          │ products.js:363          │                             │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Code Quality  │ Mixed console.log() + logger.*          │ MEDIUM   │ auth.js:84, orders.js:37 │ Replace all console.* with  │
  │               │ throughout                              │          │                          │ logger.*                    │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Performance   │ Product list: LEFT JOIN + GROUP BY on   │ HIGH     │ products.js:136–165      │ Cache responses; invalidate │
  │               │ every request, no caching               │          │                          │  on write                   │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Performance   │ CSV export loads all orders into memory │ MEDIUM   │ orders.js:181–208        │ Use csv-stringify streaming │
  │               │  (no streaming)                         │          │                          │                             │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Observability │ No request ID correlation across logs   │ MEDIUM   │ server.js                │ Add uuid request ID         │
  │               │                                         │          │                          │ middleware                  │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Observability │ No metrics (no Prometheus/StatsD)       │ HIGH     │ —                        │ Add prometheus-client       │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Testing       │ No backend test suite                   │ HIGH     │ package.json             │ Add Jest; aim 80%+ coverage │
  │               │                                         │          │                          │  on payment + order flows   │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ Testing       │ No integration tests for                │ CRITICAL │ —                        │ Test Razorpay signature     │
  │               │ payment/webhook flow                    │          │                          │ verification end-to-end     │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ DevOps        │ No Dockerfile for backend               │ MEDIUM   │ —                        │ Add multi-stage Dockerfile  │
  ├───────────────┼─────────────────────────────────────────┼──────────┼──────────────────────────┼─────────────────────────────┤
  │ DevOps        │ No graceful shutdown for pending async  │ MEDIUM   │ server.js:140–151        │ Cancel background tasks;    │
  │               │ ops                                     │          │                          │ drain before exit           │
  └───────────────┴─────────────────────────────────────────┴──────────┴──────────────────────────┴─────────────────────────────┘

  ---
  3. Critical Path — Top 5 Before Launch

  1. priceNum typo — product creation crashes immediately (products.js:271)
  2. requireOwner missing role check — every authenticated user is an admin
  3. PostgreSQL migration — sql.js will corrupt under any real concurrent load
  4. Inventory reservation — concurrent orders oversell; no locking whatsoever
  5. Hash owner password — plaintext in .env + direct string compare

  ---
  4. Missing Features vs Production Standard

  ┌───────────────────────────────────┬───────────────────────┬────────────────────────┬──────────┐
  │              Feature              │ Shopify/Medusa Has It │     Current Status     │ Priority │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Inventory reservation             │ Yes                   │ Missing                │ CRITICAL │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Email verification                │ Yes (mandatory)       │ Missing                │ HIGH     │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Password reset                    │ Yes                   │ Missing                │ HIGH     │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Refresh token rotation            │ Yes                   │ 30d single JWT         │ HIGH     │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Order state machine               │ Yes (strict)          │ Any→Any allowed        │ HIGH     │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Return/refund flow                │ Yes (core)            │ Missing                │ HIGH     │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Webhook idempotency + retry       │ Yes                   │ Single attempt         │ HIGH     │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Promo usage tracking per-customer │ Yes                   │ Counter not updated    │ HIGH     │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ SQL migrations                    │ Yes                   │ Inline initDb()        │ HIGH     │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Request ID correlation            │ Yes                   │ Missing                │ MEDIUM   │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ CSRF protection                   │ Yes                   │ Missing                │ MEDIUM   │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ API versioning (/v1/)             │ Yes                   │ Missing                │ MEDIUM   │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Structured JSON logging           │ Yes                   │ Mixed console/pino     │ MEDIUM   │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Prometheus metrics                │ Yes                   │ Missing                │ MEDIUM   │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Tax calculation                   │ Yes (region-aware)    │ Fixed shipping only    │ MEDIUM   │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Soft deletes / audit trail        │ Yes                   │ Hard deletes           │ MEDIUM   │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Multi-admin RBAC                  │ Yes                   │ Single hardcoded owner │ LOW      │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Product reviews/ratings           │ Yes                   │ Missing                │ LOW      │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Wishlist/favorites                │ Yes                   │ Missing                │ LOW      │
  ├───────────────────────────────────┼───────────────────────┼────────────────────────┼──────────┤
  │ Bulk import/export                │ Yes                   │ CSV export only        │ LOW      │
  └───────────────────────────────────┴───────────────────────┴────────────────────────┴──────────┘

  ---
  Overall verdict: High risk. Safe for single-user demo. Not safe for real transactions — concurrent order race conditions, no
  inventory locking, and an admin auth bypass are launch-blockers.