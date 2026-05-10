---
phase: 6
slug: security-hardening
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (package.json test scripts are `echo 'Skipping'`) |
| **Config file** | none — Phase 12 adds test suite |
| **Quick run command** | Manual smoke tests (curl) |
| **Full suite command** | Manual smoke tests (curl) |
| **Estimated runtime** | ~5 minutes manual |

---

## Sampling Rate

- **After every task commit:** Run manual smoke test for that plan (see Per-Task Verification Map)
- **After every plan wave:** Run all smoke tests from completed plans
- **Before `/gsd-verify-work`:** All smoke tests must pass
- **Max feedback latency:** ~5 minutes per plan

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | — | T-06-01 | Login with correct credentials → 200 + token | smoke | `curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"<owner_email>","password":"<correct_password>"}' \| grep token` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | — | T-06-01 | Login with wrong password → 401 | smoke | `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"<owner_email>","password":"wrongpassword"}'` (expect 401) | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | — | T-06-01 | handler is async | code review | `grep -n "async.*login\|login.*async" backend/routes/auth.js` | ✅ | ⬜ pending |
| 06-02-01 | 02 | 1 | — | T-06-02 | Webhook with valid HMAC → 200 | smoke | Craft correct HMAC and POST to `/api/payments/webhook` → expect 200 | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | — | T-06-02 | Webhook with invalid HMAC → 400 | smoke | POST wrong sig to `/api/payments/webhook` → expect 400 | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | — | T-06-02 | Missing secret → 500 not 200 | code review | `grep -n "WEBHOOK_SECRET\|timingSafeEqual" backend/routes/payments.js` | ✅ | ⬜ pending |
| 06-03-01 | 03 | 1 | — | T-06-03 | Checkout limiter applied | code review | `grep -n "checkoutLimiter" backend/server.js` | ✅ | ⬜ pending |
| 06-04-01 | 04 | 1 | — | T-06-04 | Duplicate payment_id rejected | smoke | Insert same razorpay_payment_id twice → second fails | ❌ W0 | ⬜ pending |
| 06-04-02 | 04 | 1 | — | T-06-04 | Multiple NULL payment_ids allowed | smoke | Create 2 UPI/COD orders → both succeed | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No test framework to install. All automated verification is code review (grep) or manual smoke tests. Smoke tests require a running local server.

*Existing infrastructure covers all phase requirements (grep-based code review).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login with correct bcrypt hash succeeds | Plan 06-01 | No test framework; requires running server + real bcrypt hash in .env | 1. Generate hash: `node -e "require('bcryptjs').hash('YourPassword', 12).then(h => console.log('OWNER_PASSWORD_HASH=' + h))"` 2. Set in .env 3. POST to /api/auth/login with correct credentials → 200 + JWT |
| Webhook timingSafeEqual comparison | Plan 06-02 | Requires crafting correct Razorpay HMAC signature | Use `crypto.createHmac('sha256', secret).update(body).digest('hex')` to generate valid sig; POST to /api/payments/webhook with `X-Razorpay-Signature` header |
| Rate limit triggers after 20 checkouts in 15 min | Plan 06-03 | Requires 20+ rapid requests from same IP | Run 21 POST requests to /api/checkouts in under 15 min → 21st returns 429 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no framework to install — grep-based verification)
- [x] No watch-mode flags
- [x] Feedback latency < 300s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-09
