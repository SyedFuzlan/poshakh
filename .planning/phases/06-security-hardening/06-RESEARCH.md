# Phase 06: Security Hardening - Research

**Researched:** 2026-05-09
**Domain:** Node.js/Express security — bcrypt, HMAC webhook verification, rate limiting, payment idempotency
**Confidence:** HIGH

---

## Summary

Phase 06 targets four distinct security issues in the Express backend, all of which were identified in the original staff-level audit (documented in `backend/allfix.md`). The codebase already has the right libraries installed (`bcryptjs`, `express-rate-limit`, `crypto` built-in) and the right patterns established in `customers.js` — so every plan in this phase is a targeted fix to an existing file, not a new library or architectural change.

**Plan 06-01 (bcrypt owner password):** `auth.js` stores `OWNER_PASSWORD` from `.env` and does a direct string comparison (`password !== ownerPassword`). `bcryptjs` is already installed (used in `customers.js` with `BCRYPT_ROUNDS = 12`). The fix: read `OWNER_PASSWORD_HASH` from `.env` instead (or detect bcrypt format), and replace the string compare with `await bcrypt.compare()`. The login handler must become async.

**Plan 06-02 (timing-safe webhook):** `payments.js` webhook handler already reads `RAZORPAY_WEBHOOK_SECRET` but silently returns `200 ignored` if the secret is missing (line 329). The string comparison `signature !== expectedSig` (line 339) is timing-unsafe. Fix: reject startup or at request time when secret is missing; replace `!==` with `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`.

**Plan 06-03 (rate limiting):** `server.js` applies `authLimiter` (10/hour) to `/api/customers` globally — which covers signup and login. `/api/checkouts` has **no rate limiter** (line 100). The fix is narrow: add a `checkoutLimiter` to the `/api/checkouts` mount. The existing `authLimiter` limits for signup may also be re-evaluated (10/hour is very tight for legitimate users).

**Plan 06-04 (payment idempotency):** `payments.js` already has an application-level SELECT-before-INSERT idempotency check (lines 259-264). The missing piece is a database-level UNIQUE constraint so concurrent duplicate requests cannot race past that check. Add a partial UNIQUE INDEX on `orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL` via `safeMigrate()` in `db.js`. Confirmed working in sql.js via direct test.

**Primary recommendation:** All four fixes are self-contained, no new dependencies needed, no schema migrations that touch existing rows, no new tables. Implement as 4 independent plans, all can run in parallel.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Owner password hashing | API / Backend | — | Auth is server-only; never in browser |
| Webhook HMAC verification | API / Backend | — | Razorpay delivers to server endpoint; secret never leaves server |
| Rate limiting | API / Backend (middleware) | — | Express middleware layer before route handlers |
| Payment idempotency | Database / Storage | API / Backend | DB UNIQUE constraint is the authoritative guard; app-level check is a fast-path optimization |

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Installed Version | Purpose | Role in Phase 06 |
|---------|------------------|---------|-----------------|
| `bcryptjs` | 2.4.3 (latest: 3.0.3 — patch bump, not needed) | Async password hashing | Plan 06-01: hash + compare owner password |
| `express-rate-limit` | 8.5.1 (latest: 8.5.1) | Express rate limiting middleware | Plan 06-03: add checkout limiter |
| `crypto` | built-in (Node.js) | HMAC, timing-safe comparison | Plan 06-02: `timingSafeEqual` |
| `sql.js` | 1.14.1 | SQLite database | Plan 06-04: partial UNIQUE INDEX |

[VERIFIED: npm registry — bcryptjs@2.4.3 installed, latest is 3.0.3 but semver patch; express-rate-limit@8.5.1 is current latest]

**Installation:** No new packages needed. All required libraries are already in `backend/package.json`.

---

## Architecture Patterns

### System Architecture Diagram

```
Owner Browser
     |
     | POST /api/auth/login {email, password}
     v
[authLimiter: 10/hr]
     |
     v
auth.js router
  → bcrypt.compare(password, process.env.OWNER_PASSWORD_HASH)  ← Plan 06-01
  → jwt.sign({role:'owner'}) if match
     |
     v
  JWT token returned

Razorpay Server
     |
     | POST /api/payments/webhook  (raw body, X-Razorpay-Signature header)
     v
payments.js webhook handler
  → REJECT with 500 if WEBHOOK_SECRET missing         ← Plan 06-02 (enforce secret)
  → crypto.timingSafeEqual(sig, expectedSig)          ← Plan 06-02 (timing-safe)
  → parse event, update order status

Customer Browser
     |
     | POST /api/customers/signup
     v
[authLimiter: 10/hr — already applied via server.js line 93]
     |
     v
customers.js router

     | POST /api/checkouts
     v
[checkoutLimiter: NEW — Plan 06-03]
     |
     v
checkouts.js router

Razorpay payment captured
     |
     | POST /api/payments/verify {razorpay_payment_id, ...}
     v
payments.js verify handler
  → Application-level: SELECT id FROM orders WHERE razorpay_payment_id = ?
  → DB-level: UNIQUE INDEX enforces no duplicate INSERT            ← Plan 06-04
  → saveOrder() → INSERT INTO orders
```

### Recommended Project Structure

No new files needed. All changes are in existing files:

```
backend/
├── routes/
│   ├── auth.js           # Plan 06-01: bcrypt owner password
│   └── payments.js       # Plan 06-02: timingSafeEqual + secret enforcement
├── server.js             # Plan 06-03: add checkoutLimiter to /api/checkouts mount
└── db.js                 # Plan 06-04: safeMigrate partial UNIQUE INDEX
```

### Pattern 1: bcrypt Async Password Hashing (Plan 06-01)

**What:** Replace plaintext env var comparison with bcrypt hash comparison.
**When to use:** Any owner login flow where password comes from env/config.

**Current code (auth.js lines 21-26):**
```javascript
const ownerPassword = process.env.OWNER_PASSWORD;
if (
  email.toLowerCase().trim() !== ownerEmail.toLowerCase().trim() ||
  password !== ownerPassword   // ← plaintext compare, timing leak
) {
```

**Target pattern:**
```javascript
// Source: Context7/dcodeio/bcrypt.js
const bcrypt = require('bcryptjs');

// auth.js: login handler must be async
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerHash = process.env.OWNER_PASSWORD_HASH;  // bcrypt hash stored in .env

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  // Always call bcrypt.compare — prevents timing-based user enumeration
  const emailMatch = email.toLowerCase().trim() === ownerEmail.toLowerCase().trim();
  const passwordMatch = ownerHash ? await bcrypt.compare(password, ownerHash) : false;

  if (!emailMatch || !passwordMatch) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  // ... jwt.sign
});
```

**Migration strategy for existing .env:**
The planner must include a task or note that:
1. Owner generates a hash: `node -e "require('bcryptjs').hash('yourpassword', 12).then(console.log)"`
2. Owner sets `OWNER_PASSWORD_HASH=<hash>` in `.env`
3. `OWNER_PASSWORD` can be removed after migration
4. During transition: support detecting bcrypt format (`hash.startsWith('$2')`) to allow both formats

**Salt rounds:** Use 12 (already the project standard — `customers.js` line 16: `const BCRYPT_ROUNDS = 12`). [VERIFIED: codebase grep]

### Pattern 2: Timing-Safe Webhook Signature (Plan 06-02)

**What:** Use `crypto.timingSafeEqual` instead of `!==` for HMAC comparison. Enforce reject if secret is missing.
**When to use:** Any HMAC signature verification.

**Current code (payments.js lines 326-340):**
```javascript
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!webhookSecret) {
  console.warn("RAZORPAY_WEBHOOK_SECRET not set — skipping webhook verification");
  return res.status(200).json({ status: "ignored" });  // ← SILENT FAILURE
}
// ...
if (signature !== expectedSig) {  // ← NOT timing-safe
```

**Target pattern:**
```javascript
// Source: Node.js built-in crypto module
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!webhookSecret) {
  logger.error('RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook');
  return res.status(500).json({ error: 'Webhook not configured' });
}

const signature = req.headers["x-razorpay-signature"];
if (!signature) {
  return res.status(400).json({ error: "Missing signature header" });
}

const expectedSig = crypto
  .createHmac("sha256", webhookSecret)
  .update(req.body)
  .digest("hex");

// Timing-safe comparison — both must be same length (hex strings always are)
const sigBuf = Buffer.from(signature, 'hex');
const expBuf = Buffer.from(expectedSig, 'hex');

if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
  return res.status(400).json({ error: "Invalid webhook signature" });
}
```

**Note on `console.warn` → `logger.warn`:** The webhook handler still uses `console.warn/error` in several places. Phase 06-02 should also convert these to `logger.*` for consistency (the phase 05-04 summary noted this is an outstanding item in payments.js). [VERIFIED: grep on payments.js]

### Pattern 3: Route-Level Rate Limiting (Plan 06-03)

**What:** Add a dedicated rate limiter for the `/api/checkouts` route.
**When to use:** Any Express route that accepts unauthenticated writes.

**Current state (server.js):**
```javascript
app.use("/api/auth", authLimiter, ...);          // 10/hr ← OK for login
app.use("/api/customers", authLimiter, ...);     // 10/hr ← covers signup
app.use("/api/checkouts", checkoutRouter);        // NO limiter ← gap
```

**Target pattern:**
```javascript
// Source: Context7/express-rate-limit/express-rate-limit
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                     // 20 checkout saves per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use("/api/checkouts", checkoutLimiter, checkoutRouter);
```

**Limit rationale:** 20 per 15 minutes is appropriate for an abandoned-cart tracking endpoint. A legitimate user updates their cart as they shop — they won't hit 20 updates in 15 minutes. An attacker harvesting phone numbers via the checkout endpoint would be blocked. [ASSUMED — exact limit should be confirmed with product owner]

**Note on signup authLimiter:** The existing `authLimiter` at 10/hr is applied to ALL of `/api/customers` (signup + login + `/me`). This is tight for signup — a customer who mistyped their password 10 times gets locked out for an hour. Phase 06-03 scope is `/api/checkouts` only; the signup limiter is in scope if the planner decides to adjust it, but is not a blocking issue.

**Memory store:** The default `MemoryStore` in express-rate-limit is correct for this single-process deployment. No Redis needed. [VERIFIED: server.js already uses memory store for existing limiters]

### Pattern 4: Payment Idempotency UNIQUE INDEX (Plan 06-04)

**What:** Add a partial UNIQUE INDEX on `orders(razorpay_payment_id)` to enforce database-level deduplication.
**When to use:** Any column that must be unique among non-NULL rows.

**Current state:**
- `orders` table has `razorpay_payment_id TEXT` (no constraint) — db.js line 193
- Application-level check exists (payments.js lines 259-264: SELECT before INSERT)
- UPI/COD orders have `razorpay_payment_id = NULL` — must remain allowed for multiple NULLs

**Target pattern (in `db.js` `safeMigrate` section):**
```javascript
// Source: sql.js verified via direct test in this session
safeMigrate(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ' +
  'ON orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL'
);
```

**Verified behavior (tested in sql.js):**
- Multiple rows with `razorpay_payment_id = NULL` are accepted (UPI/COD orders)
- Second INSERT with same non-NULL `razorpay_payment_id` throws: `UNIQUE constraint failed: orders.razorpay_payment_id`
- Partial indexes are supported in sql.js 1.14.1

**Error handling in payments.js verify handler:** After adding the UNIQUE INDEX, the catch block in `saveOrder()` (called from `/verify`) may receive the UNIQUE constraint error on rare concurrent duplicates. The existing application-level check (SELECT before INSERT) handles the normal case; the DB constraint handles the race. The `saveOrder` call is already inside a `transaction()` wrapper. The `try/catch` in `router.post("/verify")` should handle the UNIQUE constraint error as a 409 or return the existing order — currently it returns a generic 500. **The planner should consider updating the verify error handler to detect UNIQUE constraint errors and return 200 with `{duplicate: true}`.**

### Anti-Patterns to Avoid

- **Sync bcrypt in login handler:** `bcrypt.hashSync()` / `bcrypt.compareSync()` blocks the Node.js event loop for ~100-200ms per call. Always use async `bcrypt.compare()` in request handlers. [CITED: dcodeio/bcrypt.js README]
- **`Buffer.from(sig)` without encoding:** `Buffer.from(hexString)` without `'hex'` encoding creates a UTF-8 buffer (wrong length), causing `timingSafeEqual` to throw or always fail. Always specify `'hex'` encoding for HMAC hex digests.
- **Rate limiter before `express.raw()`:** The webhook route uses `express.raw({ type: 'application/json' })` inline. Rate limiting the `/api/payments` mount would run before the body parser — that's fine. But do not apply a JSON body parser middleware before the webhook route. Server.js already handles this correctly (lines 79-82).
- **`safeMigrate` without IF NOT EXISTS:** Always use `CREATE UNIQUE INDEX IF NOT EXISTS` — the server restarts after every deploy and `safeMigrate` runs on every startup.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timing-safe string compare | Custom XOR loop | `crypto.timingSafeEqual()` | Node.js built-in, constant-time regardless of content |
| Password hashing | MD5/SHA1/custom | `bcryptjs.hash()` with cost factor | bcrypt includes salt, cost factor, and resistance to GPU attacks |
| Rate limiting state | In-memory counter Map | `express-rate-limit` MemoryStore | Handles window reset, X-RateLimit headers, configurable key generator |
| DB uniqueness | Application-level SELECT-then-INSERT | SQL UNIQUE INDEX | Eliminates TOCTOU race condition between concurrent requests |

---

## Common Pitfalls

### Pitfall 1: OWNER_PASSWORD → OWNER_PASSWORD_HASH migration
**What goes wrong:** Developer adds bcrypt compare but forgets to update `.env`. `OWNER_PASSWORD_HASH` is undefined, `bcrypt.compare(password, undefined)` throws or always returns false, owner locked out.
**Why it happens:** Two-step migration (code + env change) with no startup guard.
**How to avoid:** Add a startup check in `server.js` env validation: require `OWNER_PASSWORD_HASH` (bcrypt format starting with `$2`), warn if `OWNER_PASSWORD` is still set. Include the hash generation command in `.env.example`.
**Warning signs:** Login returns 401 for all attempts immediately after deploy.

### Pitfall 2: timingSafeEqual length mismatch throws
**What goes wrong:** `crypto.timingSafeEqual(a, b)` throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` if buffers have different lengths.
**Why it happens:** If Razorpay sends a malformed/truncated signature header, the hex decode produces a shorter buffer.
**How to avoid:** Always check `sigBuf.length !== expBuf.length` before calling `timingSafeEqual`. Return 400 on mismatch. (HMAC-SHA256 hex is always 64 chars = 32 bytes, so this is a defensive guard against malformed input.)
**Warning signs:** 500 errors on webhook endpoint when signature header is malformed.

### Pitfall 3: Rate limiter on webhook endpoint
**What goes wrong:** If `checkoutLimiter` or `apiLimiter` is accidentally applied to `/api/payments/webhook`, Razorpay's retry system hits the limit and webhook events are lost.
**Why it happens:** Adding a blanket limiter to `/api/payments` or all routes.
**How to avoid:** Apply `checkoutLimiter` only to `/api/checkouts`. Webhook is under `/api/payments` which already uses `apiLimiter` (100/15min) — that's fine for webhooks since Razorpay retries are rare.
**Warning signs:** Orders stuck in `pending_verification` status, Razorpay dashboard shows webhook delivery failures.

### Pitfall 4: UNIQUE INDEX breaks existing UPI/COD orders
**What goes wrong:** A non-partial UNIQUE INDEX (`WITHOUT WHERE`) on `razorpay_payment_id` would treat multiple NULLs as duplicates in some DBs — but SQLite allows multiple NULLs in a standard UNIQUE index. However, using a partial index (`WHERE razorpay_payment_id IS NOT NULL`) is more explicit and forward-compatible.
**Why it happens:** Confusion between SQL standard (NULL != NULL) and SQLite's NULL handling in UNIQUE indexes.
**How to avoid:** Use the partial index pattern. [VERIFIED: direct sql.js test in this session]
**Warning signs:** UPI/COD order creation starts failing with UNIQUE constraint errors after migration.

### Pitfall 5: bcrypt in `POST /api/auth/login` is now async — forgot `await`
**What goes wrong:** If `bcrypt.compare()` is called without `await`, it returns a Promise (truthy), and the `if (!match)` check always evaluates to `false` — every password attempt succeeds.
**Why it happens:** Simple omission when converting synchronous handler to async.
**How to avoid:** The handler MUST use `async (req, res) =>` and `await bcrypt.compare(...)`. Test with a wrong password after implementing.
**Warning signs:** Owner login succeeds regardless of password entered.

---

## Code Examples

### 06-01: bcryptjs async compare (auth.js)

```javascript
// Source: Context7/dcodeio/bcrypt.js — verified via bcryptjs@2.4.3
const bcrypt = require('bcryptjs');

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerHash  = process.env.OWNER_PASSWORD_HASH;  // bcrypt hash in .env

  // Short-circuit on missing config — prevents undefined hash comparison
  if (!ownerHash) {
    logger.error('OWNER_PASSWORD_HASH not set in environment');
    return res.status(500).json({ error: 'Something went wrong' });
  }

  const emailOk = email.toLowerCase().trim() === ownerEmail.toLowerCase().trim();
  const passOk  = await bcrypt.compare(password, ownerHash);  // ← async, timing-safe

  if (!emailOk || !passOk) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { role: "owner", email: ownerEmail },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token, email: ownerEmail });
});
```

**Generate hash for .env:**
```bash
node -e "require('bcryptjs').hash('YourPassword', 12).then(h => console.log('OWNER_PASSWORD_HASH=' + h))"
```

### 06-02: timingSafeEqual webhook verification (payments.js)

```javascript
// Source: Node.js crypto docs — built-in module
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

if (!webhookSecret) {
  logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
  return res.status(500).json({ error: 'Webhook not configured' });
}

const signature = req.headers["x-razorpay-signature"];
if (!signature) {
  return res.status(400).json({ error: "Missing signature" });
}

const expectedSig = crypto
  .createHmac("sha256", webhookSecret)
  .update(req.body)
  .digest("hex");

const sigBuf = Buffer.from(signature,    'hex');  // ← must specify 'hex'
const expBuf = Buffer.from(expectedSig, 'hex');

if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
  return res.status(400).json({ error: "Invalid webhook signature" });
}
```

### 06-03: Checkout rate limiter (server.js)

```javascript
// Source: Context7/express-rate-limit/express-rate-limit — verified against installed v8.5.1
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Replaces: app.use("/api/checkouts", checkoutRouter);
app.use("/api/checkouts", checkoutLimiter, checkoutRouter);
```

### 06-04: Partial UNIQUE INDEX migration (db.js)

```javascript
// Source: SQLite partial index syntax — verified via sql.js@1.14.1 direct test
safeMigrate(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ' +
  'ON orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL'
);
```

Add this line in the `safeMigrate` block in `db.js` (after line 286, after the existing safeMigrates).

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| `password !== envVar` | `bcrypt.compare(password, hash)` | Industry standard since ~2010 |
| `sig !== expectedSig` | `crypto.timingSafeEqual(bufA, bufB)` | Node.js built-in since v6 |
| Application-level SELECT before INSERT | DB UNIQUE INDEX + application check | Defense in depth |
| No checkout rate limit | `express-rate-limit` MemoryStore | No Redis needed at this scale |

**Deprecated/outdated:**
- `bcrypt.compareSync()` in request handlers: blocks event loop, never use in HTTP handlers
- `crypto.createHmac().digest('hex')` compared with `===`: vulnerable to timing attacks on high-latency systems

---

## Open Questions (RESOLVED)

1. **OWNER_PASSWORD_HASH migration path for live system** — RESOLVED
   - What we know: `auth.js` currently uses `OWNER_PASSWORD` (plaintext). After 06-01, it reads `OWNER_PASSWORD_HASH`.
   - Resolution: Include `node -e "require('bcryptjs').hash('YourPassword', 12).then(h => console.log('OWNER_PASSWORD_HASH=' + h))"` hash generation command in the plan. Update `.env.example` to show `OWNER_PASSWORD_HASH`. Add a startup validation in `server.js` required[] check that errors if `OWNER_PASSWORD_HASH` is missing.

2. **Signup rate limit: 10/hr adequate?** — RESOLVED
   - What we know: `authLimiter` (10/hr) already covers `/api/customers/signup` via the parent mount.
   - Resolution: Keep as-is in Phase 06 (it's already applied). Flag for Phase 07 if users report lockouts. Out of Phase 06 scope.

3. **Webhook reject vs. ignore on missing RAZORPAY_WEBHOOK_SECRET** — RESOLVED
   - What we know: Current behavior returns `200 ignored`. Phase 06-02 changes it to `500`.
   - Resolution: Use `500` — the problem is on the server side (missing config), not with the request itself. Razorpay will retry on 5xx, which surfaces the misconfiguration in Razorpay's dashboard.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all changes are code/config-only using already-installed packages).

---

## Validation Architecture

> `workflow.nyquist_validation` not set in `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (package.json test scripts are all `echo 'Skipping'`) |
| Config file | None |
| Quick run command | Manual curl/httpie requests |
| Full suite command | None — Phase 12 adds test suite |

### Phase Requirements → Test Map

| Plan | Behavior | Test Type | How to Verify |
|------|----------|-----------|---------------|
| 06-01 | Login with correct credentials succeeds | smoke | `POST /api/auth/login` with correct email/hash → 200 + token |
| 06-01 | Login with wrong password fails | smoke | `POST /api/auth/login` with wrong password → 401 |
| 06-01 | Login handler is async (no sync block) | code review | grep for `async.*login` in auth.js |
| 06-02 | Webhook with valid signature accepted | smoke | Send crafted webhook with correct HMAC → 200 |
| 06-02 | Webhook with invalid signature rejected | smoke | Send webhook with wrong sig → 400 |
| 06-02 | Webhook rejected when secret missing | code review | grep for `logger.error.*WEBHOOK_SECRET` — no more `console.warn` |
| 06-03 | Checkout route has rate limiter applied | code review | grep for `checkoutLimiter` in server.js |
| 06-04 | Duplicate razorpay_payment_id rejected | smoke | Insert same payment_id twice → second fails with UNIQUE error |
| 06-04 | Multiple NULL payment_ids allowed | smoke | Create 2 UPI/COD orders → both succeed |

### Wave 0 Gaps

No test framework — verification is manual smoke testing per plan. Phase 12 adds automated test suite.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | bcryptjs for password hashing; timing-safe compare |
| V3 Session Management | no | JWT tokens not changed in this phase |
| V4 Access Control | no | requireOwner already fixed in Phase 05 |
| V5 Input Validation | no | No new input surfaces |
| V6 Cryptography | YES | crypto.timingSafeEqual for HMAC; bcrypt cost factor 12 |
| V7 Error Handling | partial | console.warn/error in payments.js still present — opportunity to fix during 06-02 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation | Phase 06 Plan |
|---------|--------|---------------------|---------------|
| Timing attack on HMAC comparison | Tampering | `crypto.timingSafeEqual` | 06-02 |
| Plaintext credential exposure (env breach) | Information Disclosure | bcrypt hash in .env, never plaintext | 06-01 |
| Webhook replay / forged events | Spoofing | HMAC-SHA256 + enforce secret presence | 06-02 |
| Cart spam / phone number harvest via checkouts | Denial of Service | Rate limiting | 06-03 |
| Payment double-charge via race condition | Tampering | DB UNIQUE INDEX | 06-04 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Checkout rate limit of 20/15min is appropriate for a small fashion store | Pattern 3 | Too restrictive → legitimate cart updates blocked; too loose → no protection |
| A2 | Rejecting webhook with 500 (not 400) when RAZORPAY_WEBHOOK_SECRET is missing is correct | Open Questions | Razorpay may handle 5xx vs 4xx differently in retry logic |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/dcodeio/bcrypt.js` — hash and compare API, salt rounds, async patterns
- Context7 `/express-rate-limit/express-rate-limit` — configuration options, route-level middleware
- `backend/routes/auth.js` — current plaintext comparison at lines 21-26 [VERIFIED: direct file read]
- `backend/routes/payments.js` — webhook handler at lines 322-368 [VERIFIED: direct file read]
- `backend/server.js` — rate limiter mounts at lines 38-100 [VERIFIED: direct file read]
- `backend/db.js` — orders schema (no UNIQUE on razorpay_payment_id, line 193), safeMigrate pattern [VERIFIED: direct file read]
- `backend/package.json` — bcryptjs@2.4.3, express-rate-limit@8.5.1, no new installs needed [VERIFIED: direct file read]
- sql.js partial UNIQUE INDEX behavior — [VERIFIED: direct Node.js execution test in this session]
- bcryptjs async compare behavior — [VERIFIED: direct Node.js execution test against installed module]
- crypto.timingSafeEqual behavior — [VERIFIED: direct Node.js execution test]

### Secondary (MEDIUM confidence)
- `backend/allfix.md` — original staff audit identifying all 4 issues with file:line citations
- `backend/routes/customers.js` line 16 — `BCRYPT_ROUNDS = 12` as project standard

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions verified against npm registry
- Architecture: HIGH — source files read directly, patterns verified via execution
- Pitfalls: HIGH — timing attack and bcrypt async pitfalls are well-documented; UNIQUE INDEX behavior verified in sql.js

**Research date:** 2026-05-09
**Valid until:** 2026-08-09 (stable APIs — bcrypt and rate-limit APIs do not change frequently)
