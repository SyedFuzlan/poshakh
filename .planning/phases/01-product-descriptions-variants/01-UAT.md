---
status: complete
phase: 01-product-descriptions-variants
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-04-29T18:10:00Z
updated: 2026-04-29T18:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running backend server. Start fresh with `node backend/server.js`. Server boots without errors, DB initializes ("Database ready" or similar), and GET /api/products returns JSON.
result: pass

### 2. Dashboard: Description Field Visible
expected: Open the owner dashboard (localhost:3001 or wherever it runs). The "Add Product" form should have a Description textarea (4 rows, resizable) below the Collection field.
result: pass

### 3. Dashboard: Size Selector with Stock Inputs
expected: In the Add Product form, there are 7 size pills: XS, S, M, L, XL, XXL, Free Size. Clicking a size pill checkbox reveals a stock number input next to it. Unchecking hides the stock input.
result: pass

### 4. Dashboard: Size Validation (inline error)
expected: In the Add Product form, fill in name/price/category but leave ALL size checkboxes unchecked. Click Save. An inline error message appears below the sizes section — NOT a browser alert() popup.
result: pass

### 5. Dashboard: Save Product with Variants
expected: Fill the product form with name, price, category, description, and check at least 2 sizes with stock values. Click Save. Product is created successfully (success message or list refreshes). No console errors.
result: pass
note: Bug found and fixed — multer 2.x strips [] suffix from field names; backend now reads req.body.sizes instead of req.body['sizes[]']

### 6. Product Page: Size Buttons from Real API Data
expected: Open a product detail page (e.g., /products/1). The size selection buttons should show the actual sizes saved for that product — not hardcoded XS/S/M/L/XL. If you saved XL and XXL only, only those two appear.
result: pass

### 7. Product Page: OOS Size Styling
expected: On a product detail page where at least one size has stock=0 and another has stock>0. The out-of-stock size button should appear greyed out (opacity), with strikethrough text, and clicking it should do nothing (disabled).
result: pass

### 8. Product Page: First In-Stock Size Pre-Selected
expected: Open a product detail page with mixed stock. The size that is pre-selected by default should be the first variant that has stock > 0 — not always 'S' or the first size alphabetically.
result: pass

### 9. Product Page: All-OOS Shows "Out of Stock" Button
expected: Open a product detail page for a product where ALL sizes have stock=0 (or no variants at all). The Add to Cart button should be replaced by a disabled "Out of Stock" button. This applies to both the main button and the sticky bar button.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
