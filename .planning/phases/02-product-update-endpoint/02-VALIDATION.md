---
phase: 02
slug: product-update-endpoint
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual curl + browser (no automated test suite in this project) |
| **Config file** | none |
| **Quick run command** | `curl -s -X PATCH http://localhost:9000/api/products/1 -H 'Authorization: Bearer TOKEN' -H 'Content-Type: application/json' -d '{"name":"Test","price":999,"description":"d","sizes":["M"],"stock":[5]}'` |
| **Full suite command** | Manual browser UAT — all 11 cases in Per-Task Verification Map below |
| **Estimated runtime** | ~5 minutes (11 manual test cases) |

---

## Sampling Rate

- **After every task commit:** Run relevant curl commands (PATCH-01 through PATCH-06 for Plan 02-01; UI-01 through UI-05 for Plan 02-02)
- **After every plan wave:** Run all 11 test cases
- **Before `/gsd-verify-work`:** All 11 test cases must pass
- **Max feedback latency:** ~5 minutes (manual only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Status |
|---------|------|------|-------------|------------|-----------------|-----------|--------|
| PATCH-01 | 02-01 | 1 | Update product fields (name/price/description) | — | N/A | manual curl | ⬜ pending |
| PATCH-02 | 02-01 | 1 | Replace variants (delete + re-insert) | — | N/A | manual curl | ⬜ pending |
| PATCH-03 | 02-01 | 1 | Zero-stock size preserved as valid variant | — | N/A | manual curl | ⬜ pending |
| PATCH-04 | 02-01 | 1 | Auth guard — 401 without valid JWT | T-EoP-01 | 401 without JWT | manual curl | ⬜ pending |
| PATCH-05 | 02-01 | 1 | 404 for nonexistent product ID | — | N/A | manual curl | ⬜ pending |
| PATCH-06 | 02-01 | 1 | 400 when sizes array is empty | — | N/A | manual curl | ⬜ pending |
| UI-01 | 02-02 | 2 | Tile click opens pre-filled edit modal | — | N/A | browser | ⬜ pending |
| UI-02 | 02-02 | 2 | Sizes with stock=0 shown checked in modal | — | N/A | browser | ⬜ pending |
| UI-03 | 02-02 | 2 | Save closes modal and reloads grid | — | N/A | browser | ⬜ pending |
| UI-04 | 02-02 | 2 | Cancel dismisses modal without saving | — | N/A | browser | ⬜ pending |
| UI-05 | 02-02 | 2 | No sizes selected → error shown, modal stays | — | N/A | browser | ⬜ pending |

---

## Wave 0 Requirements

No Wave 0 setup needed. Manual curl and browser testing only — no test infrastructure to install.

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| PATCH-01: Update fields | No automated test suite | `curl -X PATCH http://localhost:9000/api/products/1 -H 'Authorization: Bearer TOKEN' -H 'Content-Type: application/json' -d '{"name":"Updated","price":999,"description":"desc","sizes":["M"],"stock":[5]}'` → 200 with updated fields in response |
| PATCH-02: Replace variants | Manual | Send `{"sizes":["M","L"],"stock":[10,5]}` → response `variants` contains only M and L, any prior sizes gone |
| PATCH-03: Zero-stock variant | Manual | `{"sizes":["XS"],"stock":[0]}` → response includes XS variant with stock=0 |
| PATCH-04: Auth guard | Security verification | Omit `Authorization` header → `{"error":"Not authenticated"}` (401) |
| PATCH-05: 404 | Manual | Use nonexistent id (e.g. `99999`) → `{"error":"Product not found"}` (404) |
| PATCH-06: Empty sizes | Manual | `{"sizes":[],"stock":[]}` → `{"error":"At least one size is required"}` (400) |
| UI-01: Modal opens pre-filled | Browser only | Dashboard → Products tab → click any product tile → modal opens with correct name, price, description, and size pills checked |
| UI-02: Zero-stock checked | Browser only | Product with a stock=0 variant → open edit modal → that size pill is checked (not unchecked) |
| UI-03: Save + reload | Browser only | Edit product name → Save → modal closes, grid immediately shows updated name |
| UI-04: Cancel | Browser only | Open modal → click close/cancel → no changes to product data |
| UI-05: No sizes error | Browser only | Uncheck all size pills → click Save → error message shown, modal stays open |

---

## Validation Sign-Off

- [ ] All tasks have verify steps in PLAN.md
- [ ] Sampling continuity: curl commands for all backend tasks, browser steps for all UI tasks
- [ ] Wave 0: no infrastructure needed — manual testing covers all cases
- [ ] No watch-mode flags
- [ ] Feedback latency: ~5 min (11 manual test cases)
- [ ] `nyquist_compliant: true` set in frontmatter when all above is complete

**Approval:** pending
