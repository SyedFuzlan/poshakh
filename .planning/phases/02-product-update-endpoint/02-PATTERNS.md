# Phase 2: Product Update Endpoint - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 2 (1 backend route file, 1 dashboard HTML file)
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/routes/products.js` (add `PATCH /:id`) | route/controller | CRUD | `backend/routes/products.js` DELETE `/:id` (lines 204–233) + POST `/` (lines 123–201) | exact — same file, same patterns |
| `backend/dashboard/index.html` (add modal + JS functions) | component/view | request-response | `backend/dashboard/index.html` `toggleStock()` (line 422), `saveProduct()` (line 437), `renderProducts()` (line 407), size-pill HTML (lines 200–234) | exact — same file, same patterns |

---

## Pattern Assignments

### `backend/routes/products.js` — add `PATCH /:id` handler

**Analog A:** `DELETE /:id` handler — lines 204–233 (requireOwner + existence check + DB mutation + error shape)

**Analog B:** `POST /` handler — lines 123–201 (VALID_SIZES allowlist, parseInt stock, variant insert loop, re-fetch + formatProduct response)

---

**Imports pattern** (lines 1–14 — already present, no new imports needed):
```javascript
const express = require("express");
const db = require("../db").db;
const requireOwner = require("../middleware/requireOwner");
const router = express.Router();
```

**Auth guard pattern** (from DELETE `/:id`, lines 204–209):
```javascript
router.delete("/:id", requireOwner, (req, res) => {
  try {
    const row = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Product not found" });
```
Copy `requireOwner` as the second argument to `router.patch()`. Existence check uses `db.prepare().get(req.params.id)` — returns `undefined` when not found, so `if (!row)` triggers the 404.

**Core mutation pattern** (from POST `/`, lines 156–178):
```javascript
// UPDATE products row — price stored in paise
db.prepare(
  `INSERT INTO products (name, price_paise, ...) VALUES (?, ?, ...)`
).run(
  name.trim(),
  Math.round(priceNum * 100),   // paise conversion
  ...
);

// VALID_SIZES allowlist + variant insert loop
const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
sizes.forEach((size, i) => {
  if (!VALID_SIZES.includes(size)) return;  // discard unknowns silently
  const stock = parseInt(stockArr[i] ?? '0', 10);
  db.prepare(
    `INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)`
  ).run(productId, size, isNaN(stock) ? 0 : Math.max(0, stock));
});
```
For PATCH: replace INSERT with UPDATE, then DELETE all variants, then re-run the same insert loop. `VALID_SIZES` must be re-declared inside the PATCH handler — it is `const`-scoped inside the POST handler and is not module-level.

**Re-fetch + response pattern** (from POST `/`, lines 180–195):
```javascript
const newRows = db.prepare(`
  SELECT p.*,
         pv.id    AS variant_id,
         pv.size  AS variant_size,
         pv.stock AS variant_stock
  FROM   products p
  LEFT JOIN product_variants pv ON pv.product_id = p.id
  WHERE  p.id = ?
  ORDER BY pv.id ASC
`).all(productId);

const newVariants = newRows
  .filter(r => r.variant_id != null)
  .map(r => ({ id: String(r.variant_id), size: r.variant_size, stock: r.variant_stock }));

res.status(201).json({ product: formatProduct(newRows[0], newVariants) });
```
For PATCH: same LEFT JOIN query, same variant mapping, return `res.json({ product: formatProduct(...) })` (200, not 201).

**formatProduct helper** (lines 43–59 — already present, no change):
```javascript
function formatProduct(row, variants = []) {
  const priceRupees = Math.round(row.price_paise / 100);
  return {
    id: String(row.id),
    name: row.name,
    price: priceRupees,
    formattedPrice: `₹${priceRupees.toLocaleString("en-IN")}`,
    price_paise: row.price_paise,
    category: row.category,
    collection: row.collection || "",
    images: row.image_url ? [row.image_url] : [],
    image_url: row.image_url || "",
    description: row.description || "",
    variants,
    created_at: row.created_at,
  };
}
```
Call as `formatProduct(rows[0], variants)` — exactly as POST does. No changes to this helper.

**Error handling pattern** (from DELETE `/:id`, lines 229–232):
```javascript
  } catch (err) {
    console.error("DELETE /api/products/:id error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
```
Copy verbatim; change log prefix to `"PATCH /api/products/:id error:"` and message to `"Failed to update product"`.

**Placement:** Append the PATCH handler after line 233 (closing brace of DELETE handler), before `module.exports = router;` on line 235.

---

### `backend/dashboard/index.html` — add edit modal + JS functions

**Analog A:** `toggleStock(cb)` function — line 422–435 (size pill checked/unchecked state management)

**Analog B:** `saveProduct()` function — lines 437–491 (field collection, validation, apiFetch call, post-save reload)

**Analog C:** `renderProducts(products)` function — lines 407–420 (tile HTML generation with esc(), onclick wiring)

**Analog D:** Size-pill HTML block — lines 200–234 (exact pill structure to replicate in modal with `em-` IDs)

**Analog E:** `apiFetch()` helper — lines 526–533 (JSON body + Authorization header)

**Analog F:** `esc()` helper — line 534 (XSS-safe string interpolation into innerHTML)

---

**toggleStock pattern** (lines 422–435 — copy, rename to `emToggleStock`, change ID prefix):
```javascript
function toggleStock(cb) {
  const row = cb.closest('.size-row');
  const stockInput = document.getElementById('stock-' + cb.value);
  if (cb.checked) {
    stockInput.style.display = 'inline-block';
    row.style.borderColor = 'var(--maroon)';
    row.style.background = 'var(--cream-warm)';
  } else {
    stockInput.style.display = 'none';
    stockInput.value = '0';
    row.style.borderColor = 'var(--border-subtle)';
    row.style.background = '#f7f4f0';
  }
}
```
For `emToggleStock`: change `document.getElementById('stock-' + cb.value)` to `document.getElementById('em-stock-' + cb.value)`. All other logic is identical. The `cb.closest('.size-row')` traversal works because both the static pills and the modal pills use the same `class="size-row"` on their wrapper div.

**Size-pill HTML pattern** (lines 200–203 — one pill, replicated for all 7 sizes):
```html
<div class="size-row" style="display:flex;align-items:center;gap:8px;background:#f7f4f0;border:1px solid var(--border-subtle);border-radius:4px;padding:8px 12px">
  <input type="checkbox" id="size-XS" name="sizes[]" value="XS" onchange="toggleStock(this)" style="width:16px;height:16px;accent-color:var(--maroon);cursor:pointer"/>
  <label for="size-XS" style="font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;min-width:36px">XS</label>
  <input type="number" id="stock-XS" name="stock[]" min="0" value="0" placeholder="qty" style="display:none;width:72px;height:32px;border:1px solid #ddd;border-radius:4px;padding:0 8px;font-size:12px;text-align:center"/>
</div>
```
For modal pills, change:
- `id="size-XS"` → `id="em-size-XS"` (or `id="em-size-${esc(sz)}"` when generated in JS)
- `name="sizes[]"` → `name="em-sizes[]"`
- `id="stock-XS"` → `id="em-stock-XS"` (or `id="em-stock-${esc(sz)}"`)
- `name="stock[]"` → omit (stock values read directly by ID in `saveEditModal`)
- `onchange="toggleStock(this)"` → `onchange="emToggleStock(this)"`
- Pre-checked state and stock value set dynamically from `existingSizes` Set and `stockMap` object

**renderProducts tile pattern** (lines 410–419 — tile div needs onclick + cursor style added):
```javascript
// CURRENT tile (lines 411–418):
<div class="product-tile">
  <img src="${esc(p.image_url||'')}" .../>
  <div class="tile-body">
    <div class="tile-name">${esc(p.name)}</div>
    <div class="tile-meta">...</div>
    <div class="tile-price">${esc(p.formattedPrice)}</div>
    <button class="btn-delete" onclick="deleteProduct('${esc(String(p.id))}','${esc(p.name)}')">DELETE</button>
  </div>
</div>

// MODIFIED tile — add onclick + cursor:pointer to the outer div:
<div class="product-tile" onclick="openEditModal('${esc(String(p.id))}')" style="cursor:pointer">
```
The DELETE button's `onclick` already uses `event.stopPropagation()` convention — but since the delete button is nested inside the tile div, clicking DELETE would also fire `openEditModal`. Add `onclick="event.stopPropagation();deleteProduct(...)"` to the DELETE button to prevent the tile click from triggering on delete.

**apiFetch JSON body pattern** (lines 526–533 — used as-is for PATCH call):
```javascript
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { Authorization: 'Bearer ' + token } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(API + path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || r.status);
  return data;
}
// Usage in saveEditModal — pass JSON object as third arg:
await apiFetch('/api/products/' + productId, 'PATCH', {
  name, price, description, sizes: checkedSizes, stock: stockValues
});
```
Do NOT use `FormData` here. The PATCH endpoint uses `express.json()`, not multer.

**saveProduct error + reload pattern** (lines 470–491 — analog for saveEditModal):
```javascript
try {
  const r = await fetch(API + '/api/products', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  alert('✅ Product saved!');
  // reset fields...
  loadProducts();
  loadStats();
} catch(e) { alert('Failed to save product: ' + e.message); }
```
For `saveEditModal`: replace raw `fetch` with `apiFetch(...)`, call `closeEditModal()` then `loadProducts()` on success, keep the `catch(e) { alert(...) }` pattern without closing the modal on error.

**deleteProduct pattern** (lines 493–499 — analog for error-only catch in saveEditModal):
```javascript
async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await apiFetch('/api/products/' + id, 'DELETE');
    loadProducts();
  } catch { alert('Failed to delete product.'); }
}
```
Shows the minimal apiFetch + loadProducts + catch-alert pattern. `saveEditModal` is the same shape but with more field collection before the call.

**esc() helper** (line 534 — already present, use for all modal innerHTML interpolation):
```javascript
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// Apply to every product datum interpolated into modal HTML:
// esc(p.name), esc(p.formattedPrice), esc(String(p.price)), esc(p.description), esc(sz)
```

**Modal overlay CSS baseline** (no existing analog — use research recommendation):
```html
<!-- Inline style on the modal wrapper div injected by openEditModal() -->
position:fixed; top:0; left:0; width:100%; height:100%; z-index:1000;
background:rgba(0,0,0,0.5);  /* backdrop */
```
No existing modal in the codebase; z-index:1000 avoids conflicts with all existing positioned elements.

---

## Shared Patterns

### Authentication Guard
**Source:** `backend/middleware/requireOwner.js` lines 7–24
**Apply to:** `PATCH /:id` handler in `backend/routes/products.js`
```javascript
function requireOwner(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.owner = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
```
Usage: `router.patch('/:id', requireOwner, (req, res) => { ... })` — no change to the middleware itself.

### DB Prepare / Persist
**Source:** `backend/db.js` lines 123–154
**Apply to:** All mutations in the PATCH handler
```javascript
// Every .run() call auto-calls persist() internally:
db.prepare('UPDATE products SET name=?, price_paise=?, description=? WHERE id=?')
  .run(name.trim(), Math.round(priceNum * 100), description || null, id);
// Do NOT call persist() manually — the db wrapper already does it on every .run()
```

### Price Paise Conversion
**Source:** `backend/routes/products.js` lines 44 and 163
**Apply to:** PATCH handler write path
```javascript
// Write: Math.round(priceNum * 100)      — rupees → paise
// Read:  Math.round(row.price_paise / 100) — paise → rupees (inside formatProduct)
```

### XSS Escaping in innerHTML
**Source:** `backend/dashboard/index.html` line 534
**Apply to:** All product data interpolated into modal HTML in `openEditModal()`
```javascript
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
```

### Post-Save Grid Reload
**Source:** `backend/dashboard/index.html` lines 488–489
**Apply to:** `saveEditModal()` success path
```javascript
loadProducts();  // reloads the tile grid from API — same call saveProduct() uses
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Modal overlay HTML/CSS | component | request-response | No existing modals in the dashboard; use `position:fixed; z-index:1000` standard pattern from RESEARCH.md |

---

## ID Collision Map (critical for implementation)

| Static Add Product form ID | Edit modal ID (must use) | Element |
|---|---|---|
| `size-XS` | `em-size-XS` | Size checkbox |
| `stock-XS` | `em-stock-XS` | Stock number input |
| `size-S` … `size-Free Size` | `em-size-S` … `em-size-Free Size` | All 7 size checkboxes |
| `stock-S` … `stock-Free Size` | `em-stock-S` … `em-stock-Free Size` | All 7 stock inputs |
| `p-name` | `em-name` | Product name input |
| `p-price` | `em-price` | Price input |
| `p-description` | `em-description` | Description textarea |

Both forms coexist in the DOM when the Products tab is active. Any shared ID causes `getElementById` to silently return the wrong element.

---

## Metadata

**Analog search scope:** `backend/routes/products.js`, `backend/dashboard/index.html`, `backend/middleware/requireOwner.js`, `backend/db.js`
**Files scanned:** 4
**Pattern extraction date:** 2026-04-30
