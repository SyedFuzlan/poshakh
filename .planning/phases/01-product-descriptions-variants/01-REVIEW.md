---
phase: 01-product-descriptions-variants
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/db.js
  - backend/routes/products.js
  - backend/dashboard/index.html
  - frontend/src/types/index.ts
  - frontend/src/app/products/[id]/ProductDetailClient.tsx
findings:
  critical: 8
  warning: 4
  info: 4
  total: 16
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files reviewed covering the Phase 01 product-descriptions-and-variants feature: the SQLite database wrapper, the products REST route, the owner dashboard HTML/JS, the shared TypeScript types, and the product detail React component.

The SQL layer is correctly parameterised throughout — no injection vectors found in any `db.prepare().run/get/all` call. The `VALID_SIZES` allowlist is correctly enforced and stock coercion is sound. The schema migration for `description` is idempotent via try/catch.

However, the implementation has **eight critical issues** that must be fixed before this ships:

- The dashboard renders several server-supplied fields directly into `innerHTML` without escaping, creating multiple stored XSS vectors exploitable by anyone who can insert an order or product record.
- The React component violates the Rules of Hooks by placing `useState` calls after an early conditional return, which will crash or misbehave in React's runtime.
- The Custom Stitching "Add to Cart" path bypasses the out-of-stock guard entirely.
- The DELETE endpoint will fail with an unhandled error (500, product not deleted) when `image_url` is a relative path or otherwise not a full URL.

---

## Critical Issues

### CR-01: XSS — `o.id` injected raw into `onclick` attribute

**File:** `backend/dashboard/index.html:356`
**Issue:** The `orderCard` function builds a `<button onclick="markShipped('${o.id}',this)">` string and injects it via `innerHTML`. `o.id` is not passed through `esc()`. An order ID containing a single-quote or closing-parenthesis (e.g. `');alert(1);//`) would break out of the string literal and execute arbitrary JavaScript in the owner's session. Although order IDs are currently UUIDs generated server-side, this pattern becomes exploitable the moment the ID source changes or another code path reuses `orderCard`.

**Fix:**
```js
// Always escape dynamic values in inline event handlers
`<button class="btn-ship" onclick="markShipped('${esc(String(o.id))}',this)">...</button>`
```

---

### CR-02: XSS — `o.status` injected raw into `class` attribute

**File:** `backend/dashboard/index.html:343`
**Issue:** `const statusClass = 'status-' + o.status;` is concatenated into the HTML string at line 363 as `class="... ${statusClass}"`. The `o.status` value comes from the server and is never passed through `esc()`. A status value containing `" onmouseover="alert(1)` would inject an event handler into the DOM.

**Fix:**
```js
const statusClass = 'status-' + esc(o.status);
```

---

### CR-03: XSS — `o.total_formatted` and `o.shipping_cost_formatted` unescaped in `innerHTML`

**File:** `backend/dashboard/index.html:377`
**Issue:** Both formatted currency strings are injected directly:
```js
`${o.total_formatted} ... (Shipping: ${o.shipping_cost_formatted})`
```
Neither is passed through `esc()`. These are server-computed strings; if the order total pipeline ever includes user-supplied data (e.g. a coupon code reflected in the formatted string) this becomes an XSS vector.

**Fix:**
```js
`${esc(o.total_formatted)} ... (Shipping: ${esc(o.shipping_cost_formatted)})`
```

---

### CR-04: XSS — `o.created_at_ist`, `o.created_at_utc`, and `o.shipped_at_ist` unescaped

**File:** `backend/dashboard/index.html:355,361`
**Issue:** Date/time strings from the server are interpolated raw:
- Line 355: `o.shipped_at_ist || '—'`
- Line 361: `o.created_at_ist || o.created_at_utc`

None of these are passed through `esc()`. A malformed timestamp containing `<script>` or an attribute-breaking sequence would execute in the owner's browser.

**Fix:**
```js
// Line 355
`<span class="shipped-label">✅ Shipped on ${esc(o.shipped_at_ist || '—')}</span>`

// Line 361
`${esc(o.created_at_ist || o.created_at_utc)} · ...`
```

---

### CR-05: XSS — `it.quantity` and `it.price` unescaped in order item rows

**File:** `backend/dashboard/index.html:350`
**Issue:** Item fields are injected into the HTML string without escaping:
```js
`Qty: ${it.quantity} · ₹${Number(it.price).toLocaleString('en-IN')}`
```
`it.quantity` is used raw. `Number(it.price)` coerces the value to a number first, which eliminates the XSS risk for `price` specifically — but `it.quantity` is not coerced and is injected as-is.

**Fix:**
```js
`Qty: ${Number(it.quantity)} · ₹${Number(it.price).toLocaleString('en-IN')}`
// Or to be consistent with other fields:
`Qty: ${esc(String(it.quantity))} · ₹${Number(it.price).toLocaleString('en-IN')}`
```

---

### CR-06: Rules of Hooks violation — `useState` called after early return

**File:** `frontend/src/app/products/[id]/ProductDetailClient.tsx:12-22`
**Issue:** The component performs an early return at lines 12-14 before any hooks are called:
```tsx
if (!product || !product.images || product.images.length === 0) {
  return <div ...>Product not found</div>;
}

const firstInStock = product.variants?.find(v => v.stock > 0)?.size ?? null;
const allOOS = ...;

const [selectedSize, setSelectedSize] = useState<string | null>(firstInStock);  // line 19
const [isStitching, setIsStitching] = useState<boolean>(false);                 // line 20
const [activeAccordion, setActiveAccordion] = useState<string>("details");       // line 21
const [showStickyBar, setShowStickyBar] = useState(false);                       // line 22
```
React's Rules of Hooks prohibit calling hooks after a conditional return. When `product` is falsy on the first render but truthy on a re-render (or vice versa), React's hook call count changes between renders, which throws: _"Rendered more hooks than during the previous render."_ In production this silently produces stale state or incorrect behaviour.

**Fix:** Move the guard AFTER all hook declarations, or use a separate wrapper component:
```tsx
export default function ProductDetailClient({ product, whatsappUrl }: { product: Product, whatsappUrl: string }) {
  const { addToCart, setCartOpen } = useStore();

  // Derive stable values — safe even when variants is undefined
  const firstInStock = product?.variants?.find(v => v.stock > 0)?.size ?? null;
  const allOOS = !product?.variants?.length || product.variants.every(v => v.stock === 0);

  const [selectedSize, setSelectedSize] = useState<string | null>(firstInStock);
  const [isStitching, setIsStitching] = useState<boolean>(false);
  const [activeAccordion, setActiveAccordion] = useState<string>("details");
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => { ... }, []);

  // Guard moved below all hooks
  if (!product || !product.images || product.images.length === 0) {
    return <div className="max-w-7xl mx-auto px-6 py-12 text-center">Product not found</div>;
  }
  // ... rest of render
}
```

---

### CR-07: Custom Stitching bypasses OOS guard and silently omits variantId

**File:** `frontend/src/app/products/[id]/ProductDetailClient.tsx:31-43`
**Issue:** When `isStitching` is true, `handleAddToCart` hardcodes `"XL"` for the variant lookup:
```tsx
const variant = product.variants?.find(v => v.size === (isStitching ? "XL" : selectedSize));
```
This bypasses `allOOS` — the "Add to Cart" button is **always enabled** when `isStitching` is true (lines 136-143 and 193-200 both gate only on `allOOS`, which does not account for stitching mode). Two consequences:

1. A product with zero stock in all sizes still shows an enabled "Add to Cart" in Custom Stitching mode.
2. If no XL variant exists, `variant` is `undefined`, so `variantId` is `undefined` in the cart item. Checkout will then try to decrement stock for a non-existent variant.

**Fix:** The stitching path should not depend on a size variant at all. Either use a dedicated `custom-stitching` sentinel variantId, or explicitly allow `variantId: undefined` for stitching and handle that in the checkout route. Also, the OOS guard should not block the stitching path:
```tsx
// The Add to Cart button: only gate on allOOS when NOT stitching
{allOOS && !isStitching ? (
  <button disabled ...>Out of Stock</button>
) : (
  <button onClick={handleAddToCart} ...>Add to Cart</button>
)}
```

---

### CR-08: `new URL()` throws on relative or malformed `image_url`, leaving product undeleted

**File:** `backend/routes/products.js:211`
**Issue:** The DELETE handler calls `new URL(row.image_url)` to extract the filename:
```js
const filename = path.basename(new URL(row.image_url).pathname);
```
`new URL()` throws a `TypeError` if `row.image_url` is not an absolute URL (e.g. an empty string, a relative path like `/uploads/foo.jpg`, or any value that was stored before the base-URL prefix was added). The outer `try/catch` at line 202 will catch the TypeError and return a 500 response — **without deleting the product record from the database**. The product becomes permanently undeleteable from the dashboard.

**Fix:**
```js
// Use a safe fallback instead of new URL()
if (row.image_url && row.image_url.includes('/uploads/')) {
  try {
    // Support both absolute URLs and relative paths
    const parsed = row.image_url.startsWith('http')
      ? new URL(row.image_url).pathname
      : row.image_url;
    const filename = path.basename(parsed);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
  } catch { /* ignore image cleanup errors — still delete the record */ }
}
// Delete record unconditionally — image cleanup failure should not block deletion
db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
```

---

## Warnings

### WR-01: File upload validates extension only — MIME type not checked

**File:** `backend/routes/products.js:33-37`
**Issue:** The multer `fileFilter` accepts files based solely on `path.extname(file.originalname).toLowerCase()`. `file.originalname` is the filename as sent by the client — it can be arbitrary. A browser or API client can send a PHP/HTML file with a `.jpg` extension and it will pass the filter. Because the file is stored under a server-controlled name (`product_<timestamp>.jpg`), direct execution is unlikely, but if the upload directory is ever served with a permissive MIME type policy or the filename logic changes, this becomes a path to stored XSS / RCE.

**Fix:** Add actual MIME type checking using `file.mimetype` (set by multer from the Content-Type header — still client-supplied but adds defence in depth) and consider using a library like `file-type` to inspect the file's magic bytes after upload:
```js
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
fileFilter: (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
  cb(null, allowed.includes(ext) && ALLOWED_MIMES.includes(file.mimetype));
}
```

---

### WR-02: `description` migration silently swallows all `ALTER TABLE` errors

**File:** `backend/db.js:44-48`
**Issue:**
```js
try {
  _db.run(`ALTER TABLE products ADD COLUMN description TEXT`);
} catch (_) {
  // Column already exists — safe to ignore on subsequent startups
}
```
The catch block swallows every error from this statement, not only "column already exists" (SQLITE_ERROR: duplicate column name). A genuine schema problem — table locked, corrupted DB, name collision with a future column — would be silently ignored, leaving the application running with a missing column and producing confusing downstream errors.

**Fix:** Re-throw if the error is not the known duplicate-column message:
```js
try {
  _db.run(`ALTER TABLE products ADD COLUMN description TEXT`);
} catch (e) {
  if (!e.message?.includes('duplicate column name')) throw e;
}
```

---

### WR-03: `allOOS` logic in `ProductDetailClient` has a stock-type coercion gap

**File:** `frontend/src/app/products/[id]/ProductDetailClient.tsx:17`
**Issue:**
```tsx
const allOOS = !product.variants?.length || product.variants.every(v => v.stock === 0);
```
The `===` strict equality check against `0` is correct only if `v.stock` is always a `number`. The backend returns `variant_stock` from `sql.js` which preserves the SQLite INTEGER type through `Object.fromEntries`, so this is correct today. However, the `Product` type declares `variants?: { id: string; size: string; stock: number }[]`, and `CartItem` allows `size?: string`. If the API ever returns stock as a string (e.g. from a different serialisation layer), `"0" === 0` is false, every variant would appear in-stock when it is not, and the OOS guard would never trigger.

**Fix:** Coerce defensively:
```tsx
const allOOS = !product.variants?.length || product.variants.every(v => Number(v.stock) === 0);
```

---

### WR-04: `deleteProduct` in dashboard passes raw `p.id` into inline `onclick`

**File:** `backend/dashboard/index.html:417`
**Issue:**
```js
`<button class="btn-delete" onclick="deleteProduct(${p.id},'${esc(p.name)}')">DELETE</button>`
```
`p.id` is interpolated without `esc()` or numeric coercion. Currently `p.id` is always the string form of a SQLite integer (e.g. `"42"`), so this is safe in practice. But the pattern is inconsistent with `esc()` usage elsewhere and will break if `p.id` is ever changed to a UUID or non-numeric value containing quotes.

**Fix:**
```js
`<button class="btn-delete" onclick="deleteProduct('${esc(String(p.id))}','${esc(p.name)}')">DELETE</button>`
```

---

## Info

### IN-01: Dead Medusa fields in `Order` and `CartItem` types

**File:** `frontend/src/types/index.ts:22,41`
**Issue:** `CartItem.lineItemId?: string` (line 22) and `Order.medusaOrderId?: string` (line 41) are Medusa remnants with no corresponding usage now that the stack has been replaced. They add noise and risk accidental usage.

**Fix:** Remove both fields:
```ts
// CartItem: remove lineItemId
// Order: remove medusaOrderId
```

---

### IN-02: `stock?: number` on `Product` type is superseded by `variants`

**File:** `frontend/src/types/index.ts:9`
**Issue:** `Product.stock?: number` is a flat stock field that predates the variants model. The backend no longer serialises this field — it is always `undefined`. Retaining it misleads future developers about the data shape.

**Fix:** Remove the `stock` field from the `Product` interface.

---

### IN-03: `Category` type is out of sync with dashboard category options

**File:** `frontend/src/types/index.ts:25`
**Issue:** The `Category` union includes `'sharara'` and `'anarkali'` but the dashboard `<select>` only has `sarees`, `salwar`, `lehenga`, `gowns`, `other`. Conversely, `'salwar'` and `'other'` are not in the `Category` type. A product created via the dashboard with category `"salwar"` will not match any `Category` value, breaking any type-guarded filtering logic.

**Fix:** Align the type with actual categories used, or derive both from a shared constant:
```ts
export type Category = 'sarees' | 'salwar' | 'lehenga' | 'gowns' | 'other';
```

---

### IN-04: `product_image` input accepts `image/*` but multer only allows specific extensions

**File:** `backend/dashboard/index.html:201`
**Issue:** The file input has `accept="image/*"` which allows all image MIME types (e.g. `.gif`, `.tiff`, `.bmp`, `.ico`), but the multer `fileFilter` in `routes/products.js` only allows `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`. A user selecting a `.gif` file will see the local preview correctly but receive a silent failure from the upload (multer rejects the file, `req.file` is `undefined`, product is saved with an empty `image_url`). No error is surfaced to the user.

**Fix:** Align the `accept` attribute with what the server accepts:
```html
<input type="file" id="product-image" accept=".jpg,.jpeg,.png,.webp,.avif" onchange="previewImage(this)"/>
```
Additionally, the server should return a 400 error when a required image is rejected, or the route should handle `!req.file` and return a meaningful error.

---

_Reviewed: 2026-04-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
