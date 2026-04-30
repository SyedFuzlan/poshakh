---
phase: 02-product-update-endpoint
plan: 01
subsystem: backend-api
tags: [patch-route, products, variants]
key-files:
  modified: [backend/routes/products.js]
  created: []
metrics:
  tasks_completed: 1/1
  commits: 1
  deviations: 0
self_check: PASSED
---

# Plan 02-01 Summary: PATCH /api/products/:id

## What Was Built

Added `PATCH /api/products/:id` route handler to `backend/routes/products.js` (line 236). The handler enables in-place product editing without delete-and-re-add.

**Implementation:**
- `requireOwner` JWT middleware guards the route (401 on missing/invalid token)
- Validates `name` (required), `price` (positive float, stored as paise), at least one valid size
- `VALID_SIZES` allowlist `['XS','S','M','L','XL','XXL','Free Size']` declared locally (scoped inside POST, not module-level)
- Set-based deduplication of sizes runs before `DELETE` to prevent orphaned zero-variant state
- `DELETE FROM product_variants WHERE product_id = ?` then INSERT loop (D-06)
- Zero-stock sizes persisted as valid variants via `Math.max(0, s)` (D-07)
- LEFT JOIN re-fetch + `formatProduct(rows[0], variants)` → 200 JSON response
- `express.json()` confirmed at server.js:48 — no server.js changes needed

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Add PATCH handler | 37dbc4d | feat(02-01): add PATCH /api/products/:id endpoint |

## Deviations

None.

## Self-Check: PASSED

- `grep -c "router.patch" backend/routes/products.js` → 1 ✓
- Handler at line 236 includes `requireOwner` as second argument ✓
- `VALID_SIZES` declared locally inside handler ✓
- `DELETE FROM product_variants` present before INSERT loop ✓
- `formatProduct(rows[0], variants)` called in response ✓
- Handler placed before `module.exports = router` ✓
- `express.json()` already mounted at server.js:48 — no change needed ✓

## Verification (PATCH-01 through PATCH-06)

Manual curl commands from VALIDATION.md — to be run with backend at localhost:9000 and valid owner JWT before marking phase complete.
