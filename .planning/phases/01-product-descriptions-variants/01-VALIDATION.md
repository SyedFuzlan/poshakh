---
phase: 01
slug: product-descriptions-variants
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual smoke tests only (no automated framework installed) |
| **Config file** | none |
| **Quick run command** | `node backend/server.js` + `curl localhost:9000/api/products/:id` |
| **Full suite command** | Manual checklist in each plan's acceptance criteria |
| **Estimated runtime** | ~5 minutes manual |

---

## Sampling Rate

- **After every task commit:** Manually verify the changed endpoint/component
- **After every plan wave:** Run full manual checklist below
- **Before `/gsd-verify-work`:** All manual checklist items must pass
- **Max feedback latency:** ~5 minutes

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-1 | 01-01 | 1 | DB migration | — | Existing data not lost | Manual | `node backend/server.js` — confirm no crash | N/A | ⬜ pending |
| 01-01-2 | 01-01 | 1 | description column | — | NULL allowed | Manual | `curl localhost:9000/api/products/1` — check description field | N/A | ⬜ pending |
| 01-01-3 | 01-01 | 1 | variants table | — | FK + CASCADE | Manual | Server starts, table exists | N/A | ⬜ pending |
| 01-02-1 | 01-02 | 1 | GET /:id variants | — | LEFT JOIN, not INNER | Manual | Existing product returns variants:[] not 404 | N/A | ⬜ pending |
| 01-02-2 | 01-02 | 1 | POST variants saved | — | multer array normalised | Manual | Add product with 2 sizes, verify in API | N/A | ⬜ pending |
| 01-03-1 | 01-03 | 1 | Size selector UI | — | OOS disabled, not hidden | Manual | Load product detail in browser | N/A | ⬜ pending |
| 01-03-2 | 01-03 | 1 | Out-of-stock CTA | — | Non-interactive | Manual | All-OOS product shows "Out of Stock" | N/A | ⬜ pending |
| 01-03-3 | 01-03 | 1 | Dead code removed | — | No Medusa imports | Manual | grep for getOrCreateCart in ProductDetailClient.tsx | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No automated test framework exists. Each plan's Wave 0 is a manual smoke-test read:

- Start backend: `cd backend && node server.js` — confirm no crash on startup
- Confirm DB file loads: `data/poshakh.db` exists, server logs no schema errors
- Existing frontend loads: `localhost:3000/products` shows product cards

*If none: "Existing infrastructure covers all phase requirements." — In this case, manual smoke-test protocol replaces automated Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DB schema migration succeeds | D-01, D-02, D-12 | No automated DB schema tests | Start server after migration, check logs for errors, fetch `GET /api/products/:id` |
| Existing products return variants:[] (not 404) | D-13 | Requires live DB + server | Fetch existing product ID after migration, verify `variants: []` and `description: ""` |
| Dashboard add-product form saves variants correctly | D-05, D-07 | Vanilla JS dashboard, no test runner | Log in to `/dashboard`, add product with 2 sizes + stock values, verify in products API |
| OOS size buttons show greyed + strikethrough | D-08 | Visual UI state | Add product with stock=0 size, load product detail page in browser |
| All-OOS product shows "Out of Stock" CTA | D-10 | Visual UI state | Add product with all sizes at stock=0, verify CTA is disabled "Out of Stock" |
| Dead Medusa sync block removed | Claude's Discretion | Code review | `grep -n "getOrCreateCart\|addMedusaLineItem" frontend/src/app/products/\[id\]/ProductDetailClient.tsx` — must return no matches |

---

## Validation Sign-Off

- [ ] All tasks have manual acceptance criteria in plan
- [ ] Wave 0 smoke test: server starts cleanly after migration
- [ ] Existing products not broken (variants:[], description:"")
- [ ] New product with variants saves and is returned by API
- [ ] OOS UI logic verified in browser
- [ ] Dead Medusa code removed and verified
- [ ] `nyquist_compliant: true` set in frontmatter when all items above pass

**Approval:** pending
