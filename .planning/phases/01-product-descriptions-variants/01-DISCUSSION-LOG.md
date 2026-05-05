# Phase 01 — Discussion Log

**Date:** 2026-04-29
**Facilitator:** GSD discuss-phase (default mode)

---

## Areas Selected

User selected: **Size set** only. Other areas (variants storage, existing migration, description in add form) resolved by Claude at discretion.

---

## Discussion: Size set

| Turn | Question | Options Presented | Selection |
|------|----------|-------------------|-----------|
| 1 | How should sizes work across products? | Fixed XS–XL for all / Fixed + Free Size toggle / Fully configurable per product | **Fully configurable per product** |
| 2 | What's the available size pool? | Standard fashion sizes (XS–XXL + Free Size) / Standard + numeric / Fully freeform | **Standard fashion sizes (Recommended)** |
| 3 | When a size is out of stock, what should customer see? | Greyed out + strikethrough / Hidden entirely / No stock tracking | **Greyed out + strikethrough** |

---

## Claude's Discretion

- **Variants storage**: Separate `product_variants` table (not JSON). Standard relational pattern, no user preference stated.
- **Existing product migration**: No auto-seeding. Existing products stay as-is; owner configures via Phase 02 edit form.
- **Description in add form**: Added to Phase 01 scope — pragmatic (one schema migration). No user objection.
- **Dead Medusa sync cleanup**: ProductDetailClient lines 43–51 removed as part of this phase.

---

## Deferred Ideas

- Size guide modal/chart
- Price-per-variant
- Stock management / restocking alerts
