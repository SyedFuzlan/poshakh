---
phase: 5
slug: critical-hotfixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no unit test framework installed; Phase 12 adds coverage) |
| **Config file** | none |
| **Quick run command** | `node backend/tests/e2e.js` |
| **Full suite command** | `node backend/tests/e2e.js` |
| **Estimated runtime** | ~30 seconds (live server required) |

---

## Sampling Rate

- **After every task commit:** Run `node backend/tests/e2e.js` (where applicable)
- **After every plan wave:** Run `node backend/tests/e2e.js`
- **Before `/gsd-verify-work`:** Full suite must be green + manual curl verifications complete
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | 05-01 | — | POST /api/products succeeds without ReferenceError | smoke | `node backend/tests/e2e.js` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 1 | 05-02 | T-05-EoP | Non-owner JWT returns 403 on owner route | unit | manual curl (Wave 0 gap) | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | 05-03 | T-05-Info | 500 response body is `{"error":"Something went wrong"}` | unit | manual curl (Wave 0 gap) | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 1 | 05-04 | T-05-Tamper | times_used increments on checkout POST with promo | unit | manual curl (Wave 0 gap) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Manual curl verification scripts in each plan task for 05-02, 05-03, 05-04
- [ ] `node backend/tests/e2e.js` passes for 05-01 (product creation no longer crashes)

*No automated test framework exists. Plans must include explicit curl commands and expected output in acceptance_criteria.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Non-owner JWT returns 403 | 05-02 | No unit test framework installed | `curl -H "Authorization: Bearer <customer-jwt>" /api/products` → expect 403 |
| 500 body is generic | 05-03 | No unit test framework installed | Trigger error, inspect response body for absence of stack trace |
| times_used increments | 05-04 | No unit test framework installed | POST /api/checkouts with promo_code, then SELECT times_used from promo_codes |

---

## Validation Sign-Off

- [ ] All tasks have manual verify steps or automated e2e coverage
- [ ] Sampling continuity: no 3 consecutive tasks without any verify
- [ ] Wave 0 gaps covered by explicit curl commands in plan tasks
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
