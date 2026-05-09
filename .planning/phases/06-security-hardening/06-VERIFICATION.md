---
phase: 06-security-hardening
verified: 2026-05-09T09:14:05Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Login with correct credentials returns 200 and JWT token (full HTTP round-trip)"
    expected: "POST /api/auth/login with matching email + bcrypt-correct password returns 200 + { token, email }"
    why_human: "Requires a running server with OWNER_PASSWORD_HASH set in .env; bcrypt.compare async result cannot be verified without executing against a real env"
  - test: "21st POST to /api/checkouts from same IP returns 429"
    expected: "HTTP 429 with body { error: 'Too many requests, please try again later.' }"
    why_human: "Rate limiter behaviour requires live server with MemoryStore; cannot be triggered by static code inspection"
---

# Phase 06: Security Hardening Verification Report

**Phase Goal:** Harden the four highest-risk security vulnerabilities identified before production deployment: plaintext password storage, timing-unsafe HMAC webhook verification, missing checkout rate limiting, and TOCTOU race on payment deduplication.
**Verified:** 2026-05-09T09:14:05Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner login handler uses async/await — event loop is never blocked | VERIFIED | `backend/routes/auth.js` line 15: `router.post("/login", async (req, res) =>` and line 34: `await bcrypt.compare(password, ownerHash)` |
| 2 | Owner login with wrong password returns 401 (never 200) | VERIFIED | Lines 36-38: both `emailOk` AND `passOk` evaluated before branch; returns `res.status(401)` on any mismatch |
| 3 | OWNER_PASSWORD_HASH (bcrypt format) is required at startup; missing it exits the process | VERIFIED | `backend/server.js` line 18: `const required = ["OWNER_EMAIL", "OWNER_PASSWORD_HASH", "JWT_SECRET"]`; line 22: `process.exit(1)` on missing |
| 4 | OWNER_PASSWORD (plaintext) is removed from the required env var list | VERIFIED | `grep '"OWNER_PASSWORD"' backend/server.js` returns 0 matches; `OWNER_PASSWORD_HASH` occupies the slot |
| 5 | No compareSync call in auth.js | VERIFIED | `grep "compareSync" backend/routes/auth.js` returns 0 matches; only `await bcrypt.compare` is used |
| 6 | Webhook with valid HMAC signature is accepted (200 ok) | VERIFIED | Webhook handler at lines 325-383; valid signature passes length + `crypto.timingSafeEqual` check and returns `res.json({ status: "ok" })` |
| 7 | Webhook with invalid or malformed signature is rejected (400) | VERIFIED | Line 354-355: `if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf))` returns `res.status(400)` |
| 8 | Webhook when RAZORPAY_WEBHOOK_SECRET is missing returns 500 (not 200 ignored) | VERIFIED | Lines 332-335: `if (!webhookSecret) { logger.error(...); return res.status(500).json({ error: "Webhook not configured" }) }` |
| 9 | Webhook with no x-razorpay-signature header returns 400 | VERIFIED | Lines 337-340: `if (!signature) { return res.status(400).json({ error: "Missing signature header" }) }` |
| 10 | HMAC comparison uses crypto.timingSafeEqual — no string === comparison | VERIFIED | Line 354: `!crypto.timingSafeEqual(sigBuf, expBuf)`; `grep "signature !== expectedSig"` returns 0 matches |
| 11 | Buffer length is checked before calling timingSafeEqual — no ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH throw | VERIFIED | Line 354: `sigBuf.length !== expBuf.length` appears before `crypto.timingSafeEqual(` call (char index 11049 vs 11108 in source) |
| 12 | POST /api/checkouts requests are rate-limited (20 per 15 minutes per IP) | VERIFIED | `backend/server.js` lines 51-57: `checkoutLimiter` defined with `windowMs: 15 * 60 * 1000`, `max: 20`; line 108: `app.use("/api/checkouts", checkoutLimiter, checkoutRouter)` |
| 13 | The limiter returns `{ error: 'Too many requests, please try again later.' }` when exceeded | VERIFIED | Line 56: `message: { error: "Too many requests, please try again later." }` |
| 14 | POST /api/payments/webhook is NOT rate-limited by checkoutLimiter | VERIFIED | Line 104: `app.use("/api/payments", apiLimiter, require("./routes/payments").router)` — checkoutLimiter only on `/api/checkouts` |
| 15 | A second INSERT with the same razorpay_payment_id is rejected at the database level | VERIFIED | `backend/db.js` lines 287-290: `safeMigrate('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ON orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL')` |
| 16 | A concurrent duplicate payment returns 409 (not 500) from the verify endpoint | VERIFIED | `backend/routes/payments.js` lines 279-282: `if (err && String(err.message).includes("UNIQUE constraint failed: orders.razorpay_payment_id")) { return res.status(409).json(...)` |

**Score:** 16/16 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/routes/auth.js` | Async bcrypt login handler | VERIFIED | 60-line file; `async (req, res)` on line 15; `await bcrypt.compare` on line 34; `OWNER_PASSWORD_HASH` on line 24; no `OWNER_PASSWORD` or `compareSync` |
| `backend/server.js` | Updated env var validation + checkoutLimiter | VERIFIED | Line 18: `OWNER_PASSWORD_HASH` in required[]; lines 51-57: `checkoutLimiter` definition; line 108: `checkoutLimiter` applied to `/api/checkouts` |
| `backend/.env.example` | Hash generation documentation | VERIFIED | Line 4: `require('bcryptjs').hash(...)` command documented; line 6: `OWNER_PASSWORD_HASH` field present; line 7: `OWNER_PASSWORD=` removed with comment |
| `backend/routes/payments.js` | Timing-safe webhook handler + 409 on UNIQUE constraint | VERIFIED | Lines 325-383: full webhook handler with `crypto.timingSafeEqual`, length guard, hex encoding, 500 on missing secret, 400 on missing header; lines 279-282: 409 on UNIQUE constraint |
| `backend/db.js` | Partial UNIQUE INDEX on orders(razorpay_payment_id) | VERIFIED | Lines 287-290: `safeMigrate('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ON orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL')` |
| `backend/tests/webhook-security.test.js` | 6-test TDD suite for webhook hardening | VERIFIED | File exists; 6 behavioral tests covering all acceptance criteria; source-level check uses `crypto.timingSafeEqual(` call-form not comment-form |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/routes/auth.js` | `process.env.OWNER_PASSWORD_HASH` | `await bcrypt.compare(password, ownerHash)` | WIRED | Line 24 reads `OWNER_PASSWORD_HASH`; line 34 passes it to `bcrypt.compare` |
| `backend/server.js` | `OWNER_PASSWORD_HASH` env var | `required[]` array startup check | WIRED | Line 18 includes `"OWNER_PASSWORD_HASH"` in required array; line 22 calls `process.exit(1)` |
| `backend/routes/payments.js` webhook | `crypto.timingSafeEqual` | `sigBuf + expBuf` with `"hex"` encoding | WIRED | Lines 349-354: both `Buffer.from` calls use `"hex"`; `timingSafeEqual(sigBuf, expBuf)` called with length guard |
| `backend/routes/payments.js` webhook | `RAZORPAY_WEBHOOK_SECRET` | 500 rejection when missing | WIRED | Lines 332-335: `if (!webhookSecret)` returns `res.status(500)` |
| `backend/server.js` `/api/checkouts` | `checkoutLimiter` | `app.use('/api/checkouts', checkoutLimiter, checkoutRouter)` | WIRED | Line 108 matches exactly |
| `backend/db.js` safeMigrate | `orders` table | `CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE razorpay_payment_id IS NOT NULL` | WIRED | Lines 287-290 call `safeMigrate` with partial index DDL |
| `backend/routes/payments.js` verify catch | 409 response | `err.message.includes("UNIQUE constraint failed: orders.razorpay_payment_id")` | WIRED | Line 280 matches exact SQLite constraint error string; line 281 returns `res.status(409)` |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies security-critical control flow (auth handlers, validation middleware, DB migrations) rather than data-rendering components. There are no display components that render dynamic state introduced in this phase.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| auth.js loads without errors | `node --check backend/routes/auth.js` | Exit 0 | PASS |
| payments.js loads without errors | `node --check backend/routes/payments.js` | Exit 0 | PASS |
| db.js loads without errors | `node --check backend/db.js` | Exit 0 | PASS |
| server.js loads without errors | `node --check backend/server.js` | Exit 0 | PASS |
| `await bcrypt.compare` present in auth.js | `grep "await bcrypt.compare" auth.js` | Line 34 match | PASS |
| `compareSync` absent in auth.js | `grep "compareSync" auth.js` | 0 matches | PASS |
| `OWNER_PASSWORD` (plaintext) absent from server.js required[] | `grep '"OWNER_PASSWORD"' server.js` | 0 matches | PASS |
| `timingSafeEqual` in payments.js | `grep "timingSafeEqual" payments.js` | Line 354 match | PASS |
| String comparison on HMAC absent | `grep "signature !== expectedSig" payments.js` | 0 matches | PASS |
| `200 ignored` silent pass-through removed | `grep "200.*ignored" payments.js` | 0 matches | PASS |
| `console.warn` removed from webhook handler | `grep "console.warn" payments.js` | 0 matches | PASS |
| `checkoutLimiter` defined and wired | `grep "checkoutLimiter" server.js` | Lines 51, 108 | PASS |
| `max: 20` in checkoutLimiter | `grep "max: 20" server.js` | Line 53 match | PASS |
| UNIQUE INDEX on orders(razorpay_payment_id) | `grep "idx_orders_razorpay_payment_id" db.js` | Lines 288-289 | PASS |
| Partial index WHERE clause present | `grep "IS NOT NULL" db.js` | Line 289 match | PASS |
| 409 on UNIQUE constraint in verify handler | `grep "status(409)" payments.js` | Line 281 match | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-01-bcrypt-owner-password | 06-PLAN-01 | Replace plaintext password with bcrypt hash in owner auth | SATISFIED | `auth.js` uses `await bcrypt.compare(password, ownerHash)`; `server.js` requires `OWNER_PASSWORD_HASH`; `.env.example` documents hash generation |
| SEC-02-webhook-timing-safe | 06-PLAN-02 | Replace timing-unsafe HMAC comparison with `crypto.timingSafeEqual` | SATISFIED | `payments.js` webhook handler uses `timingSafeEqual` with `Buffer.from(...,"hex")` and length guard; string comparison removed; missing secret returns 500 |
| SEC-03-checkout-rate-limit | 06-PLAN-03 | Add rate limiter to `/api/checkouts` (20 req/15 min) | SATISFIED | `checkoutLimiter` defined in `server.js` and applied to `/api/checkouts` mount; `/api/payments` unaffected |
| SEC-04-payment-idempotency | 06-PLAN-04 | Partial UNIQUE INDEX on `orders(razorpay_payment_id)` + 409 on constraint violation | SATISFIED | `db.js` safeMigrate with `IF NOT EXISTS` partial index; `payments.js` verify handler catch returns 409 on exact constraint error string |

No REQUIREMENTS.md file exists in the project — requirements are defined exclusively in PLAN frontmatter. All four requirement IDs declared across the four plans have been verified with direct codebase evidence.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/routes/payments.js` | 317 | `console.log` for UPI order confirmation | Info | Not introduced by this phase; pre-existing; outside scope of Phase 06 hardening |

No anti-patterns were introduced by Phase 06 changes. The one `console.log` noted above (`📱 UPI order saved:`) is a pre-existing pattern in the upi-confirm handler (outside Phase 06 scope). All Phase 06-modified code uses `logger.error` correctly.

---

### Human Verification Required

#### 1. End-to-End Owner Login (bcrypt round-trip)

**Test:** Start the server with a real `OWNER_PASSWORD_HASH` value generated via `node -e "require('bcryptjs').hash('TestPass123', 12).then(h => console.log(h))"`, set `OWNER_PASSWORD_HASH=<output>` in `.env`, then POST to `/api/auth/login` with `{ email, password: "TestPass123" }`.

**Expected:** HTTP 200 with `{ token: "<jwt>", email: "<owner_email>" }`

**Why human:** Requires bcrypt to execute at cost-12 against a real hash value. The handler is async and the bcrypt.compare result cannot be verified by static code inspection alone. The server must be running with a live `.env`.

#### 2. Checkout Rate Limit Enforcement

**Test:** Send 21 consecutive POST requests to `/api/checkouts` from the same IP (e.g., `for i in $(seq 1 21); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:9000/api/checkouts -H "Content-Type: application/json" -d '{}'; done`).

**Expected:** Requests 1–20 return any non-429 code; request 21 returns HTTP 429 with `{ "error": "Too many requests, please try again later." }`.

**Why human:** Rate limiter uses in-process MemoryStore that is not inspectable statically. The 429 trigger requires actual HTTP round-trips against a running server instance.

---

### Gaps Summary

No gaps found. All 16 must-have truths verified, all artifacts substantive and wired, all four requirement IDs satisfied with direct codebase evidence. Two items require live-server human verification (bcrypt round-trip login and rate limiter 429 trigger) — these cannot be confirmed through static code analysis alone, but the code implementing them is correct and complete.

---

_Verified: 2026-05-09T09:14:05Z_
_Verifier: Claude (gsd-verifier)_
