# Phase 2: Product Update Endpoint - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 02-product-update-endpoint
**Areas discussed:** Edit Trigger UX, Variant Editing Scope

---

## Edit Trigger UX

### Q1: How does the owner open the edit form?

| Option | Description | Selected |
|--------|-------------|----------|
| Edit button on tile | Add an EDIT button to each product tile alongside DELETE | |
| Click anywhere on tile | Clicking the tile itself opens the edit state | ✓ |
| Inline expand on tile | Clicking EDIT expands tile in-place to show fields below image | |
| Modal popup (pre-filled) | Clicking EDIT opens a modal overlay with all fields pre-filled | |

**User's choice:** Click anywhere on tile

---

### Q2: Where should edit fields appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expand below tile | Tile expands vertically in grid to reveal inputs | |
| Modal overlay | Centered modal appears over page with pre-filled fields | ✓ |
| Replace tile with form | Tile transforms into edit form in-place | |

**User's choice:** Modal overlay

---

### Q3: How does modal get its data?

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch /api/products/:id on open | Fresh API call gets full product with variants | |
| Use data already in tile | Rely on list-rendered tile data | |
| You decide | Claude picks best approach | ✓ |

**Claude's decision:** Fetch `/api/products/:id` on modal open — existing endpoint, returns full variants, no API changes needed.

---

### Q4: After saving edits, what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Close modal, refresh grid | Modal closes, `loadProducts()` reloads | |
| Update tile in-place | Patch specific tile without full reload | |
| You decide | Claude picks | ✓ |

**Claude's decision:** Close modal + call `loadProducts()` — consistent with `saveProduct()` pattern.

---

## Variant Editing Scope

### Q1: What can be changed about size variants?

| Option | Description | Selected |
|--------|-------------|----------|
| Stock numbers only | Update quantities only, no add/remove sizes | |
| Stock + add/remove sizes | Full edit: check/uncheck sizes + update stock | ✓ |
| You decide | Claude picks | |

**User's choice:** Full variant editing (add/remove sizes + update stock)

---

### Q2: Backend strategy for variant changes

| Option | Description | Selected |
|--------|-------------|----------|
| Delete all + re-insert | DELETE WHERE product_id=? then re-INSERT submitted set | |
| Diff and apply | Insert new, update existing, delete removed | |
| You decide | Claude picks | ✓ |

**Claude's decision:** Delete-all + re-insert — simpler, ON DELETE CASCADE handles cleanup.

---

### Q3: How are zero-stock sizes shown in edit modal?

| Option | Description | Selected |
|--------|-------------|----------|
| Checked (stock=0 is valid variant) | Still shown checked — owner can restock by updating quantity | ✓ |
| Unchecked (zero treated as removed) | Zero-stock loads unchecked — risk of accidental deletion | |
| You decide | Claude picks | |

**User's choice:** Checked — zero-stock sizes shown as active variants in edit modal

---

## Claude's Discretion

- Modal data fetching: fetch `/api/products/:id` on open
- Post-save behavior: close modal + `loadProducts()`
- Variant backend strategy: delete-all + re-insert
- PATCH body format: JSON (not multipart — no image in this phase)
- Cursor/pointer styling on tiles to signal clickability

## Deferred Ideas

- Image replacement when editing — not in ROADMAP scope for Phase 02
- Bulk stock update — future phase
- Category/collection editing in edit form — out of stated scope
