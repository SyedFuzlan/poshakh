---
phase: 06-security-hardening
plan: "02"
subsystem: payments
tags: [razorpay, webhook, hmac, crypto, timingSafeEqual, security]

# Dependency graph
requires:
  - phase: 05-critical-hotfixes
    provides: logger utility (pino) already imported in payments.js
provides:
  - Timing-safe HMAC webhook verification using crypto.timingSafeEqual
  - Enforced RAZORPAY_WEBHOOK_SECRET presence (500 rejection vs silent 200)
  - Missing signature header guard (400 before HMAC computation)
  - Length guard before timingSafeEqual to prevent ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH
affects: [payments, webhook, security-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "crypto.timingSafeEqual with Buffer.from(...,'hex') for constant-time HMAC comparison"
    - "500 rejection on missing required env var (not silent pass-through)"
    - "TDD: failing tests committed first (RED), then implementation (GREEN)"

key-files:
  created:
    - backend/tests/webhook-security.test.js
  modified:
    - backend/routes/payments.js

key-decisions:
  - "Missing RAZORPAY_WEBHOOK_SECRET returns 500 (not 200 ignored) so Razorpay retry system surfaces misconfiguration"
  - "Both Buffer.from calls use 'hex' encoding — mandatory to produce correct-length buffers for timingSafeEqual"
  - "sigBuf.length !== expBuf.length guard placed before crypto.timingSafeEqual() — prevents synchronous ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH throw on malformed signatures"
  - "Missing x-razorpay-signature header guard added — returns 400 before HMAC is computed"

patterns-established:
  - "Pattern: length guard + timingSafeEqual — use sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf) for all HMAC comparisons"
  - "Pattern: required env var rejection — return 500 with descriptive error when a required secret is absent; never silently ignore"

requirements-completed:
  - SEC-02-webhook-timing-safe

# Metrics
duration: 12min
completed: 2026-05-09
---

# Phase 06 Plan 02: Webhook Security Hardening Summary

**crypto.timingSafeEqual HMAC comparison with enforced secret presence and Buffer.from('hex') encoding in the Razorpay webhook handler**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-09T08:55:00Z
- **Completed:** 2026-05-09T09:07:00Z
- **Tasks:** 1 (TDD: 2 commits — RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Replaced `console.warn + 200 ignored` with `logger.error + 500` when `RAZORPAY_WEBHOOK_SECRET` is absent — Razorpay's retry system now surfaces misconfiguration instead of silently accepting all forged events
- Added missing `x-razorpay-signature` header guard: returns 400 before HMAC is computed
- Replaced `signature !== expectedSig` string comparison with `crypto.timingSafeEqual(sigBuf, expBuf)` — eliminates timing side-channel that could allow HMAC forgery
- Both `Buffer.from` calls specify `"hex"` encoding — prevents wrong-length UTF-8 buffers that would cause `timingSafeEqual` to throw or always fail
- `sigBuf.length !== expBuf.length` length guard precedes `timingSafeEqual` — malformed/truncated signatures return 400 instead of crashing
- All `console.warn`/`console.error` in the webhook handler replaced with `logger.error` (pino)
- 6-test TDD suite committed: tests 1, 2, 6 were RED (failing), all 6 are GREEN after implementation

## Task Commits

TDD execution with two commits for the single task:

1. **RED — Failing tests** - `3bd017c` (test): webhook-security.test.js with 6 behavioral tests
2. **GREEN — Implementation** - `a8200f1` (feat): timing-safe webhook handler + test source-check fix

**Plan metadata:** (this commit)

## Files Created/Modified

- `backend/routes/payments.js` — Webhook handler block replaced with timingSafeEqual, length guard, secret enforcement, and logger calls
- `backend/tests/webhook-security.test.js` — 6-test TDD suite exercising all acceptance criteria behaviorally and via source inspection

## Decisions Made

- `500` (not `503` or `400`) for missing secret — matches the existing catch-all `500` pattern in the handler and signals a server-side misconfiguration to Razorpay's retry logic
- Source-level test (Test 6) checks `crypto.timingSafeEqual(` (the call) rather than `timingSafeEqual` (which appears in comments) — fixed after RED run exposed the comment-matching false-positive
- Extracted webhook handler from the router stack for unit testing without spinning up the full server — avoids test dependencies on DB, env, and network

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed source-level test to find function call, not comment**
- **Found during:** Task 1 GREEN phase (first test run after implementation)
- **Issue:** Test 6 searched for `timingSafeEqual` in source using `indexOf`, but comments above the call also contain the string — comment index was lower than the actual call index, causing the length-guard position assertion to fail even though the implementation was correct
- **Fix:** Changed search target from `"timingSafeEqual"` to `"crypto.timingSafeEqual("` — the function call form is unambiguous and not present in comments
- **Files modified:** `backend/tests/webhook-security.test.js`
- **Verification:** All 6 tests pass after fix
- **Committed in:** `a8200f1` (combined with implementation in GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test source-check)
**Impact on plan:** Minor test correctness fix; no scope change.

## Issues Encountered

None in implementation. The test source-check false-positive (above) was caught immediately on first GREEN run and fixed inline.

## User Setup Required

None — no external service configuration required. `RAZORPAY_WEBHOOK_SECRET` was already documented in `.env.example` from prior phases.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. This plan hardens an existing endpoint. All threats from the plan's STRIDE register are mitigated:

| Threat | Status |
|--------|--------|
| T-06-02-01 Spoofing via forged webhook | Mitigated — timingSafeEqual |
| T-06-02-02 Timing side-channel on HMAC | Mitigated — constant-time comparison |
| T-06-02-03 Missing secret silent accept | Mitigated — 500 rejection |
| T-06-02-04 DoS via timingSafeEqual length throw | Mitigated — length guard |
| T-06-02-05 Wrong buffer encoding | Mitigated — "hex" on both Buffer.from calls |
| T-06-02-06 payment.captured privilege escalation | Accepted — UPDATE only, orphaned payments logged |

## Next Phase Readiness

- `backend/routes/payments.js` webhook handler is hardened and ready for production
- Plans 03 and 04 of phase 06 can proceed independently (they address different files)

---
*Phase: 06-security-hardening*
*Completed: 2026-05-09*
