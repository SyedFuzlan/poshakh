---
phase: 06-security-hardening
plan: "04"
subsystem: payments
tags: [sqlite, unique-index, idempotency, razorpay, race-condition]

# Dependency graph
requires:
  - phase: 06-02
    provides: payments.js verify handler (timingSafeEqual HMAC) — Plan 04 modifies the same catch block
provides:
  - Partial UNIQUE INDEX on orders(razorpay_payment_id) eliminating TOCTOU race
  - 409 response on UNIQUE constraint error in POST /api/payments/verify
affects: [phase-08-postgresql-migration, phase-12-test-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Partial SQLite UNIQUE INDEX (WHERE col IS NOT NULL) for nullable FK idempotency
    - Defense-in-depth dedup: application-level SELECT fast path + DB-level UNIQUE constraint safety net

key-files:
  created: []
  modified:
    - backend/db.js
    - backend/routes/payments.js

key-decisions:
  - "Partial index (WHERE razorpay_payment_id IS NOT NULL) lets UPI/COD orders retain multiple NULL rows"
  - "IF NOT EXISTS on the CREATE INDEX makes the safeMigrate call idempotent on every server restart"
  - "409 returned on exact SQLite error string 'UNIQUE constraint failed: orders.razorpay_payment_id' — not a broad UNIQUE catch"
  - "logger.error replaces console.error in the generic 500 path of the verify handler (consistent with Phase 05 PII logging fix)"

patterns-established:
  - "safeMigrate for index creation: same CREATE UNIQUE INDEX IF NOT EXISTS pattern as idx_products_slug"
  - "Catch-block error discrimination: String(err.message).includes(exact constraint string) before generic 500"

requirements-completed:
  - SEC-04-payment-idempotency

# Metrics
duration: 15min
completed: 2026-05-09
---

# Phase 06 Plan 04: Payment Idempotency Summary

**Partial UNIQUE INDEX on orders(razorpay_payment_id) with 409 on UNIQUE constraint error eliminates TOCTOU race in Razorpay verify handler**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-09T14:35:00Z
- **Completed:** 2026-05-09T14:50:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `idx_orders_razorpay_payment_id` partial UNIQUE INDEX via `safeMigrate` — runs idempotently on every server startup
- Partial index (`WHERE razorpay_payment_id IS NOT NULL`) leaves UPI/COD orders (NULL payment IDs) completely unaffected
- Updated verify handler catch block to return 409 on the exact UNIQUE constraint error string instead of a generic 500
- Replaced `console.error` with `logger.error` in the generic 500 path of the verify handler, consistent with Phase 05 PII-stripping work

## Task Commits

Each task was committed atomically:

1. **Task 1: Add partial UNIQUE INDEX migration in db.js** - `c14a59c` (feat)
2. **Task 2: Update verify handler catch block to return 409 on UNIQUE constraint error** - `69d7ce4` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `backend/db.js` — Added `safeMigrate('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ON orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL')`
- `backend/routes/payments.js` — Updated catch block in POST /api/payments/verify: 409 on UNIQUE constraint, `logger.error` on generic 500 path

## Decisions Made
- Partial index chosen over full UNIQUE INDEX because UPI/COD orders legitimately share NULL as their razorpay_payment_id — a full index would block them
- `IF NOT EXISTS` is mandatory: `safeMigrate` runs on every server startup; the helper swallows errors but index creation noise is unnecessary
- 409 (Conflict) is the correct HTTP status for a duplicate resource attempt — prevents Razorpay's webhook retry loop from treating a constraint error as an unprocessed event
- Matching the exact SQLite error string (`UNIQUE constraint failed: orders.razorpay_payment_id`) keeps the 409 narrow — other unexpected errors still surface as 500

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 06 Security Hardening is now complete (all 4 plans done: bcrypt password hash, timing-safe webhook HMAC, checkout rate limiter, payment idempotency)
- Phase 07 (Auth Improvements) and Phase 08 (PostgreSQL Migration) can proceed independently

---
*Phase: 06-security-hardening*
*Completed: 2026-05-09*
