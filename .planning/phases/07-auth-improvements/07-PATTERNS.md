# Phase 7: Auth Improvements - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 5 (3 modified, 1 new, 1 config)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/db.js` | model/config | CRUD | `backend/db.js` (self — extend existing pattern) | exact |
| `backend/routes/customers.js` | route/controller | request-response | `backend/routes/auth.js` + `backend/routes/customers.js` (self) | exact |
| `backend/utils/email.js` | utility | request-response | `backend/.medusa/server/src/lib/email.js` | exact |
| `backend/server.js` | config | request-response | `backend/server.js` (self — extend existing pattern) | exact |
| `backend/.env.example` | config | — | `backend/.env.example` (self — extend existing pattern) | exact |

---

## Pattern Assignments

### `backend/db.js` (model/config, CRUD)

**Analog:** Self — extend the existing `initDb()` function.

**Table declaration pattern** (`db.js` lines 114–272):
All tables are declared inside a single `_db.run(`` ` `` CREATE TABLE IF NOT EXISTS ... `` ` ``)` call. New token tables follow the same pattern — `INTEGER PRIMARY KEY AUTOINCREMENT`, `TEXT NOT NULL`, `DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))`, and `FOREIGN KEY ... ON DELETE CASCADE`.

```javascript
// Existing example to copy — customers table (lines 172–181):
CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT UNIQUE,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  last_login    TEXT
);
```

Append the three new tables **inside** the same `_db.run(`` ` ``...`` ` ``)` block (after `site_settings`, before the closing backtick).

**safeMigrate pattern** (`db.js` lines 275–295):
```javascript
// Existing safeMigrate call pattern to copy (lines 281–295):
const safeMigrate = (sql) => {
  try { _db.run(sql); } catch (e) {
    if (!String(e.message).includes('duplicate column')) console.error('[db] migration warning:', e.message);
  }
};

safeMigrate('ALTER TABLE products ADD COLUMN category_id INTEGER');
safeMigrate('ALTER TABLE products ADD COLUMN slug TEXT');
// ...
```

New safeMigrate entries to add after the existing block:
```javascript
safeMigrate('ALTER TABLE customers ADD COLUMN email_verified INTEGER DEFAULT 0');
```
(The three new token tables are created by the `CREATE TABLE IF NOT EXISTS` block above and need no `safeMigrate` entry.)

**transaction() helper** (`db.js` lines 319–333):
```javascript
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
```
Use `db.transaction(() => { ... })()` in `routes/customers.js` to wrap the customer INSERT + email verification token INSERT atomically.

---

### `backend/routes/customers.js` (route/controller, request-response)

**Analog:** Self (`backend/routes/customers.js`) + `backend/routes/auth.js`

**Imports pattern** (`customers.js` lines 7–14, `auth.js` lines 6–11):
```javascript
// customers.js — already present:
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db").db;
const requireCustomer = require("../middleware/requireCustomer");

// Add these two new imports:
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");
// cookie-parser is mounted globally in server.js; req.cookies is available without a per-route import
```

**Token signing pattern — replace `signCustomerToken`** (`customers.js` lines 32–38):
```javascript
// EXISTING (to be replaced):
function signCustomerToken(id, phone) {
  return jwt.sign(
    { role: "customer", id, phone: phone || null },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }   // <-- change to '15m'
  );
}

// NEW name, same payload shape (requireCustomer middleware unchanged):
function signAccessToken(id, phone) {
  return jwt.sign(
    { role: "customer", id, phone: phone || null },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}
```

**Core route handler pattern** (`customers.js` lines 41–87, `auth.js` lines 15–51):
Every handler wraps its body in `try { ... } catch (err) { console.error(...); res.status(500).json({ error: '...' }); }`. The error log prefix follows the pattern `"POST /api/customers/<name> error:"`.

```javascript
// auth.js pattern to copy for new endpoints (lines 15–51):
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    // ... business logic ...
    res.json({ token, email: ownerEmail });
  } catch (err) {
    logger.error(err, "POST /api/auth/login error");
    res.status(500).json({ error: "Login failed" });
  }
});
```

**Anti-enumeration pattern** (`customers.js` lines 103–106, `auth.js` lines 33–39):
```javascript
// customers.js login — constant-time, no user enumeration (lines 103–106):
if (!row || !(await bcrypt.compare(password, row.password_hash))) {
  return res.status(401).json({ error: "Invalid credentials" });
}
// Apply same pattern to forgot-password: always return 200 regardless of whether email exists.
```

**DB prepare/get/run pattern** (`customers.js` lines 53–77):
```javascript
// Lookup:
const existing = db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone.trim());

// Insert:
db.prepare(`
  INSERT INTO customers (id, first_name, ...) VALUES (?, ?, ...)
`).run(id, firstName, ...);

// Update:
db.prepare("UPDATE customers SET last_login = ? WHERE id = ?").run(now, row.id);
```

**requireCustomer guard** (`customers.js` line 120):
```javascript
router.get("/me", requireCustomer, (req, res) => { ... });
// Apply same requireCustomer to any new protected routes if needed.
```

**Cookie response pattern** (from RESEARCH.md Pattern 3 — no existing analog in codebase):
```javascript
res.cookie('refreshToken', rawRefresh, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

**clearCookie pattern** (from RESEARCH.md logout example):
```javascript
res.clearCookie('refreshToken', { path: '/' });
```

---

### `backend/utils/email.js` (utility, request-response) — NEW FILE

**Analog:** `backend/.medusa/server/src/lib/email.js` (compiled JS of archived Medusa email util)

**Structure pattern** (`sms.js` lines 1–55 — closest live util):
```javascript
// sms.js structure to mirror:
const axios = require('axios');
const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY;

async function sendSMS(phone, message) {
  if (!FAST2SMS_KEY) {
    console.log('⚠️ Fast2SMS key not set. Skipping SMS.');
    return;
  }
  try {
    // ...API call...
  } catch (err) {
    console.error('❌ SMS sending failed:', err.response?.data || err.message);
  }
}

module.exports = { sendSMS, ... };
```

Mirror this structure exactly: module-level client init, dev-mode guard, named async functions, `module.exports` at bottom.

**Resend client init pattern** (`archived email.js` lines 5–8):
```javascript
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Poshakh <noreply@poshakh.in>';
```

**Dev-mode guard pattern** (`archived email.js` lines 10–13):
```javascript
if (process.env.NODE_ENV !== 'production') {
  console.log(`[DEV] Email verification link for ${to}: ${link}`);
  return;
}
```

**Resend call + error pattern** (`archived email.js` lines 14–29):
```javascript
const { error } = await resend.emails.send({
  from: FROM,
  to,
  subject: 'Your Poshakh verification code',
  html: `<div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px">
    ...
  </div>`,
});
if (error) {
  // archived Medusa uses logger.error; active backend can use console.error to match sms.js style
  console.error('[email] Resend delivery failed:', error);
  throw new Error('Email delivery failed: ' + error.message);
}
```

**Module exports pattern** (`sms.js` line 55):
```javascript
module.exports = { sendVerificationEmail, sendPasswordResetEmail };
```

---

### `backend/server.js` (config, request-response)

**Analog:** Self — extend the existing file.

**Env validation pattern** (`server.js` lines 18–24):
```javascript
const required = ["OWNER_EMAIL", "OWNER_PASSWORD_HASH", "JWT_SECRET"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌  Missing required env vars: ${missing.join(", ")}`);
  console.error("    Copy backend/.env.example to backend/.env and fill in the values.");
  process.exit(1);
}
```
Add `"RESEND_API_KEY"` and `"APP_URL"` to the `required` array (or guard them: only required when `process.env.NODE_ENV === 'production'` — see RESEARCH.md Pitfall 4).

**cookie-parser middleware mount pattern** (`server.js` lines 78–85 — existing body-parser precedent):
```javascript
// Existing pattern: middleware mounted before routes, after security middleware
app.use((req, res, next) => {
  if (req.path === "/api/payments/webhook") return next();
  express.json({ limit: "10mb" })(req, res, next);
});
```
Add `cookie-parser` in the same location block (lines 78–95), after compression/helmet but before route mounts:
```javascript
const cookieParser = require('cookie-parser');
// ...
app.use(cookieParser());
```

**runRecoveryTask extension pattern** (`server.js` lines 151–154, `checkouts.js` lines 49–78):
```javascript
// server.js — existing recovery task invocation (lines 151–154):
setInterval(runRecoveryTask, 30 * 60 * 1000);
setTimeout(runRecoveryTask, 60 * 1000);

// checkouts.js — async function pattern to extend (lines 49–78):
async function runRecoveryTask() {
  try {
    // ... existing checkout recovery logic ...

    // ADD: token cleanup (append before closing brace)
    db.prepare("DELETE FROM refresh_tokens WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')").run();
    db.prepare("DELETE FROM email_verification_tokens WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')").run();
    db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')").run();
  } catch (err) {
    logger.error(err, 'Abandoned Cart Recovery Task Error');
  }
}
```

---

### `backend/.env.example` (config)

**Analog:** Self — extend existing file.

**Existing section pattern** (`backend/.env.example` lines 28–33):
```
# ── SMS (Fast2SMS) ──────────────────────────────────────────────────────────
# Key from https://www.fast2sms.com
FAST2SMS_API_KEY=
```

Add two new sections following this exact style (comment header + key):
```
# ── Email (Resend) ─────────────────────────────────────────────────────────
# Get key from: https://resend.com/api-keys
# Domain noreply@poshakh.in must be verified in Resend dashboard
RESEND_API_KEY=

# ── App URL (for email links) ───────────────────────────────────────────────
# In production: https://poshakh.in (frontend URL for reset-password page)
# In dev: http://localhost:3000
APP_URL=http://localhost:3000
```

---

## Shared Patterns

### Token generation and hashing
**Source:** `backend/routes/customers.js` line 19 + Node.js crypto built-in (already imported)
**Apply to:** All token creation in `routes/customers.js` (refresh, email verification, password reset)
```javascript
// generateCustomerId already shows the pattern (customers.js line 19):
function generateCustomerId() {
  return "cust_" + crypto.randomBytes(10).toString("hex");
}

// Extend the same crypto import for token ops:
function generateToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex
}
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

### Error response shape
**Source:** `backend/routes/customers.js` and `backend/routes/auth.js`
**Apply to:** All new endpoints in `routes/customers.js`

All errors return `{ error: "message string" }`. All successes return `{ success: true, ... }` or `{ data... }`.
```javascript
// 400:
return res.status(400).json({ error: "Descriptive message" });
// 401:
return res.status(401).json({ error: "Invalid or expired token" });
// 500 (in catch block):
res.status(500).json({ error: "Short action description failed" });
```

### Logger usage
**Source:** `backend/routes/checkouts.js` lines 73–74 and `backend/routes/auth.js` lines 49–50
**Apply to:** All new endpoints in `routes/customers.js`
```javascript
const logger = require('../utils/logger');
// ...
logger.error(err, 'POST /api/customers/refresh error');
```
Note: existing `customers.js` uses `console.error` (not `logger`). Either style is acceptable; prefer `logger` for new endpoints to match `auth.js` and `checkouts.js` convention.

### DB query in recovery task
**Source:** `backend/routes/checkouts.js` lines 52–57
**Apply to:** Token cleanup addition in `runRecoveryTask`
```javascript
// Existing datetime comparison pattern (lines 52–57):
AND updated_at < datetime('now', '-1 hour')
AND (last_notified_at IS NULL OR last_notified_at < datetime('now', '-24 hour'))

// Token expiry pattern (same datetime function):
WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')
```

### `requireCustomer` guard
**Source:** `backend/middleware/requireCustomer.js` (full file, 25 lines)
**Apply to:** Any new customer-authenticated endpoint (none required in Phase 07, but pattern is available)

The middleware reads `Authorization: Bearer <token>`, verifies with `jwt.verify`, checks `payload.role === 'customer'`, and attaches `req.customer = payload`. No changes needed — existing 30-day tokens and new 15-min tokens share the same payload shape `{ role, id, phone }`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/utils/email.js` (active server) | utility | request-response | No live email utility in active backend — archived Medusa `email.js` is a compiled TS build using `resend_1.Resend`, not a CJS `require('resend')` module. Use archived file as structural reference only; rewrite as plain CJS to match `sms.js` style. |

---

## Metadata

**Analog search scope:** `backend/routes/`, `backend/middleware/`, `backend/utils/`, `backend/db.js`, `backend/server.js`, `backend/.env.example`, `backend/.medusa/server/src/lib/email.js`
**Files scanned:** 9
**Pattern extraction date:** 2026-05-10
