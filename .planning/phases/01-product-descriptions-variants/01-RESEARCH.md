# Phase 01: Product Descriptions & Variants - Research

**Researched:** 2026-04-29
**Domain:** Express/sql.js schema migration, multer multipart arrays, Next.js ISR, Zustand cart
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Separate `product_variants` table (not JSON)
- **D-02:** Schema: `id INTEGER PK, product_id INTEGER FK → products.id, size TEXT NOT NULL, stock INTEGER DEFAULT 0` + `UNIQUE(product_id, size)` constraint + `ON DELETE CASCADE`
- **D-03:** Sizes are fully configurable per product
- **D-04:** Available size pool: `XS`, `S`, `M`, `L`, `XL`, `XXL`, `Free Size`
- **D-05:** Dashboard add-product form shows 7 sizes as checkboxes — owner checks all that apply; at least one required
- **D-06:** Default stock per variant = 0; owner sets at creation via number input
- **D-07:** Stock per size entered at product creation time
- **D-08:** Out-of-stock variants (stock = 0) → greyed out + strikethrough on size button; still visible
- **D-09:** In-stock variants (stock > 0) selectable; first in-stock size pre-selected by default
- **D-10:** All variants OOS → "Add to Cart" replaced with "Out of Stock" (disabled)
- **D-11:** `description TEXT` textarea added to dashboard add-product form in this phase
- **D-12:** `description TEXT` column added to `products` table; existing rows get NULL
- **D-13:** Existing products get NO auto-created variants; they remain `variants: []`

### Claude's Discretion
- Variants table column order and index strategy
- FK with `ON DELETE CASCADE` (yes)
- Clean up dead Medusa cart sync code in `ProductDetailClient.tsx` (lines 43–51)

### Deferred Ideas (OUT OF SCOPE)
- Stock management UI (bulk update, restocking alerts)
- Price-per-variant
- Size guide modal/chart
- Product edit/update flow (Phase 02)
</user_constraints>

---

## Summary

This phase adds two database columns/tables (`description` on `products`, `product_variants` table), updates one API route (`GET /api/products/:id`), updates one write route (`POST /api/products`), and updates the product detail UI and the owner dashboard form. All five touch points are small and well-bounded.

The stack is Express + sql.js (synchronous in-memory SQLite) + Next.js 15 App Router + vanilla JS dashboard HTML. No new libraries are needed for this phase. All patterns required already exist in the codebase — `db.prepare().run()` for writes, `db.prepare().all()` for reads, `formatProduct()` for shaping API responses, and the size button loop in `ProductDetailClient.tsx` for the UI.

The key research questions resolve cleanly: sql.js supports `ALTER TABLE ADD COLUMN` (it runs SQLite 3.49 under the hood); multer `.single()` passes all non-file multipart fields through `req.body` including repeated-name fields as arrays when using `fd.append()` multiple times; the ISR cache uses `revalidate: 60` which means stale data for up to 60 seconds — acceptable for this phase since no on-demand invalidation is needed; and the Zustand cart already has `variantId?: string` on `CartItem` so no store changes are required.

**Primary recommendation:** Follow the three-plan breakdown in ROADMAP exactly (DB → API → UI). No surprises or rework risk.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DB schema migration (description + variants table) | Backend (Node/sql.js) | — | Schema lives in `db.js` `initDb()` |
| Persist variants at product creation | Backend (Express route) | — | `POST /api/products` owns writes |
| Serve variants + description per product | Backend (Express route) | — | `GET /api/products/:id` owns reads |
| Shape API response (formatProduct) | Backend (Express route) | — | `formatProduct()` helper in `routes/products.js` |
| Display description + size selector | Frontend (Next.js Client Component) | — | `ProductDetailClient.tsx` is already a `"use client"` component |
| Out-of-stock UI logic | Frontend (Client Component) | — | React state (`selectedSize`) + derived rendering |
| Dashboard add-product form (sizes + stock) | Dashboard (vanilla JS HTML) | — | Single-file `backend/dashboard/index.html` |
| Cart item with variantId | Frontend (Zustand store) | — | Already typed; no store change needed |

---

## Standard Stack

### Core (no new installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js | 1.14.1 | SQLite in-memory DB | Already in use; supports ALTER TABLE ADD COLUMN |
| express | 5.2.1 | HTTP server + routing | Already in use |
| multer | 2.1.1 | Multipart form parsing | Already in use for image upload |
| Next.js | 16.2.4 | Frontend SSR + ISR | Already in use |
| zustand | 5.0.12 | Frontend state (cart) | Already in use; CartItem already has variantId |

**Installation:** No new packages needed for this phase.

**Version note:** `npm view sql.js version` returned `1.14.1` [VERIFIED: npm registry]. `npm view multer version` returned `2.1.1` [VERIFIED: npm registry]. `npm view express version` returned `5.2.1` [VERIFIED: npm registry].

---

## Architecture Patterns

### System Architecture Diagram

```
Owner Dashboard (POST /api/products)
  → FormData: name, price, category, collection, description,
              fd.append('sizes[]', 'S'), fd.append('sizes[]', 'M'), ...
              fd.append('stock[]', '10'), fd.append('stock[]', '5'), ...
              image file
         |
         v
Express POST /api/products
  → multer.single('image') → req.file (image), req.body (all text fields)
  → req.body.sizes = 'S' OR ['S','M'] (string or array — must normalise)
  → req.body.stock = '10' OR ['10','5'] (string or array — must normalise)
  → INSERT INTO products (name, price_paise, category, collection, description, image_url)
  → for each size: INSERT INTO product_variants (product_id, size, stock)
  → respond 201 with formatProduct(newRow, variants)
         |
         v
GET /api/products/:id
  → SELECT products.*, pv.id AS v_id, pv.size, pv.stock
    FROM products
    LEFT JOIN product_variants pv ON pv.product_id = products.id
    WHERE products.id = ?
  → group variant rows onto product shape
  → formatProduct(row, variantRows) → { id, name, description, variants: [{id, size, stock}], ... }
         |
         v
Next.js getProductById (lib/products.ts)
  → fetch(`/api/products/${id}`, { next: { revalidate: 60 } })
  → mapProduct() passes through description and variants as-is
         |
         v
ProductDetailClient.tsx
  → variants = product.variants (from API, replacing hardcoded ['XS','S','M','L','XL'])
  → initialSelectedSize = variants.find(v => v.stock > 0)?.size ?? null
  → size buttons rendered from variants array
  → OOS button: opacity-50 + line-through + disabled + cursor-not-allowed
  → allOOS = variants.every(v => v.stock === 0) → show "Out of Stock" CTA
  → handleAddToCart: variant lookup already works (finds by size, reads v.id as variantId)
  → dead Medusa sync block (lines 43–51) removed
```

### Recommended Project Structure
No structural changes. All edits are in existing files:
```
backend/
├── db.js                              # Add description col + variants table to initDb()
├── routes/products.js                 # Update formatProduct(), GET /:id, POST /
└── dashboard/index.html               # Add description textarea + size checkboxes

frontend/src/
├── app/products/[id]/ProductDetailClient.tsx   # Rewire size selector + OOS logic
└── types/index.ts                              # Add stock: number to variants type (optional)
```

### Pattern 1: sql.js Schema Migration via `IF NOT EXISTS` + `ALTER TABLE`

**What:** sql.js runs `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN` synchronously inside `initDb()`. Both run every server start and are idempotent when guarded.

**When to use:** Adding new tables (use `CREATE TABLE IF NOT EXISTS`). Adding columns to existing tables (use `ALTER TABLE ... ADD COLUMN` guarded with a try/catch since SQLite throws if column already exists).

**Example:**
```javascript
// Source: SQLite docs + existing db.js pattern [VERIFIED: sqlite.org/lang_altertable.html]

// New table — safe to run every time
_db.run(`
  CREATE TABLE IF NOT EXISTS product_variants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size       TEXT    NOT NULL,
    stock      INTEGER NOT NULL DEFAULT 0,
    UNIQUE(product_id, size)
  )
`);

// New column on existing table — must guard: SQLite throws if column exists
try {
  _db.run(`ALTER TABLE products ADD COLUMN description TEXT`);
} catch (_) {
  // Column already exists — ignore
}
```

**Critical detail:** `ALTER TABLE ADD COLUMN` in SQLite (and therefore sql.js) is supported only when the new column has a default value OR is nullable (TEXT with no DEFAULT is nullable). `description TEXT` satisfies this. [VERIFIED: sqlite.org/lang_altertable.html — "The new column may take any of the forms permissible in a CREATE TABLE statement, with the following restrictions: ... may not have a NOT NULL constraint unless a non-null default value is provided."]

**Persist requirement:** `initDb()` must call `persist()` after the new DDL runs, otherwise the on-disk `.db` file won't have the new schema until the next write. The existing code already calls `persist()` at the end of `initDb()` — no change needed there.

### Pattern 2: multer `.single()` with Multiple Same-Name Text Fields

**What:** `upload.single('image')` processes multipart form data and populates `req.body` with all non-file fields. When the frontend calls `fd.append('sizes[]', 'S')` multiple times, multer (via busboy) collects them as an array in `req.body['sizes[]']`. When only one size is appended, it arrives as a plain string.

**When to use:** Every time `POST /api/products` processes the add-product form.

**Example:**
```javascript
// Source: multer README + busboy behavior [VERIFIED: github.com/expressjs/multer]

// Frontend dashboard (sends):
fd.append('sizes[]', 'S');
fd.append('sizes[]', 'M');
fd.append('stock[]', '10');
fd.append('stock[]', '5');

// Backend receives:
// req.body['sizes[]'] = 'S'        // if only one checkbox checked (string)
// req.body['sizes[]'] = ['S', 'M'] // if multiple checked (array)

// Normalise — REQUIRED:
const rawSizes = req.body['sizes[]'] ?? [];
const sizes = Array.isArray(rawSizes) ? rawSizes : [rawSizes];
const rawStock = req.body['stock[]'] ?? [];
const stockArr = Array.isArray(rawStock) ? rawStock : [rawStock];
```

**Pitfall:** Not normalising the single-value case is the #1 bug in multer multi-field forms. Always wrap with `Array.isArray()` check. [ASSUMED — standard Node.js multipart behavior, consistent with busboy docs and multer source code but not explicitly stated in official README]

### Pattern 3: sql.js LEFT JOIN + Manual Row Grouping

**What:** sql.js's `db.prepare().all()` returns flat rows (one per JOIN result). When a product has 3 variants, the query returns 3 rows all with the same product columns. These must be grouped in JS — there is no GROUP_CONCAT or ARRAY_AGG approach reliable across all sql.js queries via the `.all()` helper.

**When to use:** `GET /api/products/:id` and optionally `GET /api/products` (list).

**Example:**
```javascript
// Source: existing db.js .all() pattern + SQLite LEFT JOIN semantics [VERIFIED: codebase]

// Query — flat rows:
const rows = db.prepare(`
  SELECT
    p.*,
    pv.id   AS variant_id,
    pv.size AS variant_size,
    pv.stock AS variant_stock
  FROM products p
  LEFT JOIN product_variants pv ON pv.product_id = p.id
  WHERE p.id = ?
`).all(req.params.id);

// Group in JS:
if (!rows.length) return res.status(404).json({ error: 'Product not found' });
const productRow = rows[0];
const variants = rows
  .filter(r => r.variant_id != null)
  .map(r => ({ id: String(r.variant_id), size: r.variant_size, stock: r.variant_stock }));

res.json({ product: formatProduct(productRow, variants) });

// Updated formatProduct signature:
function formatProduct(row, variants = []) {
  return {
    ...existingFields,
    description: row.description || "",
    variants,   // array of { id, size, stock }
  };
}
```

**Why not GROUP_CONCAT:** The existing `db.prepare().all()` returns JS objects via column names. GROUP_CONCAT works but requires parsing a concatenated string — fragile if size names ever contain commas. The flat-row grouping approach is cleaner.

### Pattern 4: Dashboard Vanilla JS — Checkbox + Stock Input Interaction

**What:** The dashboard is a single-file HTML with vanilla JS. The add-product form needs 7 size checkboxes each paired with a stock number input. The number input should only be visible/required when the checkbox is checked.

**When to use:** When adding the size selector block to `saveProduct()` in `dashboard/index.html`.

**Example:**
```javascript
// Pattern: checkbox toggles its paired stock input visibility
// No framework — vanilla DOM. Consistent with existing dashboard JS style [VERIFIED: codebase]

// HTML structure:
// <div class="size-row" data-size="S">
//   <input type="checkbox" id="size-S" name="sizes[]" value="S" onchange="toggleStock(this)"/>
//   <label for="size-S">S</label>
//   <input type="number" id="stock-S" name="stock[]" min="0" value="0"
//          style="display:none" placeholder="stock"/>
// </div>

function toggleStock(cb) {
  const stockInput = document.getElementById('stock-' + cb.value);
  stockInput.style.display = cb.checked ? 'inline-block' : 'none';
  if (!cb.checked) stockInput.value = '0';
}

// In saveProduct() — collect checked sizes + their stock values:
const checkedSizes = [...document.querySelectorAll('input[name="sizes[]"]:checked')];
if (checkedSizes.length === 0) { alert('Select at least one size.'); return; }
checkedSizes.forEach(cb => {
  fd.append('sizes[]', cb.value);
  const stock = document.getElementById('stock-' + cb.value).value || '0';
  fd.append('stock[]', stock);
});

// In the reset block after successful save:
document.querySelectorAll('input[name="sizes[]"]').forEach(cb => {
  cb.checked = false;
  toggleStock(cb);
});
```

### Pattern 5: Next.js ISR Cache and Variants

**What:** `getProductById` uses `fetch(..., { next: { revalidate: 60 } })`. This means product pages serve stale data for up to 60 seconds after a new product is added. For this phase (add only, no edit), this is acceptable — new products appear within 60 seconds.

**No action needed in this phase:** The existing 60-second revalidation window is fine. Cache tags (`next: { tags: ['product:42'] }` + `revalidateTag`) would be needed only if Phase 02 (edit) requires instant cache invalidation after a stock change. Flag this for Phase 02 research.

**When this becomes a problem:** Phase 02 PATCH endpoint — if stock changes aren't reflected within 60 seconds, add `revalidateTag` calls in the route handler.

### Anti-Patterns to Avoid

- **Don't use `db.exec()` directly in routes** — `db.exec()` does not return rows. Use `db.prepare().all()` or `.get()`. [VERIFIED: codebase — `db.exec()` only used for PRAGMA in `initDb()`]
- **Don't call `_db.run()` directly from routes** — use the `db` wrapper (it handles `persist()` automatically). [VERIFIED: codebase — CLAUDE.md pattern]
- **Don't omit the single-value normalisation for `sizes[]`** — multer returns a string, not an array, when only one checkbox is checked. [ASSUMED]
- **Don't add `NOT NULL` to the `description` column without a DEFAULT** — SQLite `ALTER TABLE ADD COLUMN` rejects this. Use `TEXT` (nullable) and handle null in `formatProduct`. [VERIFIED: sqlite.org/lang_altertable.html]
- **Don't forget `ON DELETE CASCADE` on the FK** — if a product is deleted, orphan variants stay in the table otherwise. `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE` is the correct form. But: `PRAGMA foreign_keys = ON` must remain in `initDb()` (it already is). [VERIFIED: codebase — line 28 of db.js]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL schema migration tracking | Custom migration version table | `CREATE TABLE IF NOT EXISTS` + try/catch `ALTER TABLE` | sql.js is single-tenant, single-process; full migration frameworks are overkill |
| Multipart form parsing | Custom busboy implementation | multer (already installed, v2.1.1) | Handles file + field multiplexing correctly |
| Cart variant tracking | New Zustand store shape | Existing `CartItem.variantId?: string` | Already typed and wired in store |

---

## Code Examples

### Verified: db.js ALTER TABLE guard pattern

```javascript
// Source: SQLite docs + existing db.js initDb() pattern
// Run every startup — idempotent via try/catch
try {
  _db.run(`ALTER TABLE products ADD COLUMN description TEXT`);
} catch (_) { /* already exists */ }

_db.run(`
  CREATE TABLE IF NOT EXISTS product_variants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size       TEXT    NOT NULL,
    stock      INTEGER NOT NULL DEFAULT 0,
    UNIQUE(product_id, size)
  )
`);
```

### Verified: POST /api/products — insert variants in a loop

```javascript
// Source: existing products.js POST handler + db.prepare().run() pattern [VERIFIED: codebase]

// After inserting the product and getting lastInsertRowid:
const productId = result.lastInsertRowid;
sizes.forEach((size, i) => {
  const stock = parseInt(stockArr[i] ?? '0', 10);
  db.prepare(
    `INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)`
  ).run(productId, size, isNaN(stock) ? 0 : stock);
});
```

Note: Each `.run()` call calls `persist()`. For 7 variants that is 7 disk writes. Acceptable for the low-write add-product flow. If this becomes a bottleneck in future, batch with `_db.run()` + one `persist()`, but that adds complexity not justified now.

### Verified: GET /api/products/:id — LEFT JOIN + grouping

```javascript
// Source: existing products.js GET /:id + db.prepare().all() [VERIFIED: codebase]

const rows = db.prepare(`
  SELECT p.*,
         pv.id    AS variant_id,
         pv.size  AS variant_size,
         pv.stock AS variant_stock
  FROM   products p
  LEFT JOIN product_variants pv ON pv.product_id = p.id
  WHERE  p.id = ?
  ORDER BY pv.id ASC
`).all(req.params.id);

if (!rows.length) return res.status(404).json({ error: 'Product not found' });

const variants = rows
  .filter(r => r.variant_id != null)
  .map(r => ({ id: String(r.variant_id), size: r.variant_size, stock: r.variant_stock }));

res.json({ product: formatProduct(rows[0], variants) });
```

### Verified: ProductDetailClient.tsx — size selector from real variants

```typescript
// Source: existing ProductDetailClient.tsx lines 97–113 + decisions D-08/D-09/D-10
// [VERIFIED: codebase]

// Initialise selectedSize to first in-stock variant
const firstInStock = product.variants?.find(v => v.stock > 0)?.size ?? null;
const [selectedSize, setSelectedSize] = useState<string | null>(firstInStock);

const allOOS = !product.variants?.length || product.variants.every(v => v.stock === 0);

// Size buttons (replace hardcoded ['XS','S','M','L','XL']):
{product.variants?.map(v => {
  const oos = v.stock === 0;
  return (
    <button
      key={v.size}
      onClick={() => !oos && setSelectedSize(v.size)}
      disabled={oos}
      className={`w-14 h-14 border flex items-center justify-center font-bold transition-all
        ${oos
          ? 'opacity-50 line-through cursor-not-allowed border-poshakh-gold/30 text-poshakh-charcoal/40'
          : selectedSize === v.size
            ? 'border-poshakh-maroon bg-poshakh-maroon text-poshakh-gold'
            : 'border-poshakh-gold/50 text-poshakh-charcoal hover:border-poshakh-maroon hover:text-poshakh-maroon'
        }`}
    >
      {v.size}
    </button>
  );
})}

// CTA button swap:
{allOOS ? (
  <button disabled className="w-full py-5 bg-poshakh-charcoal/30 text-white font-heading tracking-widest text-lg uppercase font-bold cursor-not-allowed">
    Out of Stock
  </button>
) : (
  <button onClick={handleAddToCart} className="w-full py-5 bg-poshakh-maroon text-poshakh-gold ...">
    Add to Cart
  </button>
)}
```

---

## Zustand Cart Analysis

**Finding:** No changes to the Zustand store or `CartItem` type are needed for this phase. [VERIFIED: codebase]

- `CartItem.variantId?: string` already exists in `types/index.ts`
- `handleAddToCart` in `ProductDetailClient.tsx` already does `variant?.id` lookup (line 29) and sets `variantId: variant?.id`
- `addToCart(cartItem)` passes the full `CartItem` through — no store modifications
- The `id` dedup key is `${product.id}-${selectedSize}` — this correctly creates separate cart line items per size

**The only change in `handleAddToCart`:** Remove the dead Medusa sync block (lines 43–51). The `getOrCreateCart` and `addMedusaLineItem` imports can be removed from the top of the file as well.

**Optional type tightening:** `Product.variants` is typed as `{ id: string; size: string }[]` in `types/index.ts` — missing `stock: number`. Add `stock: number` to the variant type so the OOS check (`v.stock === 0`) is typed correctly.

---

## Dead Code Removal (Claude's Discretion)

The following dead Medusa code in `ProductDetailClient.tsx` must be removed in Plan 01-03:

| Lines | Code | Action |
|-------|------|--------|
| 7 | `import { getOrCreateCart, addMedusaLineItem } from "@/lib/cart"` | Remove import |
| 15 | `const { ..., setCartId, updateLineItemId } = useStore()` | Remove `setCartId`, `updateLineItemId` from destructure |
| 43–51 | `if (variant?.id) { try { const cartId = await getOrCreateCart()... } }` | Remove entire block |

After removal, `handleAddToCart` becomes synchronous (no `async` needed). Remove `async` from the function signature.

---

## Common Pitfalls

### Pitfall 1: multer single-value array field returns string, not array
**What goes wrong:** `req.body['sizes[]']` is `'S'` (string) when only one checkbox is checked, not `['S']`. Code that calls `.forEach()` on it will iterate over characters.
**Why it happens:** HTTP multipart spec — a single value is not an array. Multer doesn't auto-wrap scalars.
**How to avoid:** Always normalise: `const sizes = [].concat(req.body['sizes[]'] ?? [])` or `Array.isArray(x) ? x : [x]`.
**Warning signs:** Bug only appears when owner adds a product with exactly one size selected.

### Pitfall 2: ALTER TABLE ADD COLUMN fails on restart if column already exists
**What goes wrong:** Second server start throws `table products already has column description` — crashes `initDb()`.
**Why it happens:** `ALTER TABLE ADD COLUMN` is not idempotent like `CREATE TABLE IF NOT EXISTS`.
**How to avoid:** Wrap in `try { ... } catch (_) { }`.
**Warning signs:** Server crashes on startup with a SQLite schema error after first successful run.

### Pitfall 3: `useState` initial value is computed once — pre-selected size won't update if product prop changes
**What goes wrong:** `useState(product.variants?.find(v => v.stock > 0)?.size)` — if `product` is passed as a prop that could change (SSR page re-renders), the initial state is stale.
**Why it happens:** React `useState` ignores updated initial values after mount.
**How to avoid:** In this phase, `product` is fetched server-side and passed as a static prop to the client component — it won't change mid-session. No `useEffect` needed. This only matters in Phase 02 when live stock updates are possible.
**Warning signs:** Non-issue for Phase 01.

### Pitfall 4: ISR serves stale HTML with old size buttons
**What goes wrong:** New product added to DB but product list page still shows old static HTML because `revalidate: 60`.
**Why it happens:** ISR caches the rendered HTML for the configured window.
**How to avoid:** Not a problem for this phase — new products appear within 60 seconds. Acceptable delay.
**Warning signs:** Only becomes a problem in Phase 02 with stock edits (if instant stock reflection is required).

### Pitfall 5: LEFT JOIN returns zero rows for a product with no variants
**What goes wrong:** If a product has no variants (existing products, D-13), the LEFT JOIN returns one row with all `variant_*` columns as `NULL`. The `formatProduct` call gets `rows[0]` which exists — correct. The `variants` array is empty — correct. But if an INNER JOIN were used instead, `rows` would be empty and the route would return 404.
**Why it happens:** INNER JOIN requires at least one matching row.
**How to avoid:** Always use `LEFT JOIN` for the variants query.
**Warning signs:** Existing products return 404 on `GET /api/products/:id` after migration.

---

## Runtime State Inventory

> Included: this is a schema migration phase.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `data/poshakh.db` — existing `products` rows have no `description` column | `ALTER TABLE products ADD COLUMN description TEXT` — null fill, no migration needed |
| Stored data | No `product_variants` table exists yet | `CREATE TABLE IF NOT EXISTS product_variants` |
| Live service config | None — no external services reference variant or description schema | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars needed | None |
| Build artifacts | None — no compiled artifacts reference product schema | None |

**Nothing found requiring data migration** — existing products stay valid with `description = NULL` and `variants = []`. D-13 explicitly covers this.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | Yes | v24.15.0 | — |
| sql.js | DB writes | Yes | 1.14.1 | — |
| multer | Multipart form | Yes | 2.1.1 | — |
| express | HTTP routing | Yes | 5.2.1 | — |
| Next.js | Frontend | Yes | 16.2.4 | — |

**No missing dependencies.** All packages are already installed in `backend/package.json`.

---

## Validation Architecture

> No `.planning/config.json` found — treating `nyquist_validation` as enabled (absent = enabled).

This project has no existing test infrastructure (no `jest.config.*`, no `vitest.config.*`, no `test/` directory found). Given the stack is vanilla JS backend + Next.js frontend and the CLAUDE.md says "Test before commit. Failing tests do not ship." — but there is no test runner installed — Wave 0 of each plan should include a manual smoke-test protocol rather than automated tests.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Verification Command | File Exists? |
|--------|----------|-----------|----------------------|-------------|
| 01-01a | `products` table gains `description` column | Manual smoke | Start server, run `GET /api/products/:id`, check `description` field | N/A — manual |
| 01-01b | `product_variants` table created with correct schema | Manual smoke | Start server with existing DB, verify no crash, check table via API | N/A — manual |
| 01-01c | Existing products retain data (no data loss) | Manual smoke | Fetch existing product before + after restart | N/A — manual |
| 01-02a | `GET /api/products/:id` returns `description` field | Manual smoke | `curl localhost:9000/api/products/1` — check response shape | N/A — manual |
| 01-02b | `GET /api/products/:id` returns `variants` array | Manual smoke | Same curl, check `variants: [{id, size, stock}]` | N/A — manual |
| 01-02c | Product with no variants returns `variants: []` (not 404) | Manual smoke | Fetch existing product ID after migration | N/A — manual |
| 01-03a | Size selector renders from real variant data | Manual smoke | Load product detail page in browser | N/A — manual |
| 01-03b | OOS variant shows greyed + strikethrough | Manual smoke | Add product with stock=0 size, load page | N/A — manual |
| 01-03c | All-OOS product shows "Out of Stock" CTA | Manual smoke | Add product with all stock=0 | N/A — manual |
| 01-03d | Dead Medusa sync code removed | Code review | Check no `getOrCreateCart`/`addMedusaLineItem` in file | N/A — manual |

### Wave 0 Gaps
No automated test framework exists. Each plan's Wave 0 must include a manual smoke test checklist. No automated framework setup needed — would be premature investment for Phase 01.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | multer returns a plain string (not array) when only one field with a given name is appended | Pitfalls / Pattern 2 | Only manifests when owner adds product with exactly one size; produces a silent bug where `sizes` is iterated as characters |
| A2 | multer 2.x behavior with `fd.append('sizes[]', v)` is identical to busboy's behavior | Pattern 2 | If multer 2.x changed the body parsing contract, the normalisation pattern is still safe (Array.isArray check handles both cases) |

---

## Open Questions (RESOLVED)

1. **`GET /api/products` list — should variants be included?**
   - What we know: The product list page (`/products`) doesn't render size selectors.
   - What's unclear: Do we need variant data on the list page (e.g., to show "OOS" badge on product card)?
   - RESOLVED: Not needed for Phase 01. List endpoint unchanged — no JOIN added. Flag for Phase 02 if OOS badge on product cards is required.

2. **`stock` type in `CartItem.variantId` — should cart store stock count?**
   - What we know: Cart items dedup by `${productId}-${size}`. Stock enforcement happens server-side at order creation (not yet implemented).
   - What's unclear: Should adding to cart check stock > 0 on the frontend?
   - RESOLVED: Frontend OOS guard (disabled button state) is sufficient for Phase 01. No backend cart stock check in scope. Revisit in Phase 03 order creation flow.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `backend/db.js` — confirmed `db.prepare().run()/.get()/.all()` API, `persist()` pattern, `PRAGMA foreign_keys = ON`
- Codebase: `backend/routes/products.js` — confirmed `formatProduct()` stubs, multer `.single('image')`, POST handler shape
- Codebase: `frontend/src/app/products/[id]/ProductDetailClient.tsx` — confirmed dead Medusa block (lines 43–51), hardcoded size array (line 103), `variant?.id` lookup (line 29)
- Codebase: `frontend/src/types/index.ts` — confirmed `CartItem.variantId?: string`, `Product.variants?: { id: string; size: string }[]`
- Codebase: `frontend/src/store/index.ts` — confirmed `addToCart` accepts existing `CartItem` shape unchanged
- Codebase: `frontend/src/lib/products.ts` — confirmed `revalidate: 60`, `mapProduct()` passthrough for `description` and `variants`
- npm registry: sql.js 1.14.1, multer 2.1.1, express 5.2.1 [VERIFIED: npm view]
- SQLite official docs: sqlite.org/lang_altertable.html — ALTER TABLE ADD COLUMN restrictions confirmed

### Secondary (MEDIUM confidence)
- WebSearch + sqlite.org: sql.js 1.14.1 runs SQLite 3.49 — ALTER TABLE ADD COLUMN is supported
- WebSearch + Next.js docs: `revalidate: 60` ISR behavior, `revalidateTag` for on-demand cache busting (confirmed via nextjs.org/docs)
- multer GitHub README: `.single()` populates `req.body` with all text fields

### Tertiary (LOW confidence / ASSUMED)
- A1, A2: multer single-value string vs array behavior (standard busboy behavior — consistent across all Node.js multipart libraries but not explicitly tested in this session)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry + codebase
- Architecture: HIGH — all patterns derived directly from existing codebase code
- Pitfalls: HIGH (pitfalls 1–2, 4–5) / MEDIUM (pitfall 3) — verified from SQLite docs and codebase
- Zustand cart analysis: HIGH — directly read from store and types

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable stack)
