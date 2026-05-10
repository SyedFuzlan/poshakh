# Phase 7: Auth Improvements - Research

**Researched:** 2026-05-10
**Domain:** JWT token lifecycle management, email delivery, Node.js/Express auth patterns
**Confidence:** HIGH

---

## Summary

Phase 07 replaces the existing 30-day long-lived JWT for customers with a short-lived access token (15 min) paired with a 7-day refresh token stored in the database. It adds a logout endpoint, email verification on customer signup, and a password reset flow (forgot → email token → reset endpoint). The owner auth flow (`/api/auth/login`) uses a different, simpler scheme and is largely unaffected — the refresh token system applies only to the customer-facing routes in `routes/customers.js`.

The codebase already has `jsonwebtoken` 9.0.3, `bcryptjs` 2.4.3, and `crypto` (Node.js built-in) installed. No email library exists in the active Express backend — the old Medusa code used Resend but is archived and not part of the live server. Email delivery must be added from scratch, and **Resend is the established choice for this project** (already in `.medusa/server/src/lib/email.js`, domain `poshakh.in` likely already verified, FROM address `Poshakh <noreply@poshakh.in>`).

The in-memory sql.js database persists synchronously to disk via `_save()` on every `run()`. New tables (`refresh_tokens`, `email_verification_tokens`, `password_reset_tokens`) follow the identical `CREATE TABLE IF NOT EXISTS` + `safeMigrate()` pattern used throughout `db.js`. The `_save()` call is automatic on every write — no special persistence handling is needed for token tables.

**Primary recommendation:** Use Resend npm package for email, store refresh tokens as SHA-256 hashes in a new `refresh_tokens` table, store verification/reset tokens as `crypto.randomBytes(32).toString('hex')` with expiry timestamps in SQLite.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Access token issuance | API / Backend (`routes/customers.js`) | — | JWT signing requires JWT_SECRET, must not expose to client |
| Refresh token issuance & rotation | API / Backend (`routes/customers.js` + new route) | — | Long-lived credentials must be server-managed and revocable |
| Refresh token storage | Database / Storage (SQLite `refresh_tokens` table) | — | Tokens must be revocable; requires persistence |
| Logout / revocation | API / Backend (`routes/customers.js`) | Database | DELETE from `refresh_tokens` on logout |
| Email verification token generation | API / Backend (`routes/customers.js`) | — | Server-side crypto, stored in DB |
| Email delivery | API / Backend (`utils/email.js` — new) | External (Resend API) | No SMTP infra; Resend is pre-established choice |
| Password reset token | API / Backend (`routes/customers.js` or new route) | — | Server-side crypto, stored with expiry |
| Frontend token refresh | Browser / Client | — | Client stores access token in memory, refresh token in httpOnly cookie |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| 07-01 | Refresh token system: 15min access + 7d refresh, POST /api/auth/refresh | `jwt.sign()` with `expiresIn: '15m'`; new `refresh_tokens` DB table; cookie-parser for reading httpOnly cookie |
| 07-02 | Logout endpoint — invalidate refresh token in DB | DELETE from `refresh_tokens` WHERE token_hash = SHA256(inbound token) |
| 07-03 | Email verification flow on signup | `crypto.randomBytes(32).toString('hex')` token, `email_verification_tokens` table, Resend SDK, GET /api/customers/verify-email?token= |
| 07-04 | Password reset flow (forgot → token email → reset endpoint) | Same token pattern as 07-03; POST /api/customers/forgot-password, POST /api/customers/reset-password; single-use token enforced by DELETE after use |
</phase_requirements>

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsonwebtoken | 9.0.3 [VERIFIED: npm view] | Sign/verify JWTs | Already in use throughout codebase |
| bcryptjs | 2.4.3 [VERIFIED: npm view] | Hash passwords | Already in use; bcryptjs is pure-JS fallback for bcrypt |
| crypto | Node.js built-in | Generate secure random tokens | Used in existing `generateOrderId`, `generateCustomerId` |

### New (must install)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| resend | 6.12.3 [VERIFIED: npm view] | Transactional email API | Email verification + password reset |
| cookie-parser | 1.4.7 [VERIFIED: npm view] | Parse httpOnly cookie carrying refresh token | Required to read `req.cookies.refreshToken` in Express |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| resend | nodemailer (8.0.7) | nodemailer needs an SMTP server; Resend is API-only, matches prior Medusa choice, has 100 emails/day free tier |
| httpOnly cookie for refresh token | Bearer header | Cookie is XSS-safe; Bearer requires frontend JS access (less secure) |
| SHA-256 hash of refresh token in DB | Store raw token | Hash prevents DB-dump attackers from using stolen tokens |

**Installation:**
```bash
cd backend && npm install resend cookie-parser
```

**Version verification:** Confirmed against npm registry on 2026-05-10.
- resend: 6.12.3
- cookie-parser: 1.4.7
- jsonwebtoken: 9.0.3 (installed)
- bcryptjs: 2.4.3 (installed)

---

## Architecture Patterns

### System Architecture Diagram

```
Customer Login / Signup
        │
        ▼
routes/customers.js
  POST /api/customers/login
  POST /api/customers/signup
        │
        ├── jwt.sign({ role:'customer', id }, JWT_SECRET, { expiresIn: '15m' })
        │           → accessToken (short-lived, returned in JSON body)
        │
        └── crypto.randomBytes(32).toString('hex')
                    → refreshToken (opaque, long-lived)
                    → SHA256(refreshToken) stored in refresh_tokens table
                    → set-cookie: refreshToken=...; HttpOnly; SameSite=Strict; Path=/api/customers/refresh

POST /api/customers/refresh  (new endpoint)
        │
        ├── read refreshToken from req.cookies.refreshToken
        ├── SHA256(inbound token) → look up in refresh_tokens WHERE token_hash = ? AND expires_at > now
        ├── DELETE old token row (rotation: old token invalidated)
        ├── INSERT new refresh token row (new 7d token)
        ├── jwt.sign(...) → new 15m accessToken
        └── set-cookie with new refreshToken

POST /api/customers/logout  (new endpoint)
        │
        ├── read refreshToken from req.cookies.refreshToken
        ├── DELETE from refresh_tokens WHERE token_hash = SHA256(inbound)
        └── res.clearCookie('refreshToken')

POST /api/customers/signup  (modified)
        │
        ├── create customer (existing logic)
        ├── crypto.randomBytes(32).toString('hex') → emailToken
        ├── INSERT into email_verification_tokens (customer_id, token_hash, expires_at = +24h)
        └── resend.emails.send(verificationEmail with link /api/customers/verify-email?token=)

GET /api/customers/verify-email?token=  (new endpoint)
        │
        ├── look up token in email_verification_tokens WHERE token = ? AND expires_at > now
        ├── UPDATE customers SET email_verified = 1 WHERE id = customer_id
        ├── DELETE from email_verification_tokens WHERE token = ?
        └── 200 { verified: true }

POST /api/customers/forgot-password  (new endpoint)
        │
        ├── find customer by email (no error if not found — anti-enumeration)
        ├── crypto.randomBytes(32).toString('hex') → resetToken
        ├── INSERT into password_reset_tokens (customer_id, token_hash, expires_at = +30min)
        └── resend.emails.send(resetEmail with link /api/customers/reset-password?token=)

POST /api/customers/reset-password  (new endpoint)
        │
        ├── validate token from body against password_reset_tokens table
        ├── bcrypt.hash(newPassword, 12) → hash
        ├── UPDATE customers SET password_hash = hash WHERE id = customer_id
        └── DELETE from password_reset_tokens WHERE token_hash = ?
```

### Recommended Project Structure

```
backend/
├── routes/
│   └── customers.js          # all 4 new endpoints added here
├── utils/
│   ├── email.js              # NEW: sendVerificationEmail(), sendPasswordResetEmail()
│   ├── sms.js                # existing
│   └── logger.js             # existing
└── db.js                     # add 3 new CREATE TABLE IF NOT EXISTS blocks + safeMigrate entries
```

### Pattern 1: Refresh Token DB Schema

**What:** Three new tables appended to the `CREATE TABLE IF NOT EXISTS` block in `db.js`.
**When to use:** Token storage with expiry and revocation.
**Example:**
```javascript
// Source: standard refresh token pattern [VERIFIED: multiple authoritative sources]
// Add inside the existing db.run(`CREATE TABLE IF NOT EXISTS ...`) block in db.js

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT    NOT NULL,
  token_hash  TEXT    NOT NULL UNIQUE,      -- SHA-256 hex of the opaque token
  expires_at  TEXT    NOT NULL,             -- ISO8601
  created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT    NOT NULL,
  token_hash  TEXT    NOT NULL UNIQUE,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT    NOT NULL,
  token_hash  TEXT    NOT NULL UNIQUE,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

### Pattern 2: Token Generation and Hashing

**What:** Opaque random token + SHA-256 hash for storage.
**When to use:** All three token types in this phase.
**Example:**
```javascript
// Source: Node.js crypto docs [VERIFIED: Node.js built-in, project already uses crypto.randomBytes]
const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex string
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Usage: send rawToken to user, store hashToken(rawToken) in DB
const rawToken = generateToken();
const tokenHash = hashToken(rawToken);
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7d refresh
```

### Pattern 3: Refresh Token Rotation

**What:** On every refresh, delete old token row and insert new one. One token per session.
**When to use:** POST /api/customers/refresh handler.
**Example:**
```javascript
// Source: OWASP refresh token rotation pattern [CITED: dev.to/rahuls24/essential-jwt-security-part-2]
router.post('/refresh', (req, res) => {
  const inbound = req.cookies?.refreshToken;
  if (!inbound) return res.status(401).json({ error: 'No refresh token' });

  const inboundHash = hashToken(inbound);
  const row = db.prepare(
    "SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')"
  ).get(inboundHash);

  if (!row) return res.status(401).json({ error: 'Invalid or expired refresh token' });

  // Rotate: delete old, issue new
  db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(row.id);

  const newRaw = generateToken();
  const newHash = hashToken(newRaw);
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO refresh_tokens (customer_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .run(row.customer_id, newHash, newExpiry);

  const customer = db.prepare("SELECT id, phone FROM customers WHERE id = ?").get(row.customer_id);
  const accessToken = jwt.sign(
    { role: 'customer', id: customer.id, phone: customer.phone },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  res.cookie('refreshToken', newRaw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/customers/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ accessToken });
});
```

### Pattern 4: Resend Email Utility

**What:** Thin wrapper in `backend/utils/email.js` matching existing project style.
**When to use:** Email verification and password reset.
**Example:**
```javascript
// Source: Resend official docs [CITED: resend.com/docs/send-with-nodejs]
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Poshakh <noreply@poshakh.in>';

async function sendVerificationEmail(to, token) {
  const link = `${process.env.APP_URL}/api/customers/verify-email?token=${token}`;
  // In dev: log to console, skip API call
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Email verification link for ${to}: ${link}`);
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Verify your Poshakh email',
    html: `<p>Click to verify your email: <a href="${link}">${link}</a></p>
           <p>This link expires in 24 hours.</p>`,
  });
  if (error) throw new Error(`Email delivery failed: ${error.message}`);
}

async function sendPasswordResetEmail(to, token) {
  const link = `${process.env.APP_URL}/reset-password?token=${token}`;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Password reset link for ${to}: ${link}`);
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your Poshakh password',
    html: `<p>Click to reset your password: <a href="${link}">${link}</a></p>
           <p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>`,
  });
  if (error) throw new Error(`Email delivery failed: ${error.message}`);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
```

### Pattern 5: Signup Modification (email verification flag)

**What:** Add `email_verified` column to `customers` table, set to 0 on signup.
**When to use:** Required for Plan 07-03 to track verification state.
**Example:**
```javascript
// In db.js safeMigrate block:
safeMigrate('ALTER TABLE customers ADD COLUMN email_verified INTEGER DEFAULT 0');
```

### Anti-Patterns to Avoid

- **Storing raw refresh token in DB:** If the DB is compromised, attackers can use the tokens directly. Always store `SHA-256(token)` and send the raw token only to the client.
- **Sharing `/api/auth/refresh` path with owner login:** Owner auth and customer auth are separate systems. The refresh endpoint lives in `routes/customers.js`, not `routes/auth.js`.
- **Sending `400` for unknown email in forgot-password:** Leaks user existence. Always return `200 { message: 'If that email exists, a reset link has been sent' }`.
- **Not deleting used reset/verification tokens:** Must DELETE immediately on use — single-use enforcement prevents replay attacks.
- **Using `expiresIn: '30d'` in the new `signCustomerToken`:** The existing `signCustomerToken` function still uses `30d`. For Plans 07-01 and 07-02, this function must be replaced or a new `signAccessToken` function created with `'15m'`.
- **Setting `path: '/'` on the refresh cookie:** Cookie should be scoped to `path: '/api/customers/refresh'` (and `/api/customers/logout`) so the browser only sends it to those endpoints.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | SMTP client from scratch | resend npm package | SMTP requires mail server config, SPF/DKIM setup; Resend handles deliverability |
| Secure random token | Math.random() | `crypto.randomBytes(32)` | Math.random is predictable; crypto is CSPRNG |
| Token hashing | MD5 or custom hash | `crypto.createHash('sha256')` | SHA-256 is standard; MD5 is broken |
| JWT refresh logic | Custom token format | `jwt.sign` with `expiresIn: '15m'` + opaque refresh token | JWT handles expiry, signing, and verification |

**Key insight:** Email deliverability (SPF, DKIM, bounce handling, rate limits) is a solved problem via Resend — the project already has a `poshakh.in` domain with a `noreply@poshakh.in` address in the old Medusa code, strongly suggesting the domain is already registered with Resend.

---

## Common Pitfalls

### Pitfall 1: Breaking Existing Customer Sessions on Deployment

**What goes wrong:** When the new code deploys, all existing 30-day JWTs are still valid by signature but have `role: 'customer'`. The new middleware (`requireCustomer`) still validates them. However, if you change `requireCustomer` to also require `id` in payload, old tokens that lack `id` would break. Current `signCustomerToken` already includes `id` — so existing tokens are forward-compatible.
**Why it happens:** Payload shape changes during token system migration.
**How to avoid:** Verify that the existing `signCustomerToken` payload `{ role: 'customer', id, phone }` is identical to the new access token payload before deploying. Do not add required claims that old tokens lack.
**Warning signs:** Users get 401 errors immediately after deploy without re-login.

### Pitfall 2: sql.js Transaction Safety for Token Operations

**What goes wrong:** Signup creates a customer row and an email verification token row. If email sending fails after the customer row is committed, the customer exists but has no token — cannot re-verify.
**Why it happens:** sql.js `run()` calls auto-save via `_save()`. Without a transaction, partial state is persisted.
**How to avoid:** Wrap the customer INSERT + token INSERT in `db.transaction(() => { ... })` (the helper already exists in `db.js`). Only call `sendVerificationEmail` after the transaction commits.
**Warning signs:** `email_verification_tokens` table has zero rows for recently created customers.

### Pitfall 3: Cookie Not Sent by Next.js Frontend

**What goes wrong:** The frontend (Next.js on port 3000) calls `/api/customers/refresh` on the backend (port 9000). Browsers block cross-origin cookies unless `credentials: 'include'` is set on the fetch call, and the backend's CORS config allows credentials from the frontend origin.
**Why it happens:** Default fetch does not send cookies cross-origin.
**How to avoid:** (1) Backend `cors({ credentials: true })` is already configured. (2) The frontend fetch must use `credentials: 'include'`. Document this requirement in the plan. (3) `sameSite: 'strict'` will not work cross-origin — use `sameSite: 'none'` with `secure: true` in production if frontend and backend have different origins. `sameSite: 'lax'` works for same-site subdomains.
**Warning signs:** `req.cookies` is empty in the refresh endpoint even though the cookie was set.

### Pitfall 4: RESEND_API_KEY Not in Env Validation

**What goes wrong:** `server.js` validates `OWNER_EMAIL`, `OWNER_PASSWORD_HASH`, `JWT_SECRET` on startup. `RESEND_API_KEY` is not validated. In production, a missing key silently skips email sending in dev mode (guarded by `NODE_ENV !== 'production'`), but crashes with an error in production.
**Why it happens:** New env vars are not added to the startup validation list.
**How to avoid:** Add `RESEND_API_KEY` and `APP_URL` to the `required` array in `server.js`, or conditionally require them when `NODE_ENV === 'production'`.
**Warning signs:** `resend.emails.send()` returns `{ error: { name: 'missing_api_key', ... } }`.

### Pitfall 5: Expired Token Rows Accumulating in SQLite

**What goes wrong:** Expired refresh tokens, verification tokens, and reset tokens are never cleaned up. SQLite has no TTL mechanism. Over time the tables grow unboundedly.
**Why it happens:** No cleanup task is implemented.
**How to avoid:** Add a cleanup to the existing `runRecoveryTask` function in `routes/checkouts.js` (already runs every 30min) — `DELETE FROM refresh_tokens WHERE expires_at < datetime('now')` etc.
**Warning signs:** `refresh_tokens` table has thousands of rows for a low-traffic store.

---

## Code Examples

### Issue access + refresh tokens (new login pattern)
```javascript
// Source: standard JWT + opaque refresh token pattern
// [VERIFIED: jsonwebtoken docs, CITED: dev.to refresh token guides]
function signAccessToken(customerId, phone) {
  return jwt.sign(
    { role: 'customer', id: customerId, phone: phone || null },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

async function issueTokenPair(res, customerId, phone) {
  const accessToken = signAccessToken(customerId, phone);
  const rawRefresh = crypto.randomBytes(32).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    "INSERT INTO refresh_tokens (customer_id, token_hash, expires_at) VALUES (?, ?, ?)"
  ).run(customerId, refreshHash, refreshExpiry);

  res.cookie('refreshToken', rawRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',           // lax allows cross-site top-level navigation; strict blocks cross-site
    path: '/',                 // or restrict to /api/customers if all consumers are server-side
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return accessToken;
}
```

### Logout endpoint
```javascript
// [CITED: OWASP session management cheat sheet]
router.post('/logout', (req, res) => {
  const inbound = req.cookies?.refreshToken;
  if (inbound) {
    const hash = crypto.createHash('sha256').update(inbound).digest('hex');
    db.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(hash);
  }
  res.clearCookie('refreshToken', { path: '/' });
  res.json({ success: true });
});
```

### Email verification token issuance
```javascript
// [VERIFIED: Node.js crypto built-in; standard email verification pattern]
function createVerificationToken(customerId) {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
  db.prepare(
    "INSERT INTO email_verification_tokens (customer_id, token_hash, expires_at) VALUES (?, ?, ?)"
  ).run(customerId, hash, expiresAt);
  return raw; // sent to user, never stored raw
}
```

### Password reset verification
```javascript
// [CITED: logrocket.com/implementing-secure-password-reset-node-js]
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Token and new password (8+ chars) required' });
  }
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(
    "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')"
  ).get(hash);
  if (!row) return res.status(400).json({ error: 'Invalid or expired token' });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  db.transaction(() => {
    db.prepare("UPDATE customers SET password_hash = ? WHERE id = ?").run(passwordHash, row.customer_id);
    db.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").run(hash);
  })();
  res.json({ success: true });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 30-day JWT (stateless) | 15min access + 7d refresh (stateful refresh) | Phase 07 | Requires DB lookup on refresh, enables real logout |
| No email in active backend | Resend SDK (`utils/email.js`) | Phase 07 | New env var `RESEND_API_KEY` needed |
| No token cleanup | Recovery task in checkouts.js extended | Phase 07 | Prevents token table bloat |

**Deprecated/outdated:**
- `signCustomerToken()` in `routes/customers.js`: The existing 30-day JWT function should be replaced by `signAccessToken()` (15min). The function signature changes but the payload shape `{ role, id, phone }` is unchanged — existing `requireCustomer` middleware continues to work without modification.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v24.15.0 | — |
| npm | Package install | Yes | 11.6.1 | — |
| jsonwebtoken | JWT signing | Yes (installed) | 9.0.3 | — |
| bcryptjs | Password hash | Yes (installed) | 2.4.3 | — |
| resend (npm) | Email delivery | No (not installed) | — | Install: `npm install resend` |
| cookie-parser | Read httpOnly cookies | No (not installed) | — | Install: `npm install cookie-parser` |
| RESEND_API_KEY | Email sending in production | Unknown | — | Dev mode: log links to console |
| APP_URL | Verification/reset email links | Not in .env.example | — | Add to .env.example, default http://localhost:9000 |

**Missing dependencies with no fallback:**
- None — all missing dependencies have clear install paths.

**Missing dependencies with fallback:**
- `resend` package: not installed, install with `npm install resend`. Dev mode gracefully skips with console.log.
- `cookie-parser`: not installed, install with `npm install cookie-parser`. Without it, `req.cookies` is undefined in Express.
- `RESEND_API_KEY`: unknown at research time. Email sending in production requires a Resend account and verified domain. In development, email is skipped and links are logged. The project's Medusa code used `noreply@poshakh.in`, suggesting the domain may already be verified with Resend.

---

## Validation Architecture

The `workflow.nyquist_validation` key is absent from `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (package.json test:unit runs `echo 'Skipping'`) |
| Config file | None — Wave 0 gap |
| Quick run command | None established — Wave 0 gap |
| Full suite command | None established — Wave 0 gap |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 07-01 | POST /api/customers/refresh returns new accessToken + rotates cookie | integration | manual curl test | No — Wave 0 |
| 07-01 | Expired refresh token returns 401 | integration | manual curl test | No — Wave 0 |
| 07-02 | POST /api/customers/logout deletes DB row, clears cookie | integration | manual curl test | No — Wave 0 |
| 07-03 | Signup creates email_verification_tokens row | integration | manual DB inspect | No — Wave 0 |
| 07-03 | GET /api/customers/verify-email?token= marks email_verified=1 | integration | manual curl test | No — Wave 0 |
| 07-04 | POST /api/customers/forgot-password always returns 200 (anti-enumeration) | unit | manual curl test | No — Wave 0 |
| 07-04 | POST /api/customers/reset-password with valid token updates password_hash | integration | manual curl test | No — Wave 0 |
| 07-04 | Reset token is single-use (second use returns 400) | integration | manual curl test | No — Wave 0 |

Note: The project has no automated test infrastructure. Phase 12 (Test Suite) is planned to add 80%+ integration coverage. For Phase 07, manual curl/Postman verification is the realistic testing approach. Plans should include manual verification steps for each endpoint.

### Wave 0 Gaps

- [ ] No test framework installed — Phase 12 will address this
- [ ] No smoke test for token lifecycle — manual verification steps required in each plan

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | bcryptjs (12 rounds), anti-enumeration on forgot-password |
| V3 Session Management | Yes | Short-lived JWT (15min), refresh rotation, httpOnly cookie, logout endpoint |
| V4 Access Control | Yes | `requireCustomer` middleware unchanged — validates `role: 'customer'` claim |
| V5 Input Validation | Yes | zod already in package.json — validate token format, password length |
| V6 Cryptography | Yes | `crypto.randomBytes(32)`, SHA-256 hashing — never hand-roll |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Refresh token theft from DB | Information Disclosure | Store SHA-256 hash of token, not raw token |
| XSS stealing access token | Information Disclosure | Store access token in JS memory (not localStorage); httpOnly cookie for refresh token |
| CSRF on refresh endpoint | Tampering | `sameSite: 'lax'` or `'strict'` on cookie; verify Origin header |
| User enumeration via forgot-password | Information Disclosure | Always return `200` regardless of whether email exists |
| Replay attack on used reset token | Repudiation | DELETE token row immediately after successful password reset |
| Token accumulation / storage exhaustion | Denial of Service | Cleanup expired tokens in existing `runRecoveryTask` |
| Access token long lifetime (current: 30d) | Elevation of Privilege | Reduce to 15min — mitigates impact of stolen tokens |
| Missing cookie-parser — silent `req.cookies` undefined | Tampering | Install and mount `cookie-parser` before route handlers |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `poshakh.in` domain is already verified with Resend (inferred from Medusa code using `noreply@poshakh.in`) | Standard Stack | If domain not verified, email sending will fail in production — planner must add a "verify Resend domain" step |
| A2 | RESEND_API_KEY env var is either already available or can be created in Resend dashboard for free | Environment Availability | If Resend account does not exist, 30-60 min setup time; nodemailer + SMTP is the fallback |
| A3 | Frontend (Next.js) token refresh will be handled by client-side code calling POST /api/customers/refresh — the research scope is backend only | Architecture Patterns | If frontend refresh logic is in scope, additional Next.js middleware or interceptor work is required |
| A4 | The `sameSite: 'lax'` cookie setting is appropriate (frontend and backend on different ports = cross-origin in dev) | Code Examples | If `strict` is used in dev, cookie will not be sent in cross-origin fetch; planner should confirm final sameSite value |

---

## Open Questions (RESOLVED)

1. **Is `RESEND_API_KEY` already available?**
   - What we know: Medusa code used Resend with `noreply@poshakh.in`
   - What's unclear: Whether the Resend account was set up, whether the domain is verified, whether the API key is accessible
   - Recommendation: Planner should add a Wave 0 task to confirm Resend account status; if unavailable, fall back to nodemailer + any SMTP (Gmail, SendGrid) as a temporary measure
   - **RESOLVED:** Plan 03 installs `resend` package and implements a dev-mode guard (`NODE_ENV !== 'production'` → log link to console, skip API call). Missing `RESEND_API_KEY` does not break development or testing.

2. **Does logout also need to invalidate the access token?**
   - What we know: Access tokens are stateless — a valid 15min token cannot be invalidated without a blocklist
   - What's unclear: Whether the product requires immediate logout (stateless JWT means a 15min window of use after logout)
   - Recommendation: For this phase, accept the 15min window — it's standard practice. A blocklist (Redis or SQLite) can be added in Phase 12 if needed.
   - **RESOLVED:** 15-minute window accepted. Plan 02 threat model (T-07-02-02) documents this as a known, accepted tradeoff. Access token blocklist deferred to Phase 12.

3. **Should email verification be required before login is allowed?**
   - What we know: ROADMAP says "email verification flow on signup" but does not specify whether unverified users are blocked
   - What's unclear: Whether blocking unverified users is in scope for Phase 07 or deferred
   - Recommendation: Default to non-blocking (issue tokens immediately on signup, verification is advisory). If blocking is required, add `email_verified` check to login handler and note it clearly in Plan 07-03.
   - **RESOLVED:** Non-blocking chosen. Tokens issued immediately on signup; `email_verified` flag is advisory in Phase 07. Blocking verification can be added in a future phase if required.

4. **`APP_URL` env var for building email links**
   - What we know: Not in `.env.example`, not in `server.js` required list
   - What's unclear: What URL to use for the verification link on the email (backend vs. frontend URL)
   - Recommendation: Add `APP_URL` to `.env.example` defaulting to `http://localhost:3000` (frontend) since the reset password link should direct users to a frontend page, not a raw API endpoint.
   - **RESOLVED:** Plan 01 (Task 3) adds `APP_URL=http://localhost:3000` to `.env.example`. Verification links point to the frontend URL so the reset-password page can render a form.

---

## Sources

### Primary (HIGH confidence)
- jsonwebtoken 9.0.3 — verified via `npm view` against npm registry 2026-05-10
- Node.js `crypto` built-in — project already uses `crypto.randomBytes` in `generateOrderId`
- resend 6.12.3 — verified via `npm view` against npm registry 2026-05-10; official docs at resend.com/docs/send-with-nodejs
- Existing codebase (`db.js`, `routes/customers.js`, `routes/auth.js`, `middleware/requireCustomer.js`) — direct file reads

### Secondary (MEDIUM confidence)
- Resend email pattern: [resend.com/docs/send-with-nodejs](https://resend.com/docs/send-with-nodejs)
- JWT refresh token rotation pattern: [dev.to/rahuls24 Essential JWT Security Part 2](https://dev.to/rahuls24/essential-jwt-security-part-2-refresh-tokens-and-revocation-made-simple-12pf)
- Password reset secure implementation: [blog.logrocket.com/implementing-secure-password-reset-node-js](https://blog.logrocket.com/implementing-secure-password-reset-node-js/)
- Email verification flow: [dev.to/supertokens implementing email verification flow](https://dev.to/supertokens/implementing-the-right-email-verification-flow-2hcj)

### Tertiary (LOW confidence)
- Cookie `sameSite` behavior in cross-origin dev setup — inferred from browser specs; confirm with actual testing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all key libraries verified against npm registry
- Architecture: HIGH — direct reading of current codebase; patterns derived from verified sources
- Pitfalls: MEDIUM — sql.js transaction behavior and cookie cross-origin issues verified from codebase; RESEND_API_KEY availability is ASSUMED
- Email delivery setup: MEDIUM — Resend is the correct choice, API shape is verified; domain/account status is ASSUMED

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (30 days — stable libraries)
