# Phase 2: Product Update Endpoint - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a `PATCH /api/products/:id` backend endpoint and an edit UI in the owner dashboard so the owner can update a product's name, price, description, and size variants (add/remove sizes + update stock counts) — without having to delete and re-add the product.

Does NOT include image replacement — image is set at creation time only.

</domain>

<decisions>
## Implementation Decisions

### Edit Trigger UX
- **D-01:** Click anywhere on a product tile opens the edit modal. No separate EDIT button — the whole tile is clickable.
- **D-02:** Edit form appears as a modal overlay with all editable fields pre-filled: name, price, description, and the 7-size pill UI with current variants checked and stock counts filled.
- **D-03 (Claude):** Modal fetches `/api/products/:id` on open to get fresh data including full variant list. Avoids changing the list API shape. The existing GET detail endpoint already returns `{ id, name, price, description, variants: [{id, size, stock}] }`.
- **D-04 (Claude):** After a successful save — close modal, call `loadProducts()` to reload the grid. Consistent with how `saveProduct()` already works.

### Variant Editing Scope
- **D-05:** Full variant editing — owner can add new sizes, remove existing ones, and update stock counts. Same 7-size pill UI as the Add Product form (`XS, S, M, L, XL, XXL, Free Size`), pre-checked for sizes that currently exist.
- **D-06 (Claude):** Backend strategy: `DELETE FROM product_variants WHERE product_id = ?`, then re-INSERT the submitted set. Simpler than diffing; `ON DELETE CASCADE` already exists from Phase 01 schema.
- **D-07:** Sizes with `stock = 0` are shown **checked** in the edit modal. A zero-stock size is still a valid variant (shows as OOS on the product page). Owner can update quantity to restock. Unchecking and saving removes the variant.

### Claude's Discretion
- D-03, D-04, D-06 are Claude's call — user said "you decide" for all three.
- PATCH body format: JSON (not multipart — no image upload in this phase). `Content-Type: application/json`, fields: `name`, `price`, `description`, `sizes` (array), `stock` (array, parallel with sizes).
- Cursor/pointer style on product tiles to signal clickability.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend API
- `backend/routes/products.js` — All product routes. `GET /:id` at line 96 returns full variants via LEFT JOIN. `POST /` pattern shows multer + requireOwner setup. New `PATCH /:id` goes in this file.

### Database Schema
- `backend/db.js` — Full schema. `product_variants` table from Phase 01: `id, product_id (FK→products ON DELETE CASCADE), size, stock`. `products` table has `name, price_paise, category, collection, image_url, description`.

### Auth Middleware
- `backend/middleware/requireOwner.js` — JWT validation for owner-gated routes. Required on PATCH endpoint.

### Owner Dashboard
- `backend/dashboard/index.html` — Single-file dashboard. `renderProducts()` at line 407 generates the product grid tiles (currently: name, meta, price, DELETE button). `loadProducts()` at line 398 fetches and re-renders. `saveProduct()` at line 437 shows the post-save reload pattern. `toggleStock()` at line 422 shows the size pill toggle logic (reuse for edit modal).

### Prior Phase Context
- `.planning/phases/01-product-descriptions-variants/01-CONTEXT.md` — Phase 01 decisions D-01 through D-13. Variant schema and size pool locked here.
- `.planning/ROADMAP.md` — Phase 02 plans: 02-01 (PATCH endpoint), 02-02 (edit form in dashboard).

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `toggleStock(cb)` in `index.html` line 422: shows/hides stock number input per size pill. Reuse directly in the edit modal — same logic, different form context.
- `apiFetch()` in `index.html`: wraps fetch with JWT token header. Use for the PATCH call from the edit modal.
- `loadProducts()` in `index.html` line 398: reloads the grid from API. Call after successful edit save (D-04).
- `GET /api/products/:id` in `routes/products.js` line 96: already returns `{ product: { id, name, price, formattedPrice, price_paise, category, collection, description, variants: [{id, size, stock}] } }`. No changes needed.

### Established Patterns
- `db.prepare().run()/.get()/.all()` — required for all DB operations in routes.
- `requireOwner` middleware — required on all owner-gated routes (import from `../middleware/requireOwner`).
- Price stored in paise: convert `price * 100` on write, `Math.round(price_paise / 100)` on read.
- `formatProduct(row, variants)` helper at line 43 of `products.js`: returns the standard product shape. Reuse for PATCH response.
- Variant insert pattern from `POST /`: `VALID_SIZES` allowlist check + `parseInt(stock)` validation.

### Integration Points
- `PATCH /api/products/:id` in `routes/products.js`: accepts JSON body `{name, price, description, sizes[], stock[]}`, updates `products` row, deletes + re-inserts `product_variants`, returns updated product via `formatProduct()`.
- Edit modal in `index.html` `renderProducts()`: product tiles need `onclick="openEditModal('${id}')"` and cursor:pointer style. New `openEditModal(id)` function fetches product detail and renders modal HTML.
- Modal close + reload: `closeEditModal()` removes modal from DOM; success handler calls `loadProducts()`.

</code_context>

<specifics>
## Specific Ideas

- Edit modal should use same pill UI as the Add Product form — owner already knows it from creating products.
- Sizes with stock=0 shown checked (not unchecked) — avoids accidental variant deletion on re-save.
- No separate "Edit" button on tile — clicking the tile itself is the trigger.

</specifics>

<deferred>
## Deferred Ideas

- Image replacement when editing — ROADMAP scope is name/price/description/stock only. Delete and re-add to change image.
- Bulk stock update (e.g., update stock for all products at once) — future phase.
- Category/collection editing — not mentioned in Phase 02 ROADMAP goal. Could be included but out of stated scope.

</deferred>

---

*Phase: 02-product-update-endpoint*
*Context gathered: 2026-04-29*
