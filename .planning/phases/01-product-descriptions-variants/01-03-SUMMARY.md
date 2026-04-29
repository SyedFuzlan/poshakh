---
phase: 01-product-descriptions-variants
plan: "03"
subsystem: frontend
tags: [product-detail, size-selector, oos, variants, typescript]
dependency_graph:
  requires: [01-02 — GET /api/products/:id returns variants with stock field]
  provides: [ProductDetailClient.tsx wired to real variants, OOS visual states, synchronous handleAddToCart]
  affects: [frontend/src/types/index.ts, frontend/src/app/products/[id]/ProductDetailClient.tsx]
tech_stack:
  added: []
  patterns: [variants?.map OOS conditional rendering, derived values before useState, disabled button pattern]
key_files:
  modified:
    - frontend/src/types/index.ts
    - frontend/src/app/products/[id]/ProductDetailClient.tsx
decisions:
  - "selectedSize initialised from firstInStock (first variant with stock > 0) rather than hardcoded 'S'"
  - "allOOS covers both no-variants and all-zero-stock cases per D-13"
  - "frontend submodule pointer removed and files tracked directly — no .gitmodules, no .git in frontend dir, broken submodule state resolved"
  - "disabled={oos} + onClick guard are redundant but both kept per T-01-03-01 threat mitigation"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-29"
---

# Phase 01 Plan 03: Frontend Size Selector & OOS Logic Summary

**One-liner:** Replaced hardcoded ['XS','S','M','L','XL'] size buttons with product.variants?.map iteration, added OOS visual states (opacity-50 line-through disabled), and removed the entire Medusa async sync block from handleAddToCart.

## What Changed in frontend/src/types/index.ts

Single field change on line 10:

```typescript
// Before:
variants?: { id: string; size: string }[];

// After:
variants?: { id: string; size: string; stock: number }[];
```

The `stock` field is typed as `number` (not `number | null`) because the DB column has `DEFAULT 0` — the API always returns an integer. This enables `v.stock === 0` and `v.stock > 0` comparisons without TypeScript type errors.

## What Changed in frontend/src/app/products/[id]/ProductDetailClient.tsx

### Change 1 — Dead Medusa import removed

Removed entirely:
```typescript
import { getOrCreateCart, addMedusaLineItem } from "@/lib/cart";
```

### Change 2 — useStore destructure trimmed

```typescript
// Before:
const { addToCart, setCartOpen, setCartId, updateLineItemId } = useStore();

// After:
const { addToCart, setCartOpen } = useStore();
```

### Change 3 — Derived values + selectedSize state

Added before useState calls (after the product guard, before useEffect):
```typescript
const firstInStock = product.variants?.find(v => v.stock > 0)?.size ?? null;
const allOOS = !product.variants?.length || product.variants.every(v => v.stock === 0);
```

Changed selectedSize initialisation:
```typescript
// Before:
const [selectedSize, setSelectedSize] = useState<string>("S");

// After:
const [selectedSize, setSelectedSize] = useState<string | null>(firstInStock);
```

### Change 4 — handleAddToCart made synchronous, Medusa block removed

Removed `async` keyword and the entire `if (variant?.id) { try { const cartId = await getOrCreateCart(); ... } }` block. Function is now a simple synchronous handler that calls `addToCart(cartItem)` and `setCartOpen(true)`. The `selectedSize ?? ''` handles the `string | null` type in the cartItem.

### Change 5 — Size buttons wired to product.variants

Replaced `['XS', 'S', 'M', 'L', 'XL'].map(...)` with `product.variants?.map(v => { ... })`. Added `flex-wrap` to the container div. OOS buttons render with `opacity-50 line-through cursor-not-allowed` styling and `disabled={oos}` attribute.

### Change 6 — Main CTA button OOS conditional

Wrapped main "Add to Cart" button in `{allOOS ? <disabled Out of Stock button> : <Add to Cart button>}`.

### Change 7 — Sticky bar CTA button OOS conditional

Same conditional applied to the sticky bar button.

## TypeScript Check

```
npx tsc --noEmit
EXIT: 0
```

No TypeScript errors. The `string | null` type for `selectedSize` is handled throughout:
- `selectedSize === v.size` — comparison works for null (won't match any size string)
- `selectedSize ?? ''` in cartItem.size — null coalesced to empty string

## Dead Medusa Import Verification

```
grep -n "getOrCreateCart\|addMedusaLineItem\|setCartId\|updateLineItemId" \
  frontend/src/app/products/[id]/ProductDetailClient.tsx
```

Result: **No matches** (all dead code removed).

## Size Selector API Data Verification

```
grep -n "product.variants" frontend/src/app/products/[id]/ProductDetailClient.tsx
```

Result: 4 matches (lines 16, 17, 31, 94) — all reference real `product.variants` prop data.

## Deviations from Plan

### Infrastructure Deviation — Broken submodule converted to tracked files

**Found during:** Task 1 commit attempt

**Issue:** Git treated `frontend/` as a submodule at commit `2e13dda` (mode `160000`) with no `.gitmodules` file and no `.git` directory inside `frontend/`. Running `git add frontend/src/types/index.ts` failed with `fatal: Pathspec 'frontend/src/types/index.ts' is in submodule 'frontend'`. This was a broken submodule state — the submodule pointer existed in the index but no submodule infrastructure was in place.

**Fix (Rule 3 — blocking issue):** Ran `git rm --cached frontend` to remove the submodule pointer from the index, then added `frontend/src/types/index.ts` as a regular tracked file. The Task 1 commit (`9a865cb`) includes both the deletion of the `160000 frontend` pointer and the creation of `frontend/src/types/index.ts`. Task 2 commit (`7f2cce9`) then added `frontend/src/app/products/[id]/ProductDetailClient.tsx` as a regular tracked file.

**Impact:** Frontend TypeScript files are now tracked individually in the parent repo rather than via a broken submodule pointer. All future frontend file commits will work normally.

## Known Stubs

None. The size selector renders from `product.variants` (real API data). The OOS logic uses `v.stock` from the API. No hardcoded empty values in the code paths covered by this plan.

## Self-Check

- [x] `frontend/src/types/index.ts` modified — `stock: number` on variants field
- [x] `frontend/src/app/products/[id]/ProductDetailClient.tsx` modified — all 7 changes applied
- [x] Commit `9a865cb` exists (Task 1: types/index.ts)
- [x] Commit `7f2cce9` exists (Task 2: ProductDetailClient.tsx)
- [x] `npx tsc --noEmit` exits 0
- [x] Dead Medusa imports return no grep matches
- [x] No modifications to STATE.md or ROADMAP.md

## Self-Check: PASSED
