---
status: incomplete
---

# Quick Task: Frontend UI/UX Polish

## Objective
Apply specific UI/UX enhancements to the Poshakh frontend as requested by the user.

## Checklist
- [ ] Disable UPI payment option in Checkout UI
- [ ] Remove any remaining dummy/sample products from frontend
- [ ] Implement Product Variants by Color (swatches + switching logic)
- [ ] Verify/Refine Similar Products section on Product Detail page
- [ ] Ensure Home page product listing shows 2 products per row on mobile
- [ ] End-to-end walkthrough (Home -> Product -> Cart -> Checkout)

## Context
- Backend is functional; frontend only.
- Tech stack: Next.js/React, Vanilla CSS/Tailwind.

## Plan
1. **Checkout UI**: Double check `frontend/src/app/checkout/page.tsx` and ensure UPI button is disabled/hidden.
2. **Product Cleanup**: Search for hardcoded data in components like `CategoryTiles`, `FeaturedProducts`, etc.
3. **Color Variants**:
    - Update `Product` type in `frontend/src/types/index.ts`.
    - Update `mapProduct` in `frontend/src/lib/products.ts`.
    - Modify `ProductDetailClient.tsx` to handle color variants.
4. **Similar Products**: Check logic in `getSimilarProducts` and UI in `ProductDetailClient.tsx`.
5. **Mobile Grid**: Audit `FeaturedProducts.tsx` and `ProductClient.tsx`.
6. **Verification**: Manual walkthrough of the purchase flow.
