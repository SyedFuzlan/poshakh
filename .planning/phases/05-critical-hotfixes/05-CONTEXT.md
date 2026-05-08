# Phase 05: Critical Hotfixes - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 4 deploy-blocking bugs in the Node.js/Express backend. No new features, no schema changes, no new dependencies. All fixes must work with the existing SQLite (sql.js) + `db.prepare()` pattern.

Bugs in scope:
1. `priceNum` undefined typo in `backend/routes/products.js:271` — crashes product creation
2. `requireOwner` middleware missing `role === 'owner'` check — any valid JWT passes as owner
3. All error handlers leaking PII/raw errors to logs and clients
4. Promo `times_used` never incremented — usage limits never enforced

</domain>

<decisions>
## Implementation Decisions

### PII Sanitization
- **D-01:** Use **Pino serializers** in `backend/utils/logger.js` to strip sensitive fields (`password`, `token`, `authorization`, `card`, `cvv`, `secret`) from ALL log output globally. One config change protects every log call site.
- **D-02:** All `500` error responses return **generic message to client**: `{ error: 'Something went wrong' }`. Full error detail is logged server-side only via `logger.error(err, 'context_label')`. Applies to every route — no exceptions.

### Promo Usage Tracking
- **D-03:** Increment `times_used` **on checkout creation** (in `POST /api/checkouts`). When a promo code is present in the checkout payload, atomically run `UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ?` as part of checkout creation. Razorpay is disabled (Phase 04 D-06), so payment flow is manual UPI + COD — checkout creation is the right commit point.

### Bug Fixes (Claude's Discretion)
- `priceNum` → `price`: Line 271 uses `priceNum` but the validated variable is `price` (declared line 237). Single-word change: `Math.round(price * 100)`.
- `requireOwner` role check: `backend/routes/auth.js:31` already signs JWT with `{ role: "owner" }`. Add `if (payload.role !== 'owner') return res.status(403).json({ error: 'Forbidden' })` after line 19 in `requireOwner.js`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files to Fix
- `backend/routes/products.js` — contains `priceNum` typo at line 271; POST handler starts at line 226
- `backend/middleware/requireOwner.js` — missing role check; full file is 26 lines
- `backend/routes/promo.js` — validate endpoint at line 66; checkout integration needed
- `backend/utils/logger.js` — Pino config to update with serializers

### Auth Context
- `backend/routes/auth.js` — JWT signing at line 31 already includes `{ role: "owner" }`. Confirms role field exists in tokens.

### Checkout Integration (for promo fix)
- `backend/routes/checkouts.js` — POST /api/checkouts handler; promo code must be incremented here

### Patterns
- `backend/db.js` — `db.prepare().run()` pattern required for all DB ops; no raw SQL strings

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Established Patterns
- `db.prepare('SQL').run(params)` / `.get(params)` / `.all(params)` — required for all DB operations
- `logger` from `backend/utils/logger.js` — already imported in some routes; use for all error logging
- `res.status(500).json({ error: err.message })` — current anti-pattern to replace with `logger.error(err, 'label')` + `res.status(500).json({ error: 'Something went wrong' })`

### Integration Points
- Promo increment goes inside `POST /api/checkouts` — read checkouts.js to find where promo code is consumed
- Pino serializer config: add `serializers` key to pino() call in logger.js

</code_context>

<specifics>
## Specific Ideas

- Pino serializer strips fields by key name globally — catches nested objects too (e.g., `req.body.password` if accidentally logged)
- Promo increment: `UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ? AND is_active = 1` — the `AND is_active = 1` guard prevents incrementing on deactivated codes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-critical-hotfixes*
*Context gathered: 2026-05-09*
