# Phase 05: Critical Hotfixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 05-critical-hotfixes
**Areas discussed:** PII sanitization method, Promo increment timing

---

## PII Sanitization Method

| Option | Description | Selected |
|--------|-------------|----------|
| Pino serializers | Configure pino with `serializers` in logger.js to strip password/token/card fields globally | ✓ |
| sanitizeForLog() helper | Create utils/sanitize.js, call at every logger.error() site | |
| Per-handler manual | Fix only flagged handlers, not systematic | |

**User's choice:** Pino serializers (global)
**Notes:** Global protection preferred — one change covers all future log calls automatically.

---

## Client Error Exposure

| Option | Description | Selected |
|--------|-------------|----------|
| Generic 500 to client | `{error: 'Something went wrong'}` always, full error server-side only | ✓ |
| Only sensitive routes | Sanitize payments/auth only, keep err.message elsewhere | |
| You decide | Claude picks safest default | |

**User's choice:** Generic 500 to all clients — no route exceptions.

---

## Promo Increment Timing

| Option | Description | Selected |
|--------|-------------|----------|
| On checkout create | Increment in POST /api/checkouts when promo code present | ✓ |
| On validate | Increment in POST /api/promo/validate — premature, counts non-buyers | |
| On order confirmed by owner | Increment when owner manually marks UTR verified — complex | |

**User's choice:** On checkout creation.
**Notes:** Razorpay is disabled (Phase 04 D-06), so checkout creation is the appropriate commit point for promo usage.

---

## Claude's Discretion

- `priceNum` → `price` typo fix: single variable rename, no design decision
- `requireOwner` role check: 1-line addition, JWT already has `role: "owner"` in auth.js:31

## Deferred Ideas

None — discussion stayed within phase scope.
