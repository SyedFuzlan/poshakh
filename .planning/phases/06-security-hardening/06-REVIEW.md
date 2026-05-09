---
phase: 06-security-hardening
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - backend/routes/auth.js
  - backend/routes/payments.js
  - backend/server.js
  - backend/db.js
  - backend/.env.example
  - backend/tests/webhook-security.test.js
findings:
  critical: 4
  warning: 6
  info: 4
  total: 14
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files were reviewed covering the Phase 06 security-hardening implementation: the auth and payments routes, the Express server entry point, the sql.js database wrapper, the .env.example template, and the webhook security test suite.

The webhook signature verification itself (timing-safe comparison, length guard, hex encoding) is correctly implemented and the test suite covers it well. The price-recalculation server-side check is a genuine improvement. However, four critical bugs were found: a transaction atomicity break that allows partial writes to disk inside an active SQL transaction; a path traversal exposure on the `/uploads` static mount; an authentication crash when `OWNER_EMAIL` is not set at runtime (bypassed the required-env-var check); and insecure pseudo-random order ID generation that makes IDs guessable.

---

## Critical Issues

### CR-01: `prepare().run()` calls `_save()` inside every statement, defeating transaction atomicity

**File:** `backend/db.js:63`

**Issue:** Every call to `prepare(sql).run(...)` unconditionally calls `_save()`, which does `fs.writeFileSync(DB_PATH, Buffer.from(_db.export()))`. The `transaction()` wrapper issues `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` around a callback, but every individual `db.prepare(...).run(...)` call inside that callback still flushes the entire in-memory database to disk at the moment it executes, not after the COMMIT. If the callback throws after the first INSERT (e.g., stock is insufficient on item 2, or the SMS notification raises), the SQL-level ROLLBACK correctly removes the in-memory changes, but the state written to disk by the earlier `.run()` call is gone — the disk file already contains the partial intermediate state from a now-rolled-back transaction.

In `saveOrder()`, the sequence is:

1. First product lookup `.get()` — no save (get does not save).
2. `INSERT INTO orders` via `.run()` → disk save occurs here.
3. `INSERT INTO order_status_history` via `.run()` → disk save again.
4. Loop: `INSERT INTO order_items` + `UPDATE product_variants` + `INSERT INTO inventory_logs` per item — each `.run()` saves disk.

If step 4 throws on item 2, ROLLBACK removes everything from memory, but the disk already shows the order row and item 1's stock decrement. On next server start, the DB is loaded from this corrupted disk file. The result is phantom orders and incorrect inventory.

**Fix:** `_save()` must not be called from within `prepare().run()` when a transaction is active. Track transaction depth with a flag:

```js
let _inTransaction = false;

// In transaction():
function transaction(fn) {
  _inTransaction = true;
  try {
    _db.run('BEGIN TRANSACTION');
    const result = fn();
    _db.run('COMMIT');
    _inTransaction = false;
    _save();
    return result;
  } catch (err) {
    _db.run('ROLLBACK');
    _inTransaction = false;
    throw err;
  }
}

// In prepare().run():
run(...args) {
  // ... execute stmt ...
  if (!_inTransaction) _save();   // only flush when not inside a transaction
  return { lastInsertRowid };
}
```

---

### CR-02: Path traversal on the `/uploads` static file mount

**File:** `backend/server.js:94`

**Issue:** The uploads directory is served without any restriction on what subdirectories can be traversed:

```js
app.use("/uploads", express.static(path.join(__dirname, "data", "uploads")));
```

`express.static` handles `../` sequences internally, but any file placed inside `data/uploads/` (including files uploaded by other routes with insufficient upload-path validation) is publicly accessible with no authentication, no Content-Disposition forcing, and no file-type filtering. More critically, if any upload route allows writing outside the `data/uploads/` subtree (a common symlink or path-traversal bug in file-upload handlers), those files become web-accessible. The static mount also exposes directory listings if the `index` option resolves and there is an `index.html` in a subdirectory.

Additionally, `crossOriginResourcePolicy: { policy: "cross-origin" }` in the Helmet config (line 35) disables CORP for all responses, which means any cross-origin page can embed or fetch uploaded files (e.g., customer photos) without restriction.

**Fix:** Scope the static serve to a sandbox-verified path and add auth for sensitive assets:

```js
// Ensure only the specific directory is exposed (express.static already prevents ../,
// but be explicit with a restrictive dotfiles setting):
app.use(
  "/uploads",
  express.static(path.join(__dirname, "data", "uploads"), {
    dotfiles: "deny",
    index: false,
  })
);
```

For CORP, scope the cross-origin policy to the `/uploads` route only rather than setting it globally in Helmet.

---

### CR-03: Crash (TypeError) in `auth.js` when `OWNER_EMAIL` env var is absent

**File:** `backend/routes/auth.js:33`

**Issue:** The startup guard in `server.js` checks `["OWNER_EMAIL", "OWNER_PASSWORD_HASH", "JWT_SECRET"]` and exits if any are missing. However, `OWNER_EMAIL` is absent from the guard check for the auth route itself. More critically, the guard in `auth.js` only tests `ownerHash` (line 27):

```js
if (!ownerHash) {
  logger.error("OWNER_PASSWORD_HASH not set in environment");
  return res.status(500).json({ error: "Something went wrong" });
}
```

There is **no guard for `ownerEmail`**. If `OWNER_EMAIL` is unset (e.g., accidentally cleared in a running container without restart, or in a test environment that only sets `OWNER_PASSWORD_HASH`), line 33 throws `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` because `ownerEmail` is `undefined`:

```js
const emailOk = email.toLowerCase().trim() === ownerEmail.toLowerCase().trim();
//                                                         ^^^^^^^^^^^^ crashes
```

This unhandled throw propagates into the `catch` block which logs and returns 500, leaking that the route crashed rather than returning the controlled "Something went wrong". While the catch prevents a process crash, the missing guard for `ownerEmail` is a latent bug that is one misconfiguration away from a misleading runtime error.

**Fix:** Add the symmetric guard:

```js
if (!ownerHash || !ownerEmail) {
  logger.error("OWNER_PASSWORD_HASH or OWNER_EMAIL not set in environment");
  return res.status(500).json({ error: "Something went wrong" });
}
```

---

### CR-04: `generateOrderId()` uses `Math.random()` — predictable order IDs

**File:** `backend/routes/payments.js:30`

**Issue:** Order IDs are constructed with:

```js
const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
return `PSK-${ts}-${rand}`;
```

`Math.random()` in V8 uses a non-cryptographic PRNG (xorshift128+). Its output is predictable given sufficient observations of prior values. Since order IDs are returned in API responses and visible to authenticated users, an attacker who places a few orders can seed the PRNG state and predict the IDs of orders placed by other customers. Order IDs are also used as the primary key in status lookups and shipping updates. If any order-lookup route does not require authentication (a common pattern for "track your order" pages), this becomes a direct IDOR that exposes other customers' order details.

**Fix:** Use `crypto.randomBytes` for the random portion:

```js
const crypto = require("crypto"); // already imported in this file
function generateOrderId() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars
  return `PSK-${ts}-${rand}`;
}
```

---

## Warnings

### WR-01: UPI orders have no database-level UNIQUE constraint on `utr`, enabling duplicate-UTR race condition

**File:** `backend/routes/payments.js:302`

**Issue:** The `/upi-confirm` handler does a read-then-write duplicate check:

```js
const existing = db.prepare("SELECT id FROM orders WHERE utr = ?").get(utr.trim());
if (existing) {
  return res.json({ success: true, order_id: existing.id, duplicate: true });
}
// ... saveOrder(...)
```

Unlike `razorpay_payment_id` (which has a UNIQUE index created in `db.js:288`), `utr` has no UNIQUE constraint or index in the schema. Two concurrent requests with the same UTR can both pass the `SELECT` check simultaneously and both write an order row. The `saveOrder()` function also does not check for a UTR collision before INSERT. The Razorpay payment path handles this via `UNIQUE constraint failed` error caught at line 280; the UPI path has no equivalent safeguard.

**Fix:** Add a unique index on `utr` in `db.js`, mirroring the Razorpay index:

```js
safeMigrate(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_utr ' +
  'ON orders(utr) WHERE utr IS NOT NULL'
);
```

Then catch the UNIQUE constraint error in `/upi-confirm` the same way `/verify` does.

---

### WR-02: `price_paise = 0` is treated as falsy — free products bypass server-side price validation

**File:** `backend/routes/payments.js:96`

**Issue:** The price resolution uses a JS truthiness check:

```js
const itemPricePaise = product.price_paise || Math.round(product.price * 100);
```

If `price_paise` is `0` (a legitimately free or promotional product), this expression evaluates `0 || ...` which is falsy, and falls back to `Math.round(product.price * 100)`. If `product.price` is also `0` or `null`, the item contributes `0` paise to `calculatedSubtotalPaise`. This means a cart with legitimate paid items plus a free promotional item is priced correctly by coincidence, but more dangerously: an attacker who can reference a product with `price_paise = 0` in their order can make the server calculate a lower total than what was charged, potentially passing the ±1% mismatch check.

The same pattern appears again at line 165.

**Fix:** Use an explicit null/undefined check:

```js
const itemPricePaise = (product.price_paise != null)
  ? product.price_paise
  : Math.round(product.price * 100);
```

---

### WR-03: `db.js` `transaction()` uses `_db.run()` (the raw sql.js method) instead of the wrapper `prepare().run()` — the `_save()` inside the wrapper fires anyway

**File:** `backend/db.js:316–324`

**Issue:** The `transaction()` helper calls `_db.run('BEGIN TRANSACTION')` and `_db.run('COMMIT')` directly on the sql.js database object (correct — these are control statements, not data statements). However, the callback `fn()` passed to `transaction()` uses the public `prepare()` API, whose `run()` method calls `_save()` on every statement (see CR-01). This creates a design where the `transaction()` function itself correctly defers the final `_save()`, but the inner statements undo that intent. The fix for CR-01 resolves this, but the structural issue — `_save()` being embedded in the statement-level `.run()` rather than in a dedicated persistence layer — is the root cause.

**Fix:** See CR-01.

---

### WR-04: `contentSecurityPolicy: false` disables CSP globally

**File:** `backend/server.js:34`

**Issue:** Helmet's Content Security Policy is disabled entirely:

```js
app.use(helmet({
  contentSecurityPolicy: false,
  ...
}));
```

This API server does serve HTML — the owner dashboard at `/dashboard` (line 97) is a static HTML file. Without CSP, any XSS vulnerability in the dashboard HTML or a dependency would have no browser-level mitigation. Since the dashboard is the privileged admin interface, it is the highest-value target.

**Fix:** Enable a restrictive CSP, at minimum for the dashboard routes:

```js
// Allow the dashboard to load its own assets only
app.use("/dashboard", helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
  },
}));
```

---

### WR-05: CORS allows any `*.up.railway.app` and `*.vercel.app` subdomain — third-party attacker surface

**File:** `backend/server.js:65–66`

**Issue:**

```js
origin.endsWith('.up.railway.app') ||
origin.endsWith('.vercel.app') ||
```

This allows any deployment on Railway or Vercel's shared infrastructure to make credentialed requests to this API. Any other developer on Railway or Vercel who can register a subdomain (i.e., any user of those platforms) gets CORS access with `credentials: true`. In practice this means any attacker with a free Railway or Vercel account can host a page that makes authenticated requests to this API on behalf of victims. The intended allowlist is the developer's own staging/preview deployments.

**Fix:** Replace the wildcard suffix checks with an explicit allowlist of known deployment URLs, or use `STORE_CORS` env var for all non-localhost origins:

```js
const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:9000',
  'https://www.madebyzohra.in',
  'https://madebyzohra.in',
  ...(process.env.STORE_CORS || '').split(',').map(o => o.trim()).filter(Boolean),
]);

origin: (origin, callback) => {
  if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
  callback(new Error(`CORS: origin ${origin} not allowed`));
},
```

---

### WR-06: `express.urlencoded({ extended: true, limit: "10mb" })` applied to all routes including the webhook

**File:** `backend/server.js:91`

**Issue:** The webhook route has a special middleware chain that uses `express.raw({ type: "application/json" })` to capture the raw request body for HMAC verification. The JSON body parser is correctly skipped for `/api/payments/webhook` (line 87–90). However, `express.urlencoded` at line 91 is applied to **all** routes unconditionally, including the webhook. A `Content-Type: application/x-www-form-urlencoded` request to the webhook route will be parsed by `express.urlencoded` before the route's `express.raw` middleware sees it, causing `req.body` to be a parsed object instead of a `Buffer`. The HMAC check then fails or throws when calling `req.body.toString()` on a plain object, resulting in a 500 instead of a 400.

**Fix:** Apply the same exclusion to `urlencoded` that is applied to the JSON parser:

```js
app.use((req, res, next) => {
  if (req.path === "/api/payments/webhook") return next();
  express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
});
```

---

## Info

### IN-01: `console.log` / `console.error` used in payment routes alongside the structured `logger`

**File:** `backend/routes/payments.js:276,317,320`

**Issue:** Three statements use raw `console` methods instead of the structured `pino` logger that is imported and used elsewhere in the same file:

- Line 276: `console.log(`✅ Order saved: ...`)`
- Line 317: `console.log(`📱 UPI order saved: ...`)`
- Line 320: `console.error("POST /api/payments/upi-confirm error:", err)`

This means these events do not appear in structured JSON log output in production, losing context fields (orderId, method, etc.) and making log aggregation/alerting harder.

**Fix:** Replace with `logger.info(...)` / `logger.error(...)` calls consistent with the rest of the file.

---

### IN-02: `www.www.madebyzohra.in` typo in CORS allowlist

**File:** `backend/server.js:71`

**Issue:** The hardcoded allowlist includes `'https://www.www.madebyzohra.in'` — a double `www` prefix that is almost certainly a typo and will never be a real origin. This is dead code that adds noise to the allowlist and could mask a missing legitimate entry.

**Fix:** Remove the erroneous entry.

---

### IN-03: `shipping_cost` stored in wrong column in `saveOrder` INSERT

**File:** `backend/routes/payments.js:148`

**Issue:** The INSERT statement stores the raw `shipping_cost` value (from `orderData`, which is a rupee float) in the `shipping_cost_paise` column:

```js
shipping_cost, // Keep legacy if needed, but we should use paise
```

`calculatedTotalPaise` and `subtotal_paise` are correctly in paise, but `shipping_cost_paise` receives a rupee-denomination value (e.g., `50.0` instead of `5000`). The inline comment acknowledges the problem. Any downstream query that reads `shipping_cost_paise` and treats it as paise will produce incorrect shipping amounts (100x error).

**Fix:** Replace `shipping_cost` with `shippingCostPaise` (already calculated at line 101):

```js
shippingCostPaise,  // was: shipping_cost
```

---

### IN-04: `.env.example` `JWT_SECRET` default value is a plain English string, not a placeholder that fails fast

**File:** `backend/.env.example:11`

**Issue:**

```
JWT_SECRET=CHANGE_ME_generate_with_command_above
```

If a developer copies `.env.example` to `.env` without replacing this value, the application starts successfully (the startup guard only checks that the variable is non-empty, not that it looks like a real secret). JWTs signed with the literal string `CHANGE_ME_generate_with_command_above` are trivially forgeable by anyone who reads the public repository.

**Fix:** The startup guard in `server.js` should validate that `JWT_SECRET` is of sufficient length (e.g., ≥ 32 characters of entropy), not just non-empty. Alternatively, require it to not match the example value:

```js
if (process.env.JWT_SECRET === 'CHANGE_ME_generate_with_command_above') {
  console.error('JWT_SECRET must be changed from the example value');
  process.exit(1);
}
```

---

_Reviewed: 2026-05-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
