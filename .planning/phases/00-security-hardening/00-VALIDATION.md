---
phase: 0
slug: security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7 (backend) — `jest.config.js` present |
| **Config file** | `backend/jest.config.js` |
| **Quick run command** | `npm run test:unit --prefix backend` |
| **Full suite command** | `npm run test:integration:http --prefix backend` |
| **Estimated runtime** | ~30 seconds (unit) / ~90 seconds (integration) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit --prefix backend`
- **After every plan wave:** Run `npm run test:integration:http --prefix backend`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 0-01-01 | 01 | 1 | SEC-01 | OTP brute-force | 5 wrong OTPs → 429; further attempts blocked | Integration | `npm run test:integration:http --prefix backend -- --testPathPattern=verify-otp` | ❌ Wave 0 | ⬜ pending |
| 0-01-02 | 01 | 1 | SEC-01 | OTP brute-force | Correct OTP after lockout TTL expires → 200 | Integration | same | ❌ Wave 0 | ⬜ pending |
| 0-02-01 | 02 | 1 | SEC-02 | DEV bypass | Server throws on boot with DEV_TEST_PHONE in production | Unit/smoke | `node -e "process.env.NODE_ENV='production'; process.env.DEV_TEST_PHONE='test'; require('./frontend/src/instrumentation')"` | ❌ Wave 0 | ⬜ pending |
| 0-02-02 | 02 | 1 | SEC-02 | DEV bypass | DEV_TEST_PHONE absent from BFF route code | Static (grep) | `grep -r "DEV_TEST" frontend/src` | Manual | ⬜ pending |
| 0-03-01 | 03 | 1 | SEC-03 | Session expiry | Expired cookie (exp in past) → verifySignedCookie returns null | Unit | `npm run test:unit --prefix frontend` | ❌ Wave 0 | ⬜ pending |
| 0-03-02 | 03 | 1 | SEC-03 | Session expiry | Valid unexpired cookie → returns payload | Unit | same | ❌ Wave 0 | ⬜ pending |
| 0-03-03 | 03 | 1 | SEC-03 | Session expiry | Old token (no exp field) → accepted (not rejected) | Unit | same | ❌ Wave 0 | ⬜ pending |
| 0-04-01 | 04 | 2 | SEC-04 | Input validation | Missing identifier → 400 with type: "invalid_data" | Integration | `npm run test:integration:http --prefix backend -- --testPathPattern=send-otp` | ❌ Wave 0 | ⬜ pending |
| 0-04-02 | 04 | 2 | SEC-04 | Input validation | Missing otp in verify-otp → 400 | Integration | `npm run test:integration:http --prefix backend -- --testPathPattern=verify-otp` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/integration-tests/http/verify-otp.spec.ts` — brute-force lockout tests for SEC-01
- [ ] `backend/integration-tests/http/send-otp.spec.ts` — Zod validation tests for SEC-04
- [ ] `frontend/src/lib/session.test.ts` — unit tests for SEC-03 expiry logic (requires Vitest setup in frontend)
- [ ] Smoke test for `frontend/src/instrumentation.ts` startup assertion — covers SEC-02

*Wave 0 must be implemented as the first task of Phase 0 execution before any fix code is written.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DEV_TEST_PHONE absent from BFF routes | SEC-02 | Static code check | Run `grep -r "DEV_TEST" frontend/src` — must return no matches |
| SMS OTP still delivers after lockout expires | SEC-01 | Requires live Twilio + Redis | Manually trigger OTP, attempt 5 wrong verifications, wait for TTL, attempt correct OTP |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
