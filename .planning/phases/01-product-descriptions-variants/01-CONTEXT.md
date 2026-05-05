# Phase 01: Product Descriptions & Variants - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `description` text and size variants to products: stored in the DB, returned by the API, and displayed correctly on the product detail page. Includes updating the owner dashboard add-product form to capture description + sizes at creation time.

Does NOT include the product edit/update flow — that is Phase 02.

</domain>

<decisions>
## Implementation Decisions

### Variants Storage
- **D-01:** Use a separate `product_variants` table (not JSON in the products column). Standard relational approach — clean, queryable per-size, easy to update stock counts, and extensible for future price-per-variant if needed.
- **D-02:** Schema: `id INTEGER PK, product_id INTEGER FK → products.id, size TEXT NOT NULL, stock INTEGER DEFAULT 0`. Add `UNIQUE(product_id, size)` constraint.

### Size Set
- **D-03:** Sizes are **fully configurable per product**. The owner selects which sizes apply when adding a product.
- **D-04:** Available size pool (fixed, no freeform): `XS`, `S`, `M`, `L`, `XL`, `XXL`, `Free Size`. Covers all Indian fashion garment types.
- **D-05:** The owner dashboard add-product form shows the 7 sizes as checkboxes. Owner checks all that apply. At least one size must be selected.
- **D-06:** Default stock for each selected variant = 0 (owner sets stock manually via Phase 02 edit form or a separate stock field at creation — see D-07).
- **D-07:** At product creation, owner also enters stock per selected size. Simple number input next to each checked size in the add form.

### Out-of-Stock Display
- **D-08:** Out-of-stock variants (stock = 0) show on the product detail page as **greyed out + strikethrough** on the size button. Still visible (customer can see the size exists) but not selectable.
- **D-09:** In-stock variants (stock > 0) are selectable as normal. The first in-stock size is pre-selected by default.
- **D-10:** If ALL variants are out of stock, the "Add to Cart" button is replaced with "Out of Stock" (disabled, non-interactive).

### Description in Owner Add Form
- **D-11:** Include a `description TEXT` textarea in the owner dashboard add-product form in this phase — pragmatic since we're already modifying the schema. Avoids a second migration pass.
- **D-12:** `description` column added to the `products` table. Existing products get `NULL` — rendered as empty string on the frontend (already handled by `formatProduct`).

### Migration for Existing Products
- **D-13:** Existing products in the DB get NO auto-created variants. They remain with `variants: []` until the owner edits them via the Phase 02 update form. Out-of-stock display logic handles the empty state gracefully (shows no size buttons, "Out of Stock" CTA).

### Claude's Discretion
- Variants table exact column order and index strategy
- Whether to cascade-delete variants when a product is deleted (yes — FK with `ON DELETE CASCADE`)
- Dead Medusa cart sync code in `ProductDetailClient.tsx` (lines 43–51) — clean it up as part of this phase since we're touching that file anyway

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current DB Schema
- `backend/db.js` — Full SQLite schema (products, orders, customers tables). The `products` table has no `description` column and no variants table. `formatProduct()` already returns `description: ""` and `variants: []` as empty placeholders.

### Products API
- `backend/routes/products.js` — All product routes. `formatProduct()` helper at line ~35 already stubs `description` and `variants`. `POST /api/products` is where the add form submits.

### Product Detail UI
- `frontend/src/app/products/[id]/ProductDetailClient.tsx` — Product detail page. Renders `{product.description}` at line 149 (accordion). Size selector hardcoded to `['XS', 'S', 'M', 'L', 'XL']` at line 103. `handleAddToCart` looks up `product.variants?.find(v => v.size === selectedSize)` at line 29. Dead Medusa sync at lines 43–51 — remove in this phase.

### Project State
- `PROGRESS.md` (project root) — Canonical current state. Confirms Medusa removed, stack is Express + sql.js SQLite + Next.js 15.
- `.planning/ROADMAP.md` — Phase 01 goal and plan breakdown.

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatProduct()` in `routes/products.js`: already returns `description: ""` and `variants: []` — just needs to be populated from DB
- Size button UI in `ProductDetailClient.tsx` (lines 97–111): already styled, just needs real variant data instead of hardcoded array
- `handleAddToCart` in `ProductDetailClient.tsx`: already handles `variant?.id` lookup — will work once real variants are returned

### Established Patterns
- sql.js wrapper in `db.js`: use `db.prepare().run()` / `.get()` / `.all()` pattern — no raw `_db.run()` calls from routes
- Always call `persist()` after writes (handled by `db.prepare().run()`)
- Owner auth: `requireOwner` middleware from `backend/middleware/requireOwner.js`

### Integration Points
- `POST /api/products` route: needs to accept `description` + `sizes[]` + `stock[]` in the request body (multipart form since it already uses multer for image upload)
- `GET /api/products/:id`: needs to JOIN `product_variants` and return them in the response
- `ProductDetailClient.tsx`: size selector loop (line 103) must switch from hardcoded array to `product.variants` filtered by stock

</code_context>

<specifics>
## Specific Ideas

- **Size pool**: XS, S, M, L, XL, XXL, Free Size — exactly these 7, no freeform text
- **Dashboard add form**: checkboxes for sizes, number input next to each checked size for stock count
- **Size button disabled state**: greyed out + strikethrough text — same button component, just `disabled` + CSS class

</specifics>

<deferred>
## Deferred Ideas

- Stock management UI (bulk update, restocking alerts) — future phase
- Price-per-variant (e.g., custom stitching surcharge) — future phase
- Size guide modal/chart — future phase

</deferred>

---

*Phase: 01-product-descriptions-variants*
*Context gathered: 2026-04-29*
