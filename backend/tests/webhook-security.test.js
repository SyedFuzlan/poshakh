/**
 * TDD tests for webhook signature security hardening (06-02).
 *
 * These tests verify the DESIRED behaviour:
 *   1. Missing RAZORPAY_WEBHOOK_SECRET  → 500 + { error: "Webhook not configured" }
 *   2. Missing x-razorpay-signature    → 400 + { error: "Missing signature header" }
 *   3. Valid HMAC-SHA256 signature     → 200 + { status: "ok" }  (passthrough)
 *   4. Invalid / wrong signature       → 400 + { error: "Invalid webhook signature" }
 *   5. Truncated / malformed signature → 400, does NOT throw
 *   6. crypto.timingSafeEqual is used  → source-level check (no string === comparison)
 *
 * Run with: node backend/tests/webhook-security.test.js
 */

"use strict";

const assert = require("assert");
const crypto = require("crypto");
const path   = require("path");
const fs     = require("fs");

// ── Minimal Express-like mock ────────────────────────────────────────────────
// We test the handler function directly, bypassing the real Express router.

function makeReq({ secret, signature, body }) {
  return {
    headers: {
      ...(signature !== undefined ? { "x-razorpay-signature": signature } : {}),
    },
    body: Buffer.isBuffer(body) ? body : Buffer.from(body || ""),
    env_secret: secret,          // stored separately so we can inject it
  };
}

function makeRes() {
  const res = {
    _status: 200,
    _body:   null,
    status(code) { this._status = code; return this; },
    json(body)   { this._body   = body; return this; },
  };
  return res;
}

// ── Extract and normalise the webhook handler from payments.js ───────────────
// We monkey-patch process.env.RAZORPAY_WEBHOOK_SECRET around each call.

let webhookHandler;
try {
  // payments.js exports { router, ... }. The webhook route is registered via
  // router.post("/webhook", express.raw(...), handler).
  // We need to pull the handler from the router stack.

  // Temporarily supply fake env values so Razorpay import doesn't blow up.
  process.env.RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     || "fake_key";
  process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "fake_secret";

  const { router } = require(path.join(__dirname, "..", "routes", "payments.js"));

  // Find the /webhook route in the router's stack.
  const layer = router.stack.find(
    (l) => l.route && l.route.path === "/webhook"
  );

  if (!layer) throw new Error("Could not find /webhook route in payments router");

  // The route has middleware: [express.raw, handler].  We want the last one.
  const handlers = layer.route.stack;
  webhookHandler = handlers[handlers.length - 1].handle;

} catch (err) {
  console.error("SETUP FAILED:", err.message);
  process.exit(1);
}

// ── Helper: call the handler with injected secret ────────────────────────────
function callHandler(secret, signature, body) {
  const savedSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (secret === null) {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  } else {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  }

  const req = makeReq({ secret, signature, body });
  const res = makeRes();

  try {
    webhookHandler(req, res);
  } catch (e) {
    // Any uncaught throw is a test failure — record it.
    res._threw = e;
  } finally {
    if (savedSecret === undefined) {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
    } else {
      process.env.RAZORPAY_WEBHOOK_SECRET = savedSecret;
    }
  }

  return res;
}

// ── Helper: build a correct HMAC-SHA256 signature ────────────────────────────
function makeValidSig(secret, body) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

// ── Tests ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

console.log("\nwebhook-security.test.js\n");

// Test 1: Missing secret → 500
test("Missing RAZORPAY_WEBHOOK_SECRET returns 500 with Webhook not configured", () => {
  const res = callHandler(null, "any-sig", '{"event":"payment.captured"}');
  assert.strictEqual(
    res._status, 500,
    `Expected 500, got ${res._status} (body: ${JSON.stringify(res._body)})`
  );
  assert.ok(
    res._body && res._body.error && /not configured/i.test(res._body.error),
    `Expected error 'Webhook not configured', got: ${JSON.stringify(res._body)}`
  );
});

// Test 2: Missing signature header → 400
test("Missing x-razorpay-signature header returns 400 with Missing signature header", () => {
  const res = callHandler("testsecret", undefined, '{"event":"payment.captured"}');
  assert.strictEqual(
    res._status, 400,
    `Expected 400, got ${res._status}`
  );
  assert.ok(
    res._body && res._body.error && /missing signature/i.test(res._body.error),
    `Expected 'Missing signature header', got: ${JSON.stringify(res._body)}`
  );
});

// Test 3: Valid signature → 200
test("Valid HMAC-SHA256 signature returns 200 with status ok", () => {
  const secret = "testsecret";
  // Use a minimal body that parses as JSON but won't trigger DB calls.
  const body   = JSON.stringify({ event: "other.event" });
  const sig    = makeValidSig(secret, Buffer.from(body));
  const res    = callHandler(secret, sig, body);
  assert.strictEqual(
    res._status, 200,
    `Expected 200, got ${res._status} (body: ${JSON.stringify(res._body)})`
  );
  assert.deepStrictEqual(
    res._body, { status: "ok" },
    `Expected { status: 'ok' }, got: ${JSON.stringify(res._body)}`
  );
});

// Test 4: Wrong / invalid signature → 400
test("Invalid signature returns 400 with Invalid webhook signature", () => {
  const res = callHandler(
    "testsecret",
    "0".repeat(64),           // wrong but valid-length hex
    '{"event":"other.event"}'
  );
  assert.strictEqual(
    res._status, 400,
    `Expected 400, got ${res._status}`
  );
  assert.ok(
    res._body && res._body.error && /invalid webhook signature/i.test(res._body.error),
    `Expected 'Invalid webhook signature', got: ${JSON.stringify(res._body)}`
  );
});

// Test 5: Truncated / malformed signature → 400, no throw
test("Malformed (truncated) signature returns 400 and does not throw", () => {
  const res = callHandler(
    "testsecret",
    "abc123",                 // short / malformed hex — wrong length
    '{"event":"other.event"}'
  );
  assert.ok(
    !res._threw,
    `Expected no throw, but got: ${res._threw}`
  );
  assert.strictEqual(
    res._status, 400,
    `Expected 400, got ${res._status}`
  );
});

// Test 6: Source-level check — timingSafeEqual must be present, string === must not be
test("Source uses crypto.timingSafeEqual (not string === comparison)", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "routes", "payments.js"),
    "utf8"
  );
  assert.ok(
    src.includes("timingSafeEqual"),
    "payments.js must call crypto.timingSafeEqual"
  );
  // String comparison on HMAC values should be gone
  assert.ok(
    !src.includes("signature !== expectedSig") && !src.includes("expectedSig !== signature"),
    "payments.js must NOT compare HMAC with string !== operator"
  );
  // Both Buffer.from calls must use "hex" encoding
  const hexMatches = (src.match(/Buffer\.from\([^)]+,\s*["']hex["']\)/g) || []).length;
  assert.ok(
    hexMatches >= 2,
    `Expected at least 2 Buffer.from(..., "hex") calls, found ${hexMatches}`
  );
  // Length guard must precede the crypto.timingSafeEqual( call (not comment mentions)
  const lengthGuardIdx = src.indexOf("sigBuf.length !== expBuf.length");
  // Find the actual function call, not comment mentions — look for "crypto.timingSafeEqual("
  const tseCallIdx     = src.indexOf("crypto.timingSafeEqual(");
  assert.ok(
    lengthGuardIdx !== -1 && tseCallIdx !== -1 && lengthGuardIdx < tseCallIdx,
    `Length guard (${lengthGuardIdx}) must appear before crypto.timingSafeEqual( call (${tseCallIdx})`
  );
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
