# Phase 06: Security Hardening - Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 4 modified files
**Analogs found:** 4 / 4

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `backend/routes/auth.js` | controller | request-response | `backend/routes/customers.js` | exact |
| `backend/routes/payments.js` | controller | event-driven + request-response | `backend/routes/payments.js` (self — modify existing pattern) | self |
| `backend/server.js` | config/middleware | request-response | `backend/server.js` (self — add alongside existing `authLimiter`) | self |
| `backend/db.js` | config/migration | CRUD | `backend/db.js` (self — add to existing `safeMigrate` block) | self |

---

## Pattern Assignments

### `backend/routes/auth.js` (Plan 06-01 — bcrypt owner password)

**Analog:** `backend/routes/customers.js`

**Imports pattern** — customers.js lines 1-16 (copy bcrypt import; auth.js already has express, jwt, requireOwner):
```javascript
const bcrypt = require("bcryptjs");
// customers.js line 16 — project standard salt rounds:
const BCRYPT_ROUNDS = 12;
```
Note: `BCRYPT_ROUNDS` is not needed in auth.js (no hashing, only comparing), but the import line is the same.

**Current handler (auth.js lines 12-38) — full state before modification:**
```javascript
// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerPassword = process.env.OWNER_PASSWORD;

  if (
    email.toLowerCase().trim() !== ownerEmail.toLowerCase().trim() ||
    password !== ownerPassword
  ) {
    // Same error message regardless of which field is wrong (prevents enumeration)
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

**bcrypt.compare pattern** — customers.js line 104 (the exact pattern to copy):
```javascript
// Constant-time path — no user enumeration
if (!row || !(await bcrypt.compare(password, row.password_hash))) {
  return res.status(401).json({ error: "Invalid credentials" });
}
```
In auth.js, adapt to compare against `process.env.OWNER_PASSWORD_HASH` instead of `row.password_hash`.

**Async handler pattern** — customers.js line 90 (handler signature to copy):
```javascript
router.post("/login", async (req, res) => {
  try {
    // ... handler body
  } catch (err) {
    console.error("POST /api/customers/login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});
```
The `async (req, res) =>` signature is required. The `try/catch` wrapping the entire handler body is the project's error handling convention.

**Env validation pattern** — server.js lines 18-24 (startup guard for required env vars):
```javascript
const required = ["OWNER_EMAIL", "OWNER_PASSWORD", "JWT_SECRET"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌  Missing required env vars: ${missing.join(", ")}`);
  console.error("    Copy backend/.env.example to backend/.env and fill in the values.");
  process.exit(1);
}
```
Plan 06-01 must update this array: replace `"OWNER_PASSWORD"` with `"OWNER_PASSWORD_HASH"`.

---

### `backend/routes/payments.js` (Plan 06-02 — timingSafeEqual + reject on missing secret)

**Analog:** self-modification — the existing webhook handler at lines 321-368.

**Full current webhook handler (lines 321-368) — state before modification:**
```javascript
// ── POST /api/payments/webhook ──────────────────
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.warn("RAZORPAY_WEBHOOK_SECRET not set — skipping webhook verification");
        return res.status(200).json({ status: "ignored" });   // ← SILENT FAILURE (replace)
      }

      const signature = req.headers["x-razorpay-signature"];
      const expectedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(req.body)
        .digest("hex");

      if (signature !== expectedSig) {                         // ← NOT timing-safe (replace)
        return res.status(400).json({ error: "Invalid webhook signature" });
      }

      const event = JSON.parse(req.body.toString());

      if (event.event === "payment.captured") {
        const payment = event.payload?.payment?.entity;
        if (payment) {
          const existing = db
            .prepare("SELECT id FROM orders WHERE razorpay_payment_id = ?")
            .get(payment.id);

          if (existing) {
            db.prepare(
              "UPDATE orders SET status = 'paid' WHERE id = ? AND status = 'pending_verification'"
            ).run(existing.id);
          } else {
            console.error(`⚠️  Orphaned payment ${payment.id} — not in orders DB.`);
          }
        }
      }

      res.json({ status: "ok" });
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);
```

**`crypto` import** — already present at payments.js line 9:
```javascript
const crypto = require("crypto");
```
No new import needed.

**`logger` import** — already present at payments.js line 48:
```javascript
const logger = require("../utils/logger");
```
Use `logger.error(...)` for the missing-secret error (replacing `console.warn`). All other routes in the project use `logger` from `../utils/logger`.

**timingSafeEqual pattern to apply** — replaces the `signature !== expectedSig` block:
```javascript
// After computing expectedSig with createHmac:
const sigBuf = Buffer.from(signature,    'hex');  // must specify 'hex'
const expBuf = Buffer.from(expectedSig, 'hex');

if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
  return res.status(400).json({ error: "Invalid webhook signature" });
}
```
The length guard (`sigBuf.length !== expBuf.length`) must precede `timingSafeEqual` — the function throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` if lengths differ.

**Missing-secret rejection pattern to apply** — replaces the `console.warn + 200 ignored` block:
```javascript
if (!webhookSecret) {
  logger.error('RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook');
  return res.status(500).json({ error: 'Webhook not configured' });
}
```

**Missing-signature guard to add** — insert between secret check and HMAC computation:
```javascript
if (!signature) {
  return res.status(400).json({ error: "Missing signature header" });
}
```

---

### `backend/server.js` (Plan 06-03 — add checkoutLimiter)

**Analog:** self-modification — copy the existing `authLimiter` definition pattern.

**Existing rate limiter definitions (server.js lines 38-49) — copy the structure:**
```javascript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later." }
});
```
`rateLimit` is already imported at line 11: `const rateLimit = require("express-rate-limit");`

**New `checkoutLimiter` definition to add** — place after `authLimiter` definition, before the CORS middleware:
```javascript
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
```

**Current checkouts mount (server.js line 99-100) — state before modification:**
```javascript
const { router: checkoutRouter, runRecoveryTask } = require("./routes/checkouts");
app.use("/api/checkouts", checkoutRouter);
```

**Target mount (replace line 100):**
```javascript
app.use("/api/checkouts", checkoutLimiter, checkoutRouter);
```
Pattern mirrors lines 92-96:
```javascript
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/customers", authLimiter, require("./routes/customers"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", apiLimiter, require("./routes/orders"));
app.use("/api/payments", apiLimiter, require("./routes/payments").router);
```

---

### `backend/db.js` (Plan 06-04 — partial UNIQUE INDEX on orders)

**Analog:** self-modification — add to the existing `safeMigrate` block.

**`safeMigrate` helper definition (db.js lines 274-278):**
```javascript
const safeMigrate = (sql) => {
  try { _db.run(sql); } catch (e) {
    if (!String(e.message).includes('duplicate column')) console.error('[db] migration warning:', e.message);
  }
};
```
The helper catches errors silently for duplicate-column cases. For `CREATE UNIQUE INDEX IF NOT EXISTS`, the `IF NOT EXISTS` clause prevents any error on re-run — no change to the helper needed.

**Existing `safeMigrate` calls (db.js lines 280-286) — append after line 286:**
```javascript
safeMigrate('ALTER TABLE products ADD COLUMN category_id INTEGER');
safeMigrate('ALTER TABLE products ADD COLUMN slug TEXT');
safeMigrate('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug)');
safeMigrate('ALTER TABLE products ADD COLUMN meta_title TEXT');
safeMigrate('ALTER TABLE products ADD COLUMN meta_description TEXT');
safeMigrate('ALTER TABLE order_items ADD COLUMN price_paise INTEGER');
safeMigrate('ALTER TABLE checkouts ADD COLUMN promo_code TEXT');
// ← add new safeMigrate call here, after line 286
```

**Analog pattern** — `idx_products_slug` at line 282 (closest match — same `CREATE UNIQUE INDEX IF NOT EXISTS` form on an existing table):
```javascript
safeMigrate('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug)');
```

**New call to add:**
```javascript
safeMigrate(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ' +
  'ON orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL'
);
```
The `WHERE razorpay_payment_id IS NOT NULL` partial index clause allows multiple rows with `NULL` payment IDs (UPI/COD orders) while enforcing uniqueness only for non-NULL Razorpay payment IDs.

---

## Shared Patterns

### Logger usage
**Source:** `backend/routes/payments.js` line 48; `backend/routes/customers.js` (does not yet use logger — uses `console.error`)
**Apply to:** Plan 06-02 webhook handler modifications
```javascript
const logger = require("../utils/logger");
// Usage:
logger.error('RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook');
```
Note: `payments.js` already imports `logger` at line 48. Plan 06-02 replaces the `console.warn` in the webhook handler with `logger.error`. The remaining `console.error` calls in `payments.js` (lines 279, 316, 357, 364) are outside Phase 06 scope.

### Error response shape
**Source:** Throughout the codebase — consistent shape:
```javascript
res.status(4xx).json({ error: "Human-readable message" });
res.status(5xx).json({ error: "Human-readable message" });
```
No `success: false` wrapper on error responses in auth/webhook handlers (the `success: false` pattern is limited to payment verify/upi-confirm responses and is not replicated in 06-01 or 06-02).

### Env validation at startup
**Source:** `backend/server.js` lines 18-24
**Apply to:** Plan 06-01 (update `required` array in server.js)
```javascript
const required = ["OWNER_EMAIL", "OWNER_PASSWORD", "JWT_SECRET"];
```
Must become:
```javascript
const required = ["OWNER_EMAIL", "OWNER_PASSWORD_HASH", "JWT_SECRET"];
```

---

## No Analog Found

All four files have clear analogs or are self-modifications. No files in this phase are net-new without codebase precedent.

---

## Metadata

**Analog search scope:** `backend/routes/`, `backend/server.js`, `backend/db.js`
**Files read:** `auth.js`, `customers.js`, `payments.js` (lines 1-30, 250-370), `server.js`, `db.js`
**Pattern extraction date:** 2026-05-09
