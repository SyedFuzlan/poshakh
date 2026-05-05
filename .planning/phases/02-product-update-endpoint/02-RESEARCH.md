# Phase 02: Product Update Endpoint - Research

**Researched:** 2026-04-30
**Domain:** Express.js PATCH route, sql.js delete-and-reinsert, vanilla JS modal, owner dashboard
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Click anywhere on a product tile opens the edit modal. No separate EDIT button — the whole tile is clickable.
- **D-02:** Edit form appears as a modal overlay with all editable fields pre-filled: name, price, description, and the 7-size pill UI with current variants checked and stock counts filled.
- **D-03 (Claude):** Modal fetches `/api/products/:id` on open to get fresh data including full variant list. Avoids changing the list API shape. The existing GET detail endpoint already returns `{ id, name, price, description, variants: [{id, size, stock}] }`.
- **D-04 (Claude):** After a successful save — close modal, call `loadProducts()` to reload the grid. Consistent with how `saveProduct()` already works.
- **D-05:** Full variant editing — owner can add new sizes, remove existing ones, and update stock counts. Same 7-size pill UI as the Add Product form (`XS, S, M, L, XL, XXL, Free Size`), pre-checked for sizes that currently exist.
- **D-06 (Claude):** Backend strategy: `DELETE FROM product_variants WHERE product_id = ?`, then re-INSERT the submitted set. Simpler than diffing; `ON DELETE CASCADE` already exists from Phase 01 schema.
- **D-07:** Sizes with `stock = 0` are shown **checked** in the edit modal. A zero-stock size is still a valid variant. Unchecking and saving removes the variant.
- **PATCH body format (Claude):** JSON (not multipart). `Content-Type: application/json`, fields: `name`, `price`, `description`, `sizes` (array), `stock` (array, parallel with sizes).
- **Tile UX (Claude):** cursor:pointer style on tiles; `onclick="openEditModal('${id}')"` on tile div.

### Claude's Discretion

- D-03, D-04, D-06 are Claude's call.
- PATCH body format — JSON.
- Cursor/pointer style on tiles.
- Modal HTML structure — reuse existing CSS classes where possible.
- ID namespacing for modal form elements (prefix `em-` to avoid conflicts with Add Product form IDs).

### Deferred Ideas (OUT OF SCOPE)

- Image replacement when editing — delete and re-add to change image.
- Bulk stock update — future phase.
- Category/collection editing — out of Phase 02 scope.
</user_constraints>

---

## Summary

Phase 02 adds exactly two artefacts: a `PATCH /api/products/:id` Express route handler (Plan 02-01) and an edit modal in the owner dashboard's single HTML file (Plan 02-02). No new libraries. No schema changes. No frontend Next.js work.

The backend route follows the exact same pattern as `DELETE /api/products/:id` (uses `requireOwner` middleware, `db.prepare().get()` for existence check, `db.prepare().run()` for mutations, `persist()` automatic after each `.run()` call). The only new complexity is parsing a JSON body with parallel `sizes[]` and `stock[]` arrays — Express's built-in `express.json()` middleware is already mounted in the app, so `req.body` will be parsed.

The dashboard modal follows the `toggleStock()` + pill UI pattern already in place for the Add Product form. The critical implementation detail is ID-namespacing: the modal must use distinct element IDs (e.g., `em-name`, `em-stock-XS`) so they do not collide with the static Add Product form's IDs (`p-name`, `stock-XS`).

**Primary recommendation:** Plan 02-01 first (backend endpoint), test it with curl/Postman, then plan 02-02 (UI). Both plans are self-contained. No wave blocking is needed if test environment is available.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Validate + persist product field updates | Backend (Express route) | — | All writes go through `routes/products.js` |
| Delete + re-insert variants | Backend (Express route) | — | DB mutation belongs in route, not client |
| Auth guard on PATCH | Backend middleware | — | `requireOwner` JWT middleware pattern already established |
| Parse JSON PATCH body | Backend (Express.json()) | — | `express.json()` already mounted at app level |
| Modal open / close | Browser (vanilla JS in dashboard HTML) | — | `index.html` owns all dashboard interaction |
| Pre-fill modal fields from API | Browser (vanilla JS) | Backend (GET /api/products/:id) | JS calls existing endpoint; backend already returns full shape |
| Size pill pre-check + stock pre-fill | Browser (vanilla JS) | — | `toggleStock()` reusable; modal init sets checked state |
| Grid reload after save | Browser (vanilla JS) | — | `loadProducts()` already exists |

---

## Standard Stack

### Core (all already in project — no installs needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| express | Already installed | HTTP routing, `express.json()` body parsing | `express.json()` middleware must be mounted before route — verify in `app.js`/`server.js` [VERIFIED: codebase read] |
| sql.js | Already installed | Synchronous SQLite via `db.prepare().run()/.get()/.all()` | `persist()` called automatically on every `.run()` [VERIFIED: db.js read] |
| jsonwebtoken | Already installed | JWT verify in `requireOwner` middleware | Used as-is; no changes needed [VERIFIED: requireOwner.js read] |

### Supporting

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| multer | Already installed | NOT used on PATCH route — body is JSON | POST route uses multer; PATCH skips it entirely |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Delete-all + re-insert for variants | Diff algorithm (insert new, update existing, delete removed) | Diff is correct but ~4x more code. Delete+re-insert is safe because `UNIQUE(product_id, size)` prevents duplicates and `ON DELETE CASCADE` exists. |
| JSON body | multipart/form-data | multipart needed for file uploads; PATCH has no image, so JSON is simpler and avoids multer setup |
| Fetch fresh data on modal open | Reuse list data already rendered in tiles | List API (`GET /api/products`) omits variants (uses `formatProduct(row, [])`). Modal needs variants → must fetch `GET /api/products/:id`. |

**Installation:** None required. All dependencies already in `backend/package.json`.

---

## Architecture Patterns

### System Architecture Diagram

```
Owner clicks product tile
        |
        v
openEditModal(id)
        |
        +--> GET /api/products/:id  ──>  Express route (line 96)
        |           |                         |
        |           v                         v
        |    { product: {              LEFT JOIN products + product_variants
        |      name, price,            formatProduct(row, variants)
        |      description,
        |      variants: [{id,size,stock}]
        |    }}
        |
        v
Render modal HTML (pre-filled inputs, checked size pills)
        |
        v
Owner edits fields, clicks SAVE
        |
        v
saveEditModal(id)
        |
        +--> PATCH /api/products/:id  (JSON body: {name,price,description,sizes[],stock[]})
        |           |
        |           v
        |    requireOwner  ──[401 if no/bad JWT]──>  stop
        |           |
        |           v
        |    GET product row (404 if not found)
        |           |
        |           v
        |    UPDATE products SET name=?,price_paise=?,description=? WHERE id=?
        |           |
        |           v
        |    DELETE FROM product_variants WHERE product_id=?
        |           |
        |           v
        |    INSERT product_variants (for each valid size in submitted set)
        |           |
        |           v
        |    Re-fetch product + variants  -->  formatProduct()  -->  200 JSON
        |
        v
closeEditModal()  +  loadProducts()
```

### Recommended Project Structure

No structural changes required. Both artefacts land in existing files:

```
backend/
├── routes/products.js      # PATCH handler appended before module.exports
├── middleware/requireOwner.js  # no change
└── dashboard/index.html    # modal CSS + openEditModal() + saveEditModal() + closeEditModal() appended
```

### Pattern 1: PATCH Route Handler (Express + sql.js)

**What:** Validates JSON body, updates `products` row, deletes + re-inserts `product_variants`, returns updated product.

**When to use:** Any owner-gated write that needs no file upload.

```javascript
// Source: derived from existing POST /api/products pattern in routes/products.js
router.patch('/:id', requireOwner, (req, res) => {
  try {
    const { name, price, description, sizes, stock: stockArr } = req.body;

    // 1. Existence check
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    // 2. Validate required fields
    if (!name || !price) return res.status(400).json({ error: 'name and price are required' });
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) return res.status(400).json({ error: 'price must be a positive number' });

    // 3. Validate sizes
    const sizesArr = Array.isArray(sizes) ? sizes : (sizes ? [sizes] : []);
    const stockList = Array.isArray(stockArr) ? stockArr : (stockArr ? [stockArr] : []);
    if (!sizesArr.length) return res.status(400).json({ error: 'At least one size is required' });

    // 4. Update products row
    db.prepare(
      'UPDATE products SET name = ?, price_paise = ?, description = ? WHERE id = ?'
    ).run(name.trim(), Math.round(priceNum * 100), (description || '').trim() || null, req.params.id);

    // 5. Delete + re-insert variants
    db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(req.params.id);
    const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
    sizesArr.forEach((size, i) => {
      if (!VALID_SIZES.includes(size)) return;
      const s = parseInt(stockList[i] ?? '0', 10);
      db.prepare('INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)').run(
        req.params.id, size, isNaN(s) ? 0 : Math.max(0, s)
      );
    });

    // 6. Re-fetch + respond
    const rows = db.prepare(`
      SELECT p.*, pv.id AS variant_id, pv.size AS variant_size, pv.stock AS variant_stock
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      WHERE p.id = ? ORDER BY pv.id ASC
    `).all(req.params.id);
    const variants = rows.filter(r => r.variant_id != null)
      .map(r => ({ id: String(r.variant_id), size: r.variant_size, stock: r.variant_stock }));
    res.json({ product: formatProduct(rows[0], variants) });
  } catch (err) {
    console.error('PATCH /api/products/:id error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});
```

**Key details verified:**
- `db.prepare().run()` automatically calls `persist()` on each write [VERIFIED: db.js lines 126-135]
- `formatProduct()` already exists at line 43 of products.js — reuse exactly [VERIFIED: products.js read]
- `VALID_SIZES` constant must be duplicated inside PATCH handler (it is locally scoped in POST handler) [VERIFIED: products.js lines 171-177]

### Pattern 2: Modal with Pre-filled Size Pills (Vanilla JS)

**What:** `openEditModal(id)` fetches fresh product data, builds modal HTML with checked pills, appends to body.

**When to use:** Any dashboard interaction that needs a temporary overlay form.

```javascript
// Source: derived from toggleStock() and renderProducts() in dashboard/index.html
async function openEditModal(productId) {
  // Fetch fresh data (D-03)
  const data = await apiFetch('/api/products/' + productId);
  const p = data.product;
  const existingSizes = new Set(p.variants.map(v => v.size));
  const stockMap = Object.fromEntries(p.variants.map(v => [v.size, v.stock]));

  const SIZES = ['XS','S','M','L','XL','XXL','Free Size'];
  const pillsHtml = SIZES.map(sz => {
    const checked = existingSizes.has(sz) ? 'checked' : '';
    const stockVal = stockMap[sz] ?? 0;
    const display = existingSizes.has(sz) ? 'inline-block' : 'none';
    // em- prefix avoids ID collision with Add Product form (stock-XS etc.)
    return `<div class="size-row" id="em-row-${esc(sz)}" style="display:flex;align-items:center;gap:8px;background:${checked?'var(--cream-warm)':'#f7f4f0'};border:1px solid ${checked?'var(--maroon)':'var(--border-subtle)'};border-radius:4px;padding:8px 12px">
      <input type="checkbox" id="em-size-${esc(sz)}" name="em-sizes[]" value="${esc(sz)}" ${checked} onchange="emToggleStock(this)" style="width:16px;height:16px;accent-color:var(--maroon);cursor:pointer"/>
      <label for="em-size-${esc(sz)}" style="font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;min-width:36px">${esc(sz)}</label>
      <input type="number" id="em-stock-${esc(sz)}" min="0" value="${stockVal}" placeholder="qty" style="display:${display};width:72px;height:32px;border:1px solid #ddd;border-radius:4px;padding:0 8px;font-size:12px;text-align:center"/>
    </div>`;
  }).join('');
  // ... append modal to document.body
}
```

**Key detail:** Use `em-` ID prefix on all modal form elements to avoid collision with the static Add Product form's `p-name`, `stock-XS`, etc. IDs. Both forms exist in the DOM simultaneously when the products tab is visible.

### Anti-Patterns to Avoid

- **Re-using stock-XS IDs in the modal:** The Add Product form has `id="stock-XS"` hardcoded in the static HTML. If the modal uses the same ID, `document.getElementById('stock-XS')` becomes ambiguous. Always use `em-` prefix.
- **Calling multer on PATCH:** PATCH body is JSON. Putting `upload.single()` middleware on PATCH will cause multer to fail parsing (it expects multipart). Route must be `router.patch('/:id', requireOwner, handler)` — no multer.
- **Not calling persist() explicitly:** `db.prepare().run()` already calls `persist()` internally via the `db` wrapper (verified in db.js). Do NOT call `persist()` manually — it will double-write.
- **Diffing variants instead of delete-all:** Diffing requires three separate queries and tracking new/updated/deleted sets. Delete-all is safe because `UNIQUE(product_id, size)` is enforced at insert time and is simpler to verify correct.
- **Using `req.body.sizes[]` syntax for JSON:** With JSON body parsing, repeated keys are not supported. The client must send `{"sizes": ["XS","M"], "stock": [10,5]}` (arrays in JSON object). The `sizes[]` bracket notation is a multipart/form-data convention only.
- **Stopping on image cleanup errors in DELETE:** The existing DELETE handler already demonstrates this pattern (catch block swallows image errors). PATCH has no image concerns at all.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT validation on PATCH | Custom token check | `requireOwner` middleware | Already written, tested, consistent |
| Product response shape | Custom serializer | `formatProduct(row, variants)` | Already returns correct API shape; reuse at line 43 |
| Size allowlist | Custom validator | `VALID_SIZES` constant + `.includes()` filter | Already used in POST; copy the same pattern |
| Paise conversion | Custom currency util | `Math.round(priceNum * 100)` on write; `Math.round(price_paise / 100)` on read | Already established in formatProduct + POST handler |
| Persist to disk | Manual `_db.export()` | `db.prepare().run()` (auto-persists) | db.js wrapper calls `persist()` on every `.run()` call |
| XSS in modal HTML | DOMPurify or similar | `esc()` helper already in index.html (line 534) | Same helper used in renderProducts; use for all interpolated strings in modal HTML |

**Key insight:** This phase is nearly entirely reuse. Every pattern needed — auth middleware, DB wrapper, response shape, size validation, price conversion, XSS escaping, post-save reload — already exists. The only new code is wiring them together in PATCH form.

---

## Common Pitfalls

### Pitfall 1: ID Collision Between Modal and Add Product Form

**What goes wrong:** Modal uses `id="stock-XS"` (same as the static Add Product form). `document.getElementById('stock-XS')` returns the first match, corrupting state in one of the two forms.

**Why it happens:** Both forms exist in the DOM at the same time when the Products tab is active.

**How to avoid:** All modal-injected element IDs must use the `em-` prefix (e.g., `em-name`, `em-price`, `em-stock-XS`). The toggle helper for the modal (`emToggleStock`) must reference `em-stock-${cb.value}`, not `stock-${cb.value}`.

**Warning signs:** After opening the edit modal, interacting with the Add Product form's size pills behaves incorrectly — or vice versa.

---

### Pitfall 2: express.json() Not Mounted Before Route

**What goes wrong:** `req.body` is `undefined` on PATCH calls. Validation fails with misleading "name and price are required" error even when the client sends them.

**Why it happens:** `express.json()` middleware must be registered before the route in the Express app setup.

**How to avoid:** Verify `app.use(express.json())` appears in the main app/server file before `app.use('/api/products', productRouter)`. If it is absent, add it.

**Warning signs:** `req.body` is `undefined` or `{}` in the PATCH handler even when curl sends `Content-Type: application/json`.

---

### Pitfall 3: Sending FormData Instead of JSON from Modal

**What goes wrong:** Modal submit uses `FormData` (like `saveProduct()`), which sends `multipart/form-data`. Express's JSON parser does not parse multipart, so `req.body` is `{}`.

**Why it happens:** Developer copies `saveProduct()` logic which uses FormData for the image upload.

**How to avoid:** PATCH modal submit must use `apiFetch('/api/products/' + id, 'PATCH', { name, price, description, sizes, stock })` where `apiFetch` sends JSON (it already sets `Content-Type: application/json` when a body is passed — verified at index.html line 528).

**Warning signs:** Server returns `{ error: "name and price are required" }` despite form fields being filled.

---

### Pitfall 4: Variant Delete Runs But Transaction Does Not Rollback on Insert Failure

**What goes wrong:** `DELETE FROM product_variants` succeeds, then an `INSERT` fails (e.g., due to UNIQUE constraint violation on a re-submitted duplicate size). Product is left with zero variants.

**Why it happens:** sql.js does not auto-wrap multiple statements in a transaction. Each `db.prepare().run()` is committed independently.

**How to avoid:** Validate `sizes` array for duplicates before the DELETE. The VALID_SIZES allowlist filter already prevents unknown sizes; also check for duplicates with a Set before beginning mutations.

**Warning signs:** After a failed PATCH, the product has no variants when viewed in the edit modal.

---

### Pitfall 5: apiFetch Throws on 4xx — Modal Save Silently Fails

**What goes wrong:** `apiFetch` throws an Error on non-ok responses (line 531). If the save handler does not catch it, the modal does not close and the user sees nothing.

**Why it happens:** `saveEditModal()` must wrap `apiFetch` in try/catch and show an alert on failure.

**How to avoid:** Use the same try/catch pattern as `saveProduct()` and `deleteProduct()` — catch, alert with error message, do not close modal.

**Warning signs:** Clicking SAVE in edit modal appears to do nothing on validation failure.

---

## Code Examples

### Verified — apiFetch with JSON body (PATCH call from modal)

```javascript
// Source: dashboard/index.html line 526-532 (apiFetch function, verified)
// apiFetch already handles JSON body when body param is provided:
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { Authorization: 'Bearer ' + token } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(API + path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || r.status);
  return data;
}
// Usage in saveEditModal:
await apiFetch('/api/products/' + productId, 'PATCH', {
  name, price, description, sizes: checkedSizes, stock: stockValues
});
```

### Verified — db.prepare() pattern for UPDATE + DELETE + INSERT sequence

```javascript
// Source: db.js lines 124-154 (db wrapper), products.js lines 156-177 (POST handler pattern)
// UPDATE
db.prepare('UPDATE products SET name=?, price_paise=?, description=? WHERE id=?')
  .run(name.trim(), Math.round(priceNum * 100), description || null, productId);

// DELETE all variants
db.prepare('DELETE FROM product_variants WHERE product_id=?').run(productId);

// INSERT each submitted size (with VALID_SIZES allowlist guard)
const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
sizes.forEach((size, i) => {
  if (!VALID_SIZES.includes(size)) return;
  const s = parseInt(stock[i] ?? '0', 10);
  db.prepare('INSERT INTO product_variants (product_id, size, stock) VALUES (?,?,?)')
    .run(productId, size, isNaN(s) ? 0 : Math.max(0, s));
});
```

### Verified — esc() XSS helper (must use in all modal HTML interpolation)

```javascript
// Source: dashboard/index.html line 534 (verified)
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// Use for every piece of product data interpolated into modal innerHTML:
// esc(p.name), esc(p.formattedPrice), esc(sz), etc.
```

### Verified — formatProduct() response shape returned by PATCH

```javascript
// Source: products.js lines 43-59 (verified)
// PATCH handler re-fetches with LEFT JOIN and calls formatProduct(rows[0], variants)
// Response shape:
{
  product: {
    id: String,       // stringified integer
    name: String,
    price: Number,    // in rupees (integer)
    formattedPrice: String,   // e.g. "₹5,999"
    price_paise: Number,
    category: String,
    collection: String,
    images: [String],
    image_url: String,
    description: String,
    variants: [{ id: String, size: String, stock: Number }],
    created_at: String
  }
}
```

### Verified — GET /api/products/:id response (modal data source)

```javascript
// Source: products.js lines 96-120 (verified)
// Returns full variant list — safe to use as modal data source without API changes:
{
  product: {
    // same shape as above
    variants: [{ id: '1', size: 'M', stock: 10 }, ...]
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Medusa.js managed products | Express + sql.js (Phase 01 complete) | Medusa fully removed; backend is custom Express |
| No product editing | Delete + re-add to change anything | Phase 02 adds in-place editing |
| POST uses multipart/FormData | PATCH uses JSON body | JSON simpler when no file upload needed |

**Deprecated/outdated:**
- Medusa `lineItems` sync code in `ProductDetailClient.tsx` was already removed in Phase 01 (Plan 03). No Medusa artifacts in products.js or dashboard.

---

## Runtime State Inventory

This is not a rename/refactor phase. No runtime state inventory is needed.

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Node.js / Express | PATCH route | Yes | Backend is running (Phase 01 complete) |
| sql.js SQLite | DB operations | Yes | Already in backend/package.json |
| jsonwebtoken | requireOwner middleware | Yes | Already in backend/package.json |
| `express.json()` middleware | JSON body parsing in PATCH | Verify in app setup | Must be mounted before route registration |

**Action required:** Verify `app.use(express.json())` is present in the backend's main entry file before `/api/products` route is registered. This is a pre-implementation check, not an install step.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual curl / browser testing (no automated test suite in this project) |
| Config file | none |
| Quick run command | `curl -s -X PATCH http://localhost:4000/api/products/:id -H 'Authorization: Bearer TOKEN' -H 'Content-Type: application/json' -d '{...}'` |
| Full suite command | Manual browser UAT (see UAT checklist below) |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Command / Method |
|-----|----------|-----------|-----------------|
| PATCH-01 | `PATCH /api/products/:id` updates name, price, description | Manual curl | `curl -X PATCH .../api/products/1 -H 'Authorization: Bearer TOKEN' -H 'Content-Type: application/json' -d '{"name":"Updated","price":999,"description":"desc","sizes":["M"],"stock":[5]}'` → expect 200 with updated product |
| PATCH-02 | PATCH replaces variants (delete + re-insert) | Manual curl | Send `sizes:["M","L"]`, verify response contains only M and L variants |
| PATCH-03 | PATCH with zero-stock size still creates variant | Manual curl | Send `sizes:["XS"]`, `stock:[0]` → variant with stock=0 should exist in response |
| PATCH-04 | PATCH returns 401 without valid JWT | Manual curl | Omit Authorization header → expect `{"error":"Not authenticated"}` |
| PATCH-05 | PATCH returns 404 for nonexistent product ID | Manual curl | Use `id=99999` → expect `{"error":"Product not found"}` |
| PATCH-06 | PATCH returns 400 when no sizes submitted | Manual curl | Send `sizes:[]` → expect `{"error":"At least one size is required"}` |
| UI-01 | Clicking tile opens pre-filled edit modal | Browser | Open dashboard → Products tab → click any tile → modal appears with product data |
| UI-02 | Sizes with stock=0 appear checked in modal | Browser | Add product with stock=0 size → open edit modal → that size pill is checked |
| UI-03 | Save closes modal and reloads grid | Browser | Edit a product name → save → modal closes, grid shows updated name |
| UI-04 | Cancel/close dismisses modal without saving | Browser | Open modal → click close → no changes persisted |
| UI-05 | Saving with no sizes checked shows validation error | Browser | Uncheck all sizes → click save → error shown, modal stays open |

### Sampling Rate

- **Per task commit (02-01):** Run PATCH-01 through PATCH-06 curl commands
- **Per task commit (02-02):** Run UI-01 through UI-05 browser checks
- **Phase gate:** All 11 test cases passing before marking Phase 02 complete

### Wave 0 Gaps

None — no automated test infrastructure needed. Curl and browser are sufficient for this stack.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `requireOwner` JWT middleware — already established |
| V3 Session Management | No | PATCH is stateless (JWT Bearer token) |
| V4 Access Control | Yes | PATCH is owner-only; `requireOwner` enforces this |
| V5 Input Validation | Yes | `VALID_SIZES` allowlist, `parseFloat(price)` with NaN guard, `parseInt(stock)` with NaN guard, `Math.max(0, stock)` floor |
| V6 Cryptography | No | JWT secret already in env; no new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated PATCH (any user edits any product) | Elevation of Privilege | `requireOwner` middleware verifies JWT before handler runs |
| Price injection (negative price, NaN) | Tampering | `parseFloat` + `isNaN` + `priceNum > 0` guard before storing |
| Unknown size injection (e.g., `"XXXL"`, `"<script>"`) | Tampering | `VALID_SIZES.includes(size)` filter discards any non-allowlisted size |
| Stock injection (negative values, NaN) | Tampering | `parseInt` + `isNaN` + `Math.max(0, stock)` clamps to non-negative integer |
| XSS via product name in modal innerHTML | XSS | `esc()` helper must wrap all product data interpolated into modal HTML |
| IDOR (edit another user's product) | Elevation of Privilege | Single-owner system — no user-specific product ownership; all authenticated owners can edit any product (by design for this single-owner app) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `express.json()` middleware is already mounted in the backend app entry file | Environment Availability | PATCH `req.body` will be `undefined`; route returns 400 for all valid requests. Fix: add `app.use(express.json())` in app setup. |
| A2 | Dashboard `index.html` is served from the same Express server (same origin as API) | Standard Stack | `apiFetch` uses relative paths (`API = ''`); if dashboard is on a different port, CORS headers would be needed. |

**A1 should be verified** as the first step of Plan 02-01 execution.

---

## Open Questions

1. **Is `express.json()` already mounted?**
   - What we know: The backend uses Express; `routes/products.js` uses `req.body` in POST routes, but POST uses multipart (multer parses it). JSON body parsing may not be configured.
   - What's unclear: Whether the main app file includes `app.use(express.json())`.
   - Recommendation: Plan 02-01 should include "verify/add `express.json()` middleware" as Step 0 before writing the PATCH handler.

2. **Modal z-index / stacking context**
   - What we know: The dashboard has no existing modals — no z-index conventions established.
   - What's unclear: Whether any positioned elements in the dashboard create a stacking context that would clip a fixed-position modal.
   - Recommendation: Use `position:fixed; top:0; left:0; width:100%; height:100%; z-index:1000` on the modal overlay. This is the standard approach for single-page overlays.

---

## Sources

### Primary (HIGH confidence — verified by codebase read)

- `backend/routes/products.js` — Route patterns, `formatProduct()`, `VALID_SIZES`, `requireOwner` usage, response shapes
- `backend/db.js` — `db.prepare().run()/.get()/.all()` wrapper, `persist()` auto-call behavior, sql.js schema
- `backend/middleware/requireOwner.js` — JWT verification pattern, `req.owner` payload
- `backend/dashboard/index.html` — `toggleStock()`, `apiFetch()`, `loadProducts()`, `renderProducts()`, `esc()`, size pill HTML structure, ID naming conventions

### Secondary (MEDIUM confidence — standard Express.js behavior)

- `express.json()` middleware: standard Express 4.x body parsing for `application/json` requests [ASSUMED standard behavior; A1 requires verification]

### Tertiary (LOW confidence)

- None — all claims in this research are verified from codebase reads.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in codebase, versions verified by presence
- Architecture: HIGH — full codebase read; all patterns directly observed
- Pitfalls: HIGH — derived from actual ID conflicts observable in existing HTML and actual db.js wrapper behavior
- Security: HIGH — threat patterns match the stack directly read from source

**Research date:** 2026-04-30
**Valid until:** Stable — this is a closed codebase. Valid until next code change to `routes/products.js`, `db.js`, or `dashboard/index.html`.
