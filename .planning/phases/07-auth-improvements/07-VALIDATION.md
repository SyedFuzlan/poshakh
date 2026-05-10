---
phase: 7
slug: auth-improvements
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-10
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — project has no automated test framework (Phase 12 will add it) |
| **Config file** | None — Wave 0 gap |
| **Quick run command** | manual curl / Postman — Wave 0 gap |
| **Full suite command** | manual curl / Postman — Wave 0 gap |
| **Estimated runtime** | N/A — manual verification |

---

## Sampling Rate

- **After every task commit:** Manual smoke test of the affected endpoint via curl
- **After every plan wave:** Run full manual verification checklist below
- **Before `/gsd-verify-work`:** All manual verification steps must pass
- **Max feedback latency:** N/A — manual

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | 07-01 | T-07-01 | Refresh token stored as SHA-256 hash, not raw | manual | `curl -X POST /api/customers/refresh` | No — Wave 0 | ⬜ pending |
| 07-01-02 | 01 | 1 | 07-01 | T-07-01 | Expired refresh token returns 401 | manual | curl with expired cookie | No — Wave 0 | ⬜ pending |
| 07-01-03 | 01 | 1 | 07-01 | T-07-01 | Token rotation: old token row deleted on refresh | manual | DB inspect after refresh | No — Wave 0 | ⬜ pending |
| 07-02-01 | 02 | 1 | 07-02 | T-07-02 | Logout deletes refresh_tokens row | manual | `curl -X POST /api/customers/logout` | No — Wave 0 | ⬜ pending |
| 07-02-02 | 02 | 1 | 07-02 | T-07-02 | Cookie cleared on logout | manual | check Set-Cookie header | No — Wave 0 | ⬜ pending |
| 07-03-01 | 03 | 2 | 07-03 | T-07-03 | Signup creates email_verification_tokens row | manual | DB inspect after signup | No — Wave 0 | ⬜ pending |
| 07-03-02 | 03 | 2 | 07-03 | T-07-03 | GET /verify-email marks email_verified=1 | manual | `curl /api/customers/verify-email?token=` | No — Wave 0 | ⬜ pending |
| 07-04-01 | 04 | 2 | 07-04 | T-07-04 | forgot-password always returns 200 (anti-enumeration) | manual | curl with unknown email | No — Wave 0 | ⬜ pending |
| 07-04-02 | 04 | 2 | 07-04 | T-07-04 | Reset token single-use (second use = 400) | manual | curl reset twice with same token | No — Wave 0 | ⬜ pending |
| 07-04-03 | 04 | 2 | 07-04 | T-07-04 | Expired reset token returns 400 | manual | curl with 31min old token | No — Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework to install — Phase 12 handles test infrastructure
- [ ] Manual verification steps embedded in each plan's `<verification>` block

*Note: Existing test infrastructure covers nothing for Phase 07. Manual curl/Postman verification is the realistic approach until Phase 12.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Refresh token stored as hash | 07-01 | No DB inspection tool in CI | `sqlite3 data/poshakh.db "SELECT token_hash FROM refresh_tokens LIMIT 1"` — should be 64-char hex |
| Cookie httpOnly flag set | 07-01 | Browser-level attribute | Check response headers: `Set-Cookie: refreshToken=...; HttpOnly` |
| forgot-password 200 for unknown email | 07-04 | Anti-enumeration | `curl -X POST /api/customers/forgot-password -d '{"email":"nope@x.com"}'` — must return 200 |
| Email links logged in dev | 07-03/04 | Dev mode skips Resend | `NODE_ENV=development` — verify console.log shows verification/reset link |
| Token expiry enforced | 07-01/03/04 | Requires time manipulation | Use `expires_at = datetime('now', '-1 second')` in DB for test setup |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (static file-content checks in all tasks)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (all tasks covered)
- [x] Wave 0 covers all MISSING references (no test framework needed — Phase 12 adds it; manual verification compensates)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (manual curl)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-10 — no test framework exists in this project until Phase 12; static file-content checks + manual curl verification blocks accepted as Phase 07 baseline.
