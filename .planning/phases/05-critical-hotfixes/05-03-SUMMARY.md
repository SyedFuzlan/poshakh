---
plan: 05-03
phase: 05-critical-hotfixes
status: complete
completed: "2026-05-09"
---

# Summary — Plan 05-03: Promo Usage Tracking

## What Was Built

Two-part fix for promo code usage tracking:

1. `backend/db.js` — Added `safeMigrate('ALTER TABLE checkouts ADD COLUMN promo_code TEXT')` after existing migrations (idempotent, safe against existing DBs).
2. `backend/routes/checkouts.js` — POST handler now:
   - Destructures `promo_code` from request body
   - Stores it (uppercased) in the INSERT + ON CONFLICT UPDATE
   - After INSERT, increments `times_used` in `promo_codes` where `code = ? AND is_active = 1`

## Key Files

### Modified
- `backend/db.js` — 1 safeMigrate line added
- `backend/routes/checkouts.js` — promo_code column in INSERT, increment query added

## Verification

- `grep -c "ALTER TABLE checkouts ADD COLUMN promo_code TEXT" backend/db.js` returns `1` ✓
- `grep -c "times_used = times_used + 1 WHERE code = ? AND is_active = 1" backend/routes/checkouts.js` returns `1` ✓

## Self-Check: PASSED

All acceptance criteria met — promo usage now tracked on checkout creation.
