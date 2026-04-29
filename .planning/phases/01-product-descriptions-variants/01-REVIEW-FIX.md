---
phase: 01-product-descriptions-variants
fixed_at: 2026-04-29T00:00:00Z
review_path: .planning/phases/01-product-descriptions-variants/01-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-29T00:00:00Z
**Source review:** .planning/phases/01-product-descriptions-variants/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 12 (8 Critical + 4 Warning)
- Fixed: 12
- Skipped: 0

## Fixed Issues

### CR-01 + CR-02 + CR-03 + CR-04 + CR-05: XSS vectors in orderCard

**Files modified:** `backend/dashboard/index.html`
**Commit:** 1cbc06a
**Applied fix:** Applied `esc()` to all previously-unescaped dynamic values in the `orderCard` function: `o.status` (class attribute), `o.id` (onclick attribute and element id), `o.shipped_at_ist`, `o.created_at_ist / o.created_at_utc`, `o.total_formatted`, `o.shipping_cost_formatted`. Coerced `it.quantity` via `Number()` to eliminate the raw injection.

---

### CR-06: Rules of Hooks violation — useState after early return

**Files modified:** `frontend/src/app/products/[id]/ProductDetailClient.tsx`
**Commit:** e524def
**Applied fix:** Moved the early-return guard (`if (!product || !product.images ...)`) to after all `useState` and `useEffect` hook declarations. Updated `firstInStock` and `allOOS` derivations to use optional chaining (`product?.variants`) so they are safe to compute before the guard. This commit also includes the WR-03 stock-coercion fix (see below).

---

### CR-07: Custom Stitching bypasses OOS guard and uses stale XL variant

**Files modified:** `frontend/src/app/products/[id]/ProductDetailClient.tsx`
**Commit:** ece58cc
**Applied fix:** Removed the XL variant hardcode from the stitching path — `handleAddToCart` now sets `variant = undefined` when `isStitching` is true, so `variantId` is intentionally absent for custom-stitching cart items. Changed both Add to Cart / Out of Stock button guards from `allOOS` to `allOOS && !isStitching` so the stitching path always shows an enabled Add to Cart button regardless of standard variant stock.
**Note:** requires human verification — logic change affecting cart behaviour.

---

### CR-08: `new URL()` throws on relative image_url, blocking product deletion

**Files modified:** `backend/routes/products.js`
**Commit:** aa70b66
**Applied fix:** Wrapped the URL parsing in a try/catch and added a `startsWith("http")` guard to support both absolute URLs and relative paths. The `DELETE FROM products` statement is now executed unconditionally — image cleanup errors can no longer propagate to the outer try/catch and prevent record deletion.

---

### WR-01: File upload validates extension only — MIME type not checked

**Files modified:** `backend/routes/products.js`
**Commit:** c89e59e
**Applied fix:** Extracted `ALLOWED_EXTENSIONS` and `ALLOWED_MIMES` constants. The multer `fileFilter` now requires both a valid extension AND a matching `file.mimetype` from the allowed-MIME list, adding defence-in-depth against disguised file uploads.

---

### WR-02: ALTER TABLE catch swallows all errors

**Files modified:** `backend/db.js`
**Commit:** bc0982d
**Applied fix:** Changed the catch variable from `_` to `e` and added a rethrow condition: only the known "duplicate column name" error is suppressed; all other errors are re-thrown so genuine schema failures surface at startup.

---

### WR-03: allOOS strict equality without stock coercion

**Files modified:** `frontend/src/app/products/[id]/ProductDetailClient.tsx`
**Commit:** e524def (included with CR-06 fix)
**Applied fix:** Changed `v.stock === 0` to `Number(v.stock) === 0` in the `allOOS` derivation, making the out-of-stock check resilient to string-typed stock values from the API.

---

### WR-04: deleteProduct passes raw p.id into onclick

**Files modified:** `backend/dashboard/index.html`
**Commit:** f31d1ac
**Applied fix:** Changed `deleteProduct(${p.id},'...')` to `deleteProduct('${esc(String(p.id))}','...')` — consistent with `esc()` usage throughout the dashboard and safe for UUID or non-numeric IDs.

---

## Skipped Issues

None.

---

_Fixed: 2026-04-29T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
