# Phase 05: Critical Hotfixes - Research

**Researched:** 2026-05-09
**Domain:** Node.js/Express backend bug fixes — typo, auth middleware, PII logging, promo atomicity
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Pino serializers in `backend/utils/logger.js` to strip sensitive fields (`password`, `token`, `authorization`, `card`, `cvv`, `secret`) from ALL log output globally. One config change protects every log call site.
- **D-02:** All `500` error responses return generic message to client: `{ error: 'Something went wrong' }`. Full error detail is logged server-side only via `logger.error(err, 'context_label')`. Applies to every route — no exceptions.
- **D-03:** Increment `times_used` on checkout creation (in `POST /api/checkouts`). When a promo code is present in the checkout payload, atomically run `UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ?` as part of checkout creation. Razorpay is disabled (Phase 04 D-06), so payment flow is manual UPI + COD — checkout creation is the right commit point.
- `priceNum` → `price`: Line 271 uses `priceNum` but the validated variable is `price` (declared line 237). Single-word change: `Math.round(price * 100)`.
- `requireOwner` role check: `backend/routes/auth.js:31` already signs JWT with `{ role: "owner" }`. Add `if (payload.role !== 'owner') return res.status(403).json({ error: 'Forbidden' })` after line 19 in `requireOwner.js`.

### Claude's Discretion
None specified beyond implementation approach for the two simpler bugs.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| 05-01 | Fix `priceNum` undefined typo in products.js:271 | Verified: two occurrences on lines 271 and 314 both use `priceNum`; `price` is destructured at line 237 |
| 05-02 | Add `role === 'owner'` check to requireOwner middleware | Verified: middleware is 26 lines, JWT payload confirmed to carry `role: "owner"` per auth.js:31-34 |
| 05-03 | Sanitize PII from all error handlers | Verified: Pino 10.3.1 installed; serializers config is the correct mechanism; multiple routes still return `err.message` directly |
| 05-04 | Atomically increment `times_used` on promo apply in checkouts | Verified: checkouts.js POST handler exists; promo_codes table has `times_used` INTEGER DEFAULT 0; checkouts table has no promo_code column yet — column must be added |
</phase_requirements>

---

## Summary

Phase 05 fixes four isolated bugs in the Express backend. No new dependencies, no schema redesign, and no frontend changes are needed. All fixes stay within the existing `db.prepare().run()` pattern and the established Pino logger.

**Bug 01 — priceNum typo:** `priceNum` is referenced at products.js:271 and products.js:314 but the validated variable is named `price` (destructured at line 237). Both must be renamed. The bug crashes every `POST /api/products` with `ReferenceError: priceNum is not defined`.

**Bug 02 — requireOwner missing role check:** The middleware verifies JWT signature but not the `role` claim. Any valid customer JWT (signed with a different payload shape) would pass as owner. The fix is a single `if (payload.role !== 'owner')` guard after the `jwt.verify()` call.

**Bug 03 — PII in logs/responses:** Several routes still return `err.message` directly to clients and log raw error objects without field redaction. Pino 10.3.1 (installed) supports a `serializers` option that strips named fields globally. The `err` serializer from `pino/lib/std-serializers` can be overridden. Additionally, several routes (`promo.js`, `products.js:49`, `products.js:381`) still use `res.status(500).json({ error: err.message })` instead of the generic message.

**Bug 04 — times_used never incremented:** `POST /api/checkouts` is the correct commit point (D-03), but the current handler does not accept or process a promo code. The fix requires: (a) adding a `promo_code TEXT` column to the `checkouts` table via a safe migration, (b) reading `promo_code` from the request body in `POST /api/checkouts`, and (c) running `UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ? AND is_active = 1` when a promo code is present.

**Primary recommendation:** Treat each bug as a separate, self-contained file edit. Execute in order 01→02→03→04. No task depends on another completing first (no shared file edits), so they could be parallelized, but sequential ordering reduces merge risk.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Price storage (paise) | API / Backend | — | Calculation happens in route handler before DB insert |
| Owner authorization | API / Backend (middleware) | — | JWT verification must happen server-side before any handler runs |
| PII redaction | API / Backend (logger config) | — | Logger is the single cross-cutting concern; serializers apply globally |
| Promo usage tracking | API / Backend (checkout route) | Database | State change (increment) must be atomic with checkout record creation |

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pino | 10.3.1 | Structured JSON logging | Already installed; serializers support built-in |
| jsonwebtoken | ^9.0.2 | JWT sign/verify | Already used in auth.js and requireOwner.js |
| sql.js | ^1.14.1 | SQLite via db.prepare() | Project-wide DB access pattern |
| zod | ^3.23.8 | Input validation | Already in products.js productSchema |

**No new packages needed.** All fixes use existing dependencies.

---

## Architecture Patterns

### System Architecture Diagram

```
POST /api/products
  → requireOwner middleware
      → jwt.verify()  [currently: skips role check]
      → [FIX 02: if payload.role !== 'owner' → 403]
      → next()
  → route handler
      → zod productSchema.safeParse()  [price is here]
      → db.prepare().run(Math.round(price * 100), ...)  [FIX 01: priceNum → price]
      → on error: logger.error(err, label) + res.status(500).json({ error: 'Something went wrong' })
                  [FIX 03: replace err.message in responses]

POST /api/checkouts
  → db.prepare INSERT INTO checkouts ... (id, ..., promo_code)  [FIX 04a: add column]
  → if promo_code present:
      → db.prepare UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ? AND is_active = 1
  → on error: logger.error(err, label) + generic response

logger.js (global)
  → pino({ serializers: { ... } })  [FIX 03a: strip PII fields]
```

### Recommended File Touch List

```
backend/
├── routes/products.js       # Fix 01: priceNum → price (lines 271, 314)
│                            # Fix 03: err.message responses on lines 49, 381
├── middleware/requireOwner.js  # Fix 02: add role check after jwt.verify()
├── utils/logger.js          # Fix 03: add serializers to pino() config
├── routes/promo.js          # Fix 03: 4× err.message on lines 14, 44, 59, 100
├── routes/checkouts.js      # Fix 04: read promo_code, run increment UPDATE
└── db.js                    # Fix 04a: safe migration to add promo_code column to checkouts
```

### Pattern 1: Pino Serializers for PII Redaction

**What:** Pino serializers intercept log fields before writing. A serializer for the `err` key and a custom request serializer can strip sensitive field names globally.

**When to use:** When you want one config change to protect all log call sites without touching individual `logger.error()` calls.

**Example (logger.js replacement):**
```javascript
// Source: pino docs — serializers option
const pino = require('pino');

const REDACTED_FIELDS = ['password', 'token', 'authorization', 'card', 'cvv', 'secret'];

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const key of REDACTED_FIELDS) {
    if (key in out) out[key] = '[REDACTED]';
  }
  return out;
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  serializers: {
    err: pino.stdSerializers.err,  // standard error serializer (stack, message, type)
    req: (req) => redact({
      method: req.method,
      url: req.url,
      // do NOT include req.body here
    }),
  },
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
  } : undefined,
});

module.exports = logger;
```
[VERIFIED: pino 10.3.1 installed in backend/node_modules; `pino.stdSerializers` confirmed present]

### Pattern 2: db.transaction() for Atomic Promo Increment

**What:** `db.transaction(fn)` in db.js wraps a BEGIN/COMMIT/ROLLBACK around synchronous sql.js calls and calls `_save()` once after commit.

**When to use:** When two DB writes must be atomic (checkout insert + promo increment).

**Example (checkouts.js POST handler addition):**
```javascript
// Source: backend/db.js transaction() implementation (lines 309-320)
// Inside the POST /api/checkouts handler, after the INSERT:
if (promo_code) {
  db.prepare(
    'UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ? AND is_active = 1'
  ).run(promo_code.toUpperCase());
}
```

Note: The existing checkout INSERT uses `ON CONFLICT DO UPDATE`, not a transaction wrapper. The promo increment does NOT need to be inside a `db.transaction()` call — it can run as a second prepared statement immediately after the INSERT completes, since sql.js is single-threaded in-memory. However, if strict atomicity is desired, wrapping both in `db.transaction()` is safe per the existing pattern.

[VERIFIED: db.js transaction() pattern confirmed at lines 309-320]

### Pattern 3: requireOwner Role Guard

**What:** After `jwt.verify()` returns the payload, check the `role` field before calling `next()`.

**Example (requireOwner.js complete replacement):**
```javascript
// After: const payload = jwt.verify(token, process.env.JWT_SECRET);
req.owner = payload;
if (payload.role !== 'owner') {
  return res.status(403).json({ error: 'Forbidden' });
}
next();
```
[VERIFIED: auth.js line 31-34 signs with `{ role: "owner", email: ownerEmail }` — field confirmed present]

### Anti-Patterns to Avoid

- **`res.status(500).json({ error: err.message })`** — leaks stack frames, DB error strings, internal paths. Replace with `logger.error(err, 'label'); res.status(500).json({ error: 'Something went wrong' })`.
- **Logging `req.body` directly** — body may contain passwords or card data. Never pass `req.body` to `logger.info/error()` directly.
- **Using `db.transaction()` for reads** — transaction wraps writes only; reads do not need it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PII redaction in logs | Custom middleware that intercepts every logger call | Pino `serializers` config | Serializers are applied at the pino level before any transport; middleware would miss direct logger calls |
| JWT role verification | Re-implement JWT parsing | `jwt.verify()` result + field check | The verify step is already done; only the role field check is missing |
| Atomic DB writes | Manual `BEGIN`/`COMMIT` strings | `db.transaction(fn)` from db.js | Already implemented with ROLLBACK and `_save()` |

---

## Common Pitfalls

### Pitfall 1: Only Fixing One Instance of priceNum
**What goes wrong:** Line 271 is fixed but line 314 (`newValue: { name: name.trim(), price: priceNum, ... }`) still references the undefined variable. The audit log write still throws ReferenceError.
**Why it happens:** The grep returns two hits; a partial fix leaves the audit log broken.
**How to avoid:** Fix both occurrences: line 271 (`Math.round(price * 100)`) and line 314 (`price: price`).
**Warning signs:** Product creation still crashes after the first fix.

### Pitfall 2: promo_code Column Missing from checkouts Table
**What goes wrong:** `POST /api/checkouts` fails with a sql.js column error when trying to INSERT `promo_code` if the column does not exist.
**Why it happens:** The `checkouts` table schema (db.js line 149-160) has no `promo_code` column.
**How to avoid:** Add a safe migration (`safeMigrate('ALTER TABLE checkouts ADD COLUMN promo_code TEXT')`) inside `initDb()` before the fix goes live.
**Warning signs:** `table checkouts has no column named promo_code` error in logs.

### Pitfall 3: Pino pino-pretty Transport and Serializers Conflict
**What goes wrong:** In development mode, pino-pretty is used as a worker_thread transport. Serializers defined in the pino() constructor config apply to the main thread's log object before it is sent to the transport thread — they work correctly. However, if `req` serializer returns undefined for any field, pino-pretty may omit that line.
**Why it happens:** Misunderstanding of where serializers apply in the pipeline.
**How to avoid:** Return a plain object (not undefined) from every serializer. Test by running `node server.js` in dev and watching log output after a login request.

### Pitfall 4: Promo Increment Without is_active Guard
**What goes wrong:** A deactivated promo code can still be passed in the checkout payload and its `times_used` will increment.
**Why it happens:** The WHERE clause omits the `is_active = 1` guard.
**How to avoid:** Use `UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ? AND is_active = 1` — no rows updated if inactive.

### Pitfall 5: err.message Responses in promo.js and products.js
**What goes wrong:** D-02 requires generic 500 responses globally, but promo.js has four spots (lines 14, 44, 59, 100) and products.js has two (lines 49, 381) that still return `err.message`. The fix for logger.js alone does not catch these.
**Why it happens:** Only a file-level grep reveals all the sites; reading only the canonical refs misses promo.js routes.
**How to avoid:** Grep all backend routes for `err.message` before marking 05-03 complete.

---

## Code Examples

### 05-01: priceNum Fix (products.js)

```javascript
// Line 271 — before
Math.round(priceNum * 100),
// Line 271 — after
Math.round(price * 100),

// Line 314 — before
newValue: { name: name.trim(), price: priceNum, stock: totalStock }
// Line 314 — after
newValue: { name: name.trim(), price: price, stock: totalStock }
```
[VERIFIED: codebase read, lines 271 and 314 confirmed]

### 05-02: requireOwner Role Check (requireOwner.js)

```javascript
// Insert after line 19 (req.owner = payload;):
if (payload.role !== 'owner') {
  return res.status(403).json({ error: 'Forbidden' });
}
```
[VERIFIED: codebase read, requireOwner.js is 26 lines; auth.js signs with role: "owner"]

### 05-03: Generic 500 Response Pattern

```javascript
// Replace all: res.status(500).json({ error: err.message })
// With:
logger.error(err, 'context_label');
res.status(500).json({ error: 'Something went wrong' });
```
[VERIFIED: pattern confirmed against CONTEXT.md D-02]

### 05-04: promo_code in checkouts (db.js safe migration + checkouts.js handler)

```javascript
// db.js — add inside initDb() with existing safeMigrate calls:
safeMigrate('ALTER TABLE checkouts ADD COLUMN promo_code TEXT');

// checkouts.js POST handler — extract promo_code from body:
const { id, customer_name, customer_phone, customer_email, items_json, total_paise, promo_code } = req.body;

// After the INSERT/UPDATE:
if (promo_code) {
  db.prepare(
    'UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ? AND is_active = 1'
  ).run(promo_code.toUpperCase());
}
```
[VERIFIED: checkouts table schema read from db.js:149-160; promo_codes table schema read from db.js:254-265]

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `res.status(500).json({ error: err.message })` | `logger.error(err, label)` + `{ error: 'Something went wrong' }` | Prevents stack traces / DB errors reaching clients |
| No role field check in requireOwner | `payload.role !== 'owner'` guard | Any valid JWT no longer passes as owner |
| No promo increment on checkout | Atomic UPDATE after INSERT | Usage limits become enforceable |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `POST /api/checkouts` is the correct place to increment `times_used` (not orders.js) | 05-04 code example | If checkout is not the commit point (e.g., order placement is), increment could be mis-placed and not fire — but CONTEXT.md D-03 locks this decision |
| A2 | The two `priceNum` occurrences on lines 271 and 314 are the only instances in the file | 05-01 | If a third instance exists, product creation would still crash — mitigated by running grep before closing the task |

**Both assumptions are low-risk given direct codebase verification.**

---

## Open Questions

1. **Should the promo increment be wrapped in `db.transaction()` with the checkout INSERT?**
   - What we know: db.js has a `db.transaction(fn)` helper; sql.js is single-threaded so concurrent write races are not a concern.
   - What's unclear: whether the checkout INSERT itself should be atomic with the promo UPDATE.
   - Recommendation: Not strictly necessary for correctness given single-threaded sql.js, but wrapping both in `db.transaction()` is a safe, zero-cost improvement. Planner can decide — both approaches are correct.

2. **Should promo.js GET/POST/DELETE error handlers also be changed to `'Something went wrong'`?**
   - What we know: D-02 says "applies to every route — no exceptions"; promo.js has four `err.message` responses.
   - What's unclear: nothing — D-02 is unambiguous.
   - Recommendation: Yes, all four must be changed in 05-03.

---

## Environment Availability

Step 2.6: SKIPPED — Phase is code/config-only edits to existing backend files. No new external tools, services, CLIs, or runtimes required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (no unit test framework installed in backend) |
| Config file | None |
| Quick run command | `node backend/tests/e2e.js` (manual, requires live server) |
| Full suite command | `node backend/tests/e2e.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 05-01 | POST /api/products succeeds without ReferenceError | smoke | `node backend/tests/e2e.js` (covers product creation indirectly) | ✅ backend/tests/e2e.js |
| 05-02 | Non-owner JWT returns 403 on owner route | unit | manual curl — no automated test | ❌ Wave 0 gap |
| 05-03 | 500 response body contains `'Something went wrong'` not `err.message` | unit | manual curl — no automated test | ❌ Wave 0 gap |
| 05-04 | times_used increments on checkout POST | unit | manual curl — no automated test | ❌ Wave 0 gap |

### Wave 0 Gaps

The backend has no unit test framework. Phase 12 in ROADMAP.md is dedicated to adding test coverage. Given that constraint:

- Manual verification steps in each plan task serve as the acceptance criteria.
- The e2e.js smoke test can partially validate 05-01 (product creation no longer crashes) but cannot test the other three fixes without extensions.
- Planner should include explicit manual verification steps (curl commands or server log inspection) in each task.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (05-02) | JWT role claim verification in requireOwner.js |
| V3 Session Management | no | Not modified in this phase |
| V4 Access Control | yes (05-02) | Role-based guard on owner routes |
| V5 Input Validation | partial | promo_code from request body should be treated as untrusted string |
| V6 Cryptography | no | JWT key not changed; no new crypto |
| V8 Data Protection / Logging | yes (05-03) | PII must not appear in logs |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via missing role check | Elevation of Privilege | requireOwner must check `payload.role === 'owner'` after jwt.verify() |
| PII exposure via log aggregation | Information Disclosure | Pino serializers strip sensitive fields before transport |
| Error message disclosure | Information Disclosure | Generic 500 response body; full error logged server-side only |
| Promo code abuse (usage limits not enforced) | Tampering | Atomic `times_used` increment with `is_active = 1` guard |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — backend/routes/products.js, backend/middleware/requireOwner.js, backend/utils/logger.js, backend/routes/promo.js, backend/routes/auth.js, backend/routes/checkouts.js, backend/db.js — all files read and verified in this session
- backend/package.json — pino 10.3.1 confirmed installed [VERIFIED: npm package.json read]
- CONTEXT.md — all locked decisions verified against code

### Secondary (MEDIUM confidence)
- Pino serializers behavior — based on pino 10.x documentation pattern [ASSUMED: not fetched via Context7 in this session, but the `serializers` key has been stable since pino v5]

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all four bugs directly verified by reading source files
- Fix implementation: HIGH — exact line numbers, variable names, and SQL confirmed in code
- Pino serializers pattern: MEDIUM — API is well-established but not fetched from Context7 this session
- Promo increment placement: HIGH — CONTEXT.md D-03 locks this decision; checkouts.js structure verified

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (stable codebase; no external APIs)
