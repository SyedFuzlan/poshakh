---
phase: 07-auth-improvements
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - backend/db.js
  - backend/server.js
  - backend/.env.example
  - backend/routes/customers.js
  - backend/utils/email.js
  - backend/routes/checkouts.js
findings:
  critical: 4
  warning: 6
  info: 3
  total: 13
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-05-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 07 implemented short-lived JWT access tokens (15m), refresh token rotation with httpOnly cookies, `/refresh` and `/logout` endpoints, email verification via Resend, password reset with anti-enumeration, and token table cleanup in `runRecoveryTask`.

The anti-enumeration patterns in `forgot-password` and login are correctly implemented. Tokens are hashed with SHA-256 before storage. The transaction usage in signup and reset-password is sound. However, four critical defects were found: the refresh token rotation is non-atomic (race condition / session destruction window), the auth rate limiter is dangerously misapplied to `/refresh` making the short-lived token architecture self-defeating, the email verification link hardcodes the backend API URL rather than a frontend URL, and abandoned cart SMS messages embed unvalidated user-controlled input.

---

## Critical Issues

### CR-01: Refresh Token Rotation Is Non-Atomic — Race Condition and Session Loss

**File:** `backend/routes/customers.js:201-207`

**Issue:** The rotation sequence performs two separate, non-transactional database writes: first `DELETE FROM refresh_tokens WHERE id = $1`, then (inside `issueTokenPair`) `INSERT INTO refresh_tokens`. If the process crashes, the connection drops, or the INSERT fails for any reason (e.g. DB pool exhaustion, constraint violation) after the DELETE has committed, the customer's refresh token is gone with no replacement. The user is silently logged out with no error recovery path. Additionally, two near-simultaneous requests with the same refresh token (e.g. mobile app background + foreground) will result in the second request seeing the DELETE but getting a 401 — this is a false-positive token theft detection that logs out legitimate users.

```js
// Current (non-atomic):
await db.prepare("DELETE FROM refresh_tokens WHERE id = $1").run(row.id);
const accessToken = await issueTokenPair(res, customer.id, customer.phone);

// Fix: wrap in a transaction
const accessToken = await db.transaction(async (client) => {
  await client.query("DELETE FROM refresh_tokens WHERE id = $1", [row.id]);

  const rawRefresh = generateToken();
  const refreshHash = hashToken(rawRefresh);
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await client.query(
    "INSERT INTO refresh_tokens (customer_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [row.customer_id, refreshHash, refreshExpiry]
  );

  // Set cookie here or return rawRefresh and set it after the transaction
  res.cookie('refreshToken', rawRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/customers',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return signAccessToken(row.customer_id, customer.phone);
});
```

---

### CR-02: `authLimiter` (10 req/hr) Applied to `/refresh` — Short-Lived Token Architecture Made Non-Functional

**File:** `backend/server.js:127`

**Issue:** The entire `/api/customers` prefix is wrapped with `authLimiter` (10 requests per hour). This includes `/api/customers/refresh`. Access tokens expire in 15 minutes, meaning a user who is active for a single hour will need to call `/refresh` up to 4 times per hour just for normal browsing. Any tab refresh, app restart, or background sync pushes the count higher. After 10 refresh calls (possible in under 3 hours of normal use), the user is rate-limited and their access tokens cannot be renewed — they are effectively logged out with a 429, with no self-service recovery path until the hour window resets.

The `authLimiter` is correctly applied to `/api/auth/login` and to `/api/customers/signup` and `/api/customers/login` which are brute-force targets. It must not be applied to `/refresh`, `/logout`, or `/me`.

```js
// Fix: apply separate, looser limiter to the customers router,
// and keep the strict authLimiter only on the write-auth endpoints.

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,  // 60 token refreshes per 15 min window — generous but still DoS-resistant
  standardHeaders: true,
  legacyHeaders: false,
});

// In routes/customers.js, apply tight limiter only to the attack-surface endpoints:
router.post("/signup", authLimiter, async (req, res) => { ... });
router.post("/login",  authLimiter, async (req, res) => { ... });
router.post('/forgot-password', authLimiter, async (req, res) => { ... });
router.post('/reset-password',  authLimiter, async (req, res) => { ... });

// Then in server.js:
app.use("/api/customers", refreshLimiter, require("./routes/customers"));
```

---

### CR-03: Email Verification Link Points to Backend API, Not Frontend

**File:** `backend/utils/email.js:27`

**Issue:** `sendVerificationEmail` constructs the verification link as:

```
${APP_URL}/api/customers/verify-email?token=...
```

`APP_URL` is documented in `.env.example` as the **frontend** URL (e.g. `http://localhost:3000`, `https://poshakh.in`). The `/api/customers/verify-email` endpoint lives on the **backend** (port 9000). So in production with `APP_URL=https://poshakh.in`, the link in the email will be `https://poshakh.in/api/customers/verify-email?token=...` — a 404 on the frontend, never reaching the backend. The token expires unused after 24 hours and the customer cannot verify their email.

```js
// Fix: link should target the backend origin, not APP_URL.
// Add a BACKEND_URL env var, or use a dedicated EMAIL_VERIFY_BASE_URL.

// Option A: add BACKEND_URL to .env.example and use it here:
const link = `${process.env.BACKEND_URL || 'http://localhost:9000'}/api/customers/verify-email?token=${rawToken}`;

// Option B (preferred UX): have APP_URL point to a frontend page that calls the backend:
// Frontend page /verify-email?token=... calls POST /api/customers/verify-email internally.
// In that case, keep APP_URL but change the path to match the frontend route:
const link = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}`;
```

---

### CR-04: SMS Recovery Message Embeds Unvalidated User-Controlled `customer_name`

**File:** `backend/routes/checkouts.js:64-65`

**Issue:** `checkout.customer_name` is stored verbatim from the POST body (no sanitisation in the checkout endpoint) and then interpolated directly into an SMS message string sent via Fast2SMS:

```js
const firstName = checkout.customer_name?.split(' ')[0] || 'there';
const msg = `Hi ${firstName}, you left something beautiful...`;
```

The checkout `POST /` endpoint (lines 13-30) performs no sanitisation on `customer_name` beyond storing it. An attacker can submit a checkout with `customer_name` containing SMS-spoofing payloads (e.g. injecting a newline followed by a fake URL or a second "From:" field, depending on the SMS gateway's handling), phishing content, or excessively long strings to pad the message beyond gateway limits. Fast2SMS imposes a 160-char hard limit on standard SMS, and overlong messages are silently truncated or rejected.

```js
// Fix: sanitise and truncate before interpolation.
const rawName = (checkout.customer_name || '').replace(/[^a-zA-Z\s'-]/g, '').trim();
const firstName = (rawName.split(' ')[0] || 'there').slice(0, 30);
```

---

## Warnings

### WR-01: Multiple Active Password Reset Tokens Per Customer — Old Tokens Not Invalidated

**File:** `backend/routes/customers.js:278-280`

**Issue:** Each call to `POST /forgot-password` inserts a new `password_reset_tokens` row without deleting previous unexpired tokens for that customer. A customer who requests a reset twice in 30 minutes will have two valid reset tokens simultaneously. While not a direct account takeover (the attacker still needs the email), it violates the expected security invariant that issuing a new reset link invalidates the previous one, and it allows an intercepted earlier link to remain usable.

```js
// Fix: delete any existing tokens for this customer before inserting the new one.
// Add this inside the customer-found branch, before the INSERT:
await db.prepare(
  "DELETE FROM password_reset_tokens WHERE customer_id = $1"
).run(customer.id);

await db.prepare(
  "INSERT INTO password_reset_tokens (customer_id, token_hash, expires_at) VALUES ($1, $2, $3)"
).run(customer.id, tokenHash, expiresAt);
```

---

### WR-02: `email_verified` Set to Integer `1` in a PostgreSQL Schema — Type Mismatch

**File:** `backend/routes/customers.js:248`

**Issue:** The schema declares `email_verified INTEGER DEFAULT 0` (migration line 61), so storing `1` is numerically correct. However, this is a PostgreSQL database, not SQLite. The idiomatic PostgreSQL type for a boolean flag is `BOOLEAN`, and queries elsewhere that check `email_verified` with `= true` or `IS TRUE` will silently fail (return zero rows) while queries using `= 1` will work. The mismatch creates a latent correctness hazard: any future code that writes `true`/`false` will break, and any code that reads this column must know to treat it as integer. The schema should be `BOOLEAN DEFAULT FALSE` and the write should use `true`.

```sql
-- Migration fix: alter the column
ALTER TABLE customers ALTER COLUMN email_verified TYPE BOOLEAN USING (email_verified::boolean);
ALTER TABLE customers ALTER COLUMN email_verified SET DEFAULT FALSE;
```
```js
// Code fix in verify-email handler:
await client.query("UPDATE customers SET email_verified = true WHERE id = $1", [row.customer_id]);
```

---

### WR-03: `runRecoveryTask` Swallows Partial-Run Errors — Token Cleanup May Silently Fail

**File:** `backend/routes/checkouts.js:49-83`

**Issue:** The entire `runRecoveryTask` function body is wrapped in a single `try/catch` that logs and swallows all errors. The function first iterates abandoned checkouts (lines 60-73) and then runs three token-cleanup DELETE statements (lines 77-79). If an error occurs during the checkout loop (e.g. a malformed `items_json` causes an uncaught throw outside the per-checkout try block, or `sendSMS` throws synchronously), execution jumps to the catch and the token cleanup DELETEs on lines 77-79 are never reached. Over time this causes `refresh_tokens`, `email_verification_tokens`, and `password_reset_tokens` to accumulate indefinitely.

```js
// Fix: separate the token cleanup into its own try/catch so it always runs.
async function runRecoveryTask() {
  // 1. Abandoned cart recovery (errors here must not block cleanup)
  try {
    // ... existing checkout loop ...
  } catch (err) {
    logger.error(err, 'Abandoned Cart Recovery Task Error');
  }

  // 2. Token cleanup — independent; always runs
  try {
    await db.prepare("DELETE FROM refresh_tokens WHERE expires_at < NOW()").run();
    await db.prepare("DELETE FROM email_verification_tokens WHERE expires_at < NOW()").run();
    await db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < NOW()").run();
  } catch (err) {
    logger.error(err, 'Token cleanup task error');
  }
}
```

---

### WR-04: Owner JWT Is Long-Lived (7 Days) With No Revocation Mechanism

**File:** `backend/routes/auth.js:44`

**Issue:** The owner JWT is signed with a 7-day expiry and is stateless — there is no refresh token, no token table, and no revocation mechanism. A compromised owner token remains valid for up to 7 days with no way to invalidate it short of rotating `JWT_SECRET` (which invalidates all customer tokens too). This is inconsistent with the customer token architecture implemented in Phase 07 and leaves the highest-privilege credential with the weakest revocation posture.

```js
// Minimum fix: reduce expiry to 8h to limit the compromise window.
{ expiresIn: "8h" }

// Better fix: implement owner refresh token rotation mirroring the customer pattern,
// or store a token version field in the JWT and check it against a DB record on each
// protected request.
```

---

### WR-05: `require("jsonwebtoken")` Called Inside Request Handler on Every Request

**File:** `backend/routes/products.js:125`

**Issue:** Inside `GET /api/products`, `require("jsonwebtoken")` is called inline on every request to the route (line 125). While Node.js caches modules after the first `require`, this is a code quality defect: it obscures the dependency, cannot be statically analysed by linters, and creates confusion about the module's import graph. It also means if the require cache is ever invalidated (e.g. in test environments), a fresh file read occurs per request.

```js
// Fix: move to top of file with other imports.
const jwt = require("jsonwebtoken");
```

Note: `products.js` is not in the review scope files, but it is transitively read as context. This finding is recorded here for completeness; it should be fixed in products.js.

---

### WR-06: Promo `times_used` Incremented on Checkout Save, Not on Successful Order

**File:** `backend/routes/checkouts.js:32-35`

**Issue:** `times_used` is incremented whenever a checkout intent is saved with a promo code (i.e. when the cart is first submitted to the abandoned-cart tracker). Since `POST /api/checkouts` can be called multiple times for the same checkout ID (the query uses `ON CONFLICT(id) DO UPDATE`), and since most checkouts never complete into orders, `times_used` will be inflated by abandoned carts and double-incremented on each cart update. This causes valid promo codes to hit their `usage_limit` prematurely, blocking real customers from applying them.

```js
// Fix: remove the times_used increment from POST /api/checkouts entirely.
// Increment it only when an order is confirmed (in the payments/orders flow
// after Razorpay verification or COD placement).
```

---

## Info

### IN-01: `console.error` Used in `/me` Handler — Inconsistent With Logger Pattern

**File:** `backend/routes/customers.js:183`

**Issue:** `GET /api/customers/me` uses `console.error` directly while all other handlers in the same file use `logger.error`. This bypasses the structured pino logger (no request correlation ID, no JSON formatting) and will not appear in log aggregation pipelines that consume pino output.

```js
// Fix: replace with structured logger.
logger.error(err, 'GET /api/customers/me error');
```

---

### IN-02: `formatCustomer` Does Not Expose `email_verified` — Frontend Cannot Gate On Verification Status

**File:** `backend/routes/customers.js:26-34`

**Issue:** `formatCustomer` omits `email_verified` from the returned object. Signup and login both call `formatCustomer`, so the frontend receives no signal about whether the customer's email is verified. This means the frontend cannot prompt the user to verify their email, and the backend has no way to enforce email-verified-only flows (e.g. gating order history access) without an additional round trip. This is a design gap introduced in Phase 07 that should be closed before email verification is surfaced to users.

```js
function formatCustomer(row) {
  return {
    id:             row.id,
    firstName:      row.first_name,
    lastName:       row.last_name,
    phone:          row.phone  || null,
    email:          row.email  || null,
    emailVerified:  row.email_verified === true || row.email_verified === 1,
  };
}
```

---

### IN-03: `JWT_SECRET` Default Value in `.env.example` Is a Descriptive Placeholder, Not a Warning

**File:** `backend/.env.example:11`

**Issue:** `JWT_SECRET=CHANGE_ME_generate_with_command_above` is a string that passes the startup guard `if (!process.env[k])` in `server.js:20` because it is truthy. A developer who copies `.env.example` to `.env` without following the generation instructions will run with a known, publicly-visible secret. The startup guard does not validate that the secret has been changed.

```js
// Fix: add a length/entropy check to the startup guard in server.js.
if (process.env.JWT_SECRET === 'CHANGE_ME_generate_with_command_above' ||
    process.env.JWT_SECRET.length < 32) {
  console.error('❌  JWT_SECRET is insecure. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}
```

---

_Reviewed: 2026-05-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
