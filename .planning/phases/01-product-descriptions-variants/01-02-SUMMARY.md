---
phase: 01-product-descriptions-variants
plan: "02"
subsystem: backend-api, dashboard
tags: [products, variants, description, dashboard, sqlite, left-join]
dependency_graph:
  requires: [01-01 — products.description column and product_variants table]
  provides: [GET /api/products/:id with description and variants, POST /api/products with variant insert, dashboard size/description form]
  affects: [backend/routes/products.js, backend/dashboard/index.html]
tech_stack:
  added: []
  patterns: [LEFT JOIN grouping in JS, multer array normalisation, VALID_SIZES allowlist, FormData sizes[]/stock[] append]
key_files:
  modified:
    - backend/routes/products.js
    - backend/dashboard/index.html
decisions:
  - "LEFT JOIN used (not INNER JOIN) so products with zero variants return one row with variant_id=null, producing variants:[] not 404"
  - "multer single-value normalisation: rawSizes is string when one checkbox, Array.isArray coerces to array"
  - "VALID_SIZES allowlist silently discards unknown sizes (T-01-02-01 threat mitigation)"
  - "stock[] coerced via parseInt+Math.max(0) to prevent negative values (T-01-02-02 threat mitigation)"
  - "sizes validation uses inline #sizes-error element, not alert(), per plan requirement"
  - "toggleStock() uses closest('.size-row') to scope pill styling without querying by ID"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-29"
---

# Phase 01 Plan 02: Products API + Dashboard Variants Summary

**One-liner:** Updated products API to LEFT JOIN variants and return description from DB, and added description textarea + 7 size checkboxes with stock inputs to the owner dashboard form.

## What Changed in backend/routes/products.js

### Change 1: formatProduct() signature

`formatProduct(row)` updated to `formatProduct(row, variants = [])`. The function now reads `row.description || ""` instead of the previous hardcoded `""`. The `variants` parameter replaces the hardcoded `[]`. The list route (`GET /`) continues to call `formatProduct` with one argument — the default `variants = []` ensures backward compatibility.

### Change 2: GET /api/products/:id — LEFT JOIN + row grouping

Replaced the simple `SELECT * FROM products WHERE id = ?` with a LEFT JOIN query:

```sql
SELECT p.*,
       pv.id    AS variant_id,
       pv.size  AS variant_size,
       pv.stock AS variant_stock
FROM   products p
LEFT JOIN product_variants pv ON pv.product_id = p.id
WHERE  p.id = ?
ORDER BY pv.id ASC
```

Returns `.all()` (array). Products with no variants return one row where `variant_id` is null. The JS `.filter(r => r.variant_id != null)` produces `variants = []` for these — they do NOT return 404.

### Change 3: POST /api/products — description + variant insert

1. `description` destructured from `req.body`
2. `sizes[]` and `stock[]` normalised from multer (string vs array)
3. Sizes validation: 400 if no sizes submitted
4. INSERT extended to include `description` column
5. After product insert, loop through `sizes` with `VALID_SIZES` allowlist, insert one `product_variants` row per size
6. Response built using same LEFT JOIN query so new product + variants returned in 201 body

## What Changed in backend/dashboard/index.html

### CSS Variables Added to :root

```css
--cream-warm:#fdf8f3;--border-subtle:#e5e7eb;--error:#c00
```

### HTML Added to form-grid

Two `<div class="full">` blocks inserted after the Collection input and before the closing `</div>` of `form-grid`:

1. **Description textarea** — `id="p-description"`, 4 rows, resizable, optional field
2. **Sizes & stock section** — `id="sizes-container"`, 7 size pills (XS, S, M, L, XL, XXL, Free Size), each with a checkbox (`name="sizes[]"`) and a hidden number input (`name="stock[]"`). A `#sizes-error` paragraph is shown inline when no size is checked.

### JS Added/Updated

**toggleStock(cb)** — new function added before saveProduct(). Shows/hides the stock input for a size pill, and updates the pill border colour and background to indicate selected state.

**saveProduct()** — updated to:
- Collect `description` from `#p-description`
- Query all `input[name="sizes[]"]:checked`
- Show `#sizes-error` (not `alert()`) if no sizes are checked
- Append `description`, `sizes[]`, and `stock[]` to FormData
- On success: reset `#p-description` and uncheck all size checkboxes via `toggleStock(cb)` reset loop

## Verification Results

### Grep Checks (all passed)

| Check | Lines | Result |
|-------|-------|--------|
| `LEFT JOIN product_variants` in products.js | 102, 184 | PASS |
| `INSERT INTO product_variants` in products.js | 174 | PASS |
| `formatProduct(row, variants` in products.js | 41 | PASS |
| `INNER JOIN` in products.js | — | PASS (no matches) |
| `toggleStock` in index.html | 201,206,211,216,221,226,231,422,486 | PASS (9 matches) |
| `id="p-description"` in index.html | 189 | PASS |
| `sizes-error` in index.html | 236, 449 | PASS |
| `sizes[]` in index.html | 7 checkboxes + 3 JS refs | PASS |
| `stock[]` in index.html | 7 inputs + 1 JS ref | PASS |

### Backward Compatibility

- `GET /api/products/` (list) — unchanged; `formatProduct` called with one arg, `variants=[]` default applies
- Products with no variants in DB — LEFT JOIN returns one row with `variant_id=null`, filtered to `variants:[]`, no 404
- Existing products return `description:""` (coerced from NULL in DB per 01-01 decision)

## Deviations from Plan

None — plan executed exactly as written. All three changes to routes/products.js and all four changes to dashboard/index.html were applied without modification. Threat mitigations T-01-02-01 through T-01-02-04 are all present in the implementation.

## Known Stubs

None. The description and variants fields are now read from the database at GET time and written at POST time. No hardcoded empty values remain in the code paths covered by this plan.

## Self-Check

- [x] `backend/routes/products.js` modified — LEFT JOIN, INSERT INTO product_variants, formatProduct(row, variants=) all present
- [x] `backend/dashboard/index.html` modified — toggleStock, p-description, sizes-error all present
- [x] Commit b28a429 exists (Task 1: products.js)
- [x] Commit 68fffff exists (Task 2: index.html)
- [x] No modifications to STATE.md or ROADMAP.md

## Self-Check: PASSED
