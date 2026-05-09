---
plan: 05-04
phase: 05-critical-hotfixes
status: complete
completed: "2026-05-09"
---

# Summary — Plan 05-04: Error Sanitization + PII Logger

## What Was Built

Two-part ASVS V7.4/V8 compliance fix:

1. **logger.js** — Full replacement adding Pino serializers with `REDACTED_FIELDS = ['password', 'token', 'authorization', 'card', 'cvv', 'secret']`. All log output now strips sensitive fields globally before transport.

2. **Route error handlers** — Replaced all `err.message` in 500 response bodies with `logger.error(err, 'label') + {"error":"Something went wrong"}`:
   - `promo.js` — 4 sites fixed, logger import added
   - `site-settings.js` — 2 sites fixed, logger import added
   - `products.js` — 2 sites fixed (lines 49, 381; logger already present)
   - `payments.js` — 1 site fixed, console.error replaced with logger.error

## Key Files

### Modified
- `backend/utils/logger.js` — Full replacement with REDACTED_FIELDS serializers
- `backend/routes/promo.js` — 4 err.message sites sanitized
- `backend/routes/site-settings.js` — 2 err.message sites sanitized
- `backend/routes/products.js` — 2 err.message sites sanitized
- `backend/routes/payments.js` — 1 err.message + console.error replaced

## Verification

- `grep -rn ".json.*err.message" backend/routes/` → zero matches ✓
- `grep -c "REDACTED_FIELDS" backend/utils/logger.js` → 1 ✓
- Only remaining `err.message` in routes: promo.js UNIQUE constraint internal check (not a response) ✓

## Self-Check: PASSED

All acceptance criteria met. No internal error details exposed to clients anywhere in backend/routes/.
