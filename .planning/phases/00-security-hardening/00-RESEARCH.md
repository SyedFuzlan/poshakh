# Phase 0: Security Hardening — Research

**Researched:** 2026-04-22
**Domain:** Auth security — Redis rate-limiting, env-var guards, HMAC session expiry, Zod validation
**Confidence:** HIGH (all findings verified directly from the codebase and installed node_modules)

---

## Summary

Phase 0 patches four confirmed critical vulnerabilities in the existing auth system before any new
code ships. Every vulnerability was confirmed by reading the actual source files — none are
speculative. The fixes are narrow and surgical: they modify only the files that already own the
relevant behaviour, and they use libraries already installed in the project (ioredis 5.10.1 is
already the Redis client; zod 3.25.76 is already bundled inside `@medusajs/framework`).

The existing verify-otp backend route has zero brute-force protection: wrong OTPs return 401
indefinitely with no lockout. The DEV bypass lives entirely in the two Next.js BFF route handlers
and is absent from the Medusa backend. The session cookie uses `createHmac` (Node.js `crypto`)
with no `exp` field in the payload — tokens are permanent. Both backend auth routes parse `req.body`
with manual checks that crash or return 500 on malformed input.

**Primary recommendation:** Make the four fixes atomically, each in its own file, with no
cross-cutting changes. All tooling (ioredis, zod, Medusa error handler) is already installed.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | OTP verify endpoint locks out after 5 failed attempts (Redis attempt counter + TTL-based lockout) | `otp-store.ts` already owns Redis keys. Add `incrby` attempt counter with the same TTL as the OTP key. `verify-otp/route.ts` checks the counter before comparing the OTP. |
| SEC-02 | `DEV_TEST_PHONE` / `DEV_TEST_OTP` bypass removed from BFF routes; startup assertion throws in production | Bypass is confirmed in exactly two files: `frontend/src/app/api/otp/send/route.ts` and `frontend/src/app/api/otp/verify/route.ts`. `frontend/src/instrumentation.ts` does not yet exist — it must be created with a `register()` function that throws. |
| SEC-03 | Session HMAC cookie payload includes `exp`; `verifySignedCookie` validates expiry server-side | `frontend/src/lib/session.ts` is the only session file. It uses Node.js `crypto.createHmac` (not Edge-compatible, but route handlers default to Node runtime — correct for Phase 0). No `exp` field currently exists in the payload or in any verification logic. |
| SEC-04 | All existing backend auth route bodies validated with Zod; return 400 with structured error | Both `backend/src/api/store/auth/send-otp/route.ts` and `backend/src/api/store/auth/verify-otp/route.ts` use manual `if (!identifier)` guards only. Zod 3.25.76 is available at `backend/node_modules/zod`. `validateAndTransformBody` is exported from `@medusajs/framework` and is the idiomatic approach; alternatively, inline `zodValidator` directly in route handlers for zero-middleware overhead. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OTP brute-force lockout (SEC-01) | API / Backend (Medusa) | Redis (storage) | Lockout must be enforced server-side on the authoritative backend, not the BFF which can be bypassed |
| DEV bypass removal (SEC-02) | Frontend Server (Next.js BFF) | Frontend Server (instrumentation) | Bypass code lives in BFF route handlers; startup guard belongs in Next.js `instrumentation.ts` |
| Session expiry (SEC-03) | Frontend Server (Next.js BFF) | — | Session is created and verified inside Next.js route handlers (`session.ts`, `/api/auth/me`) |
| Zod request validation (SEC-04) | API / Backend (Medusa) | — | Body validation runs in the Medusa route handler before business logic; schema errors become 400 via Medusa's built-in error handler |

---

## Files That Exist and Must Be Modified

### SEC-01 — OTP Brute-Force Lockout

**`backend/src/lib/otp-store.ts`** [VERIFIED: read file]
- Currently exports: `setOtp`, `getOtp`, `deleteOtp`, `isRateLimited`
- `isRateLimited` only guards the *send* endpoint (rate-limits OTP requests, not verify attempts)
- No attempt counter exists for verify failures
- **Required additions:**
  - `incrementAttempts(identifier: string): Promise<number>` — uses Redis `INCR` on key `otp_attempts:{identifier}`, sets TTL to OTP_TTL_SECONDS on first increment
  - `getAttempts(identifier: string): Promise<number>` — reads current attempt count
  - Export constant `MAX_OTP_ATTEMPTS = 5`

**`backend/src/api/store/auth/verify-otp/route.ts`** [VERIFIED: read file]
- Currently: checks OTP match, returns 401 on failure, deletes key on success
- No attempt counter, no lockout
- **Required changes:**
  1. Before OTP comparison: call `getAttempts(identifier)`; if `>= MAX_OTP_ATTEMPTS` return 429
  2. On OTP mismatch: call `incrementAttempts(identifier)`; check if new count `>= MAX_OTP_ATTEMPTS`; return 401 with remaining attempts in response body
  3. On OTP match: call `deleteOtp(identifier)` (already done) AND delete attempt key

### SEC-02 — DEV Bypass Removal

**`frontend/src/app/api/otp/send/route.ts`** [VERIFIED: read file]
- Lines 12–14: `if (process.env.DEV_TEST_PHONE && normalized === process.env.DEV_TEST_PHONE) { return NextResponse.json({ success: true }); }`
- **Required change:** Delete lines 12–14 entirely

**`frontend/src/app/api/otp/verify/route.ts`** [VERIFIED: read file]
- Lines 21–35: full DEV bypass block — short-circuits verification, creates a fake customer, sets a session cookie
- **Required change:** Delete lines 21–35 entirely

**`frontend/src/instrumentation.ts`** [VERIFIED: does NOT exist]
- Must be created at `frontend/src/instrumentation.ts` (Next.js App Router with `src/` — place in `src/`)
- Must export `register()` function — called once on server startup before any requests are handled [VERIFIED: Next.js 16 docs in `node_modules/next/dist/docs/`]
- **Required content:**
```typescript
export function register() {
  if (process.env.NODE_ENV === "production") {
    const forbidden = ["DEV_TEST_PHONE", "DEV_TEST_OTP"];
    for (const key of forbidden) {
      if (process.env[key]) {
        throw new Error(
          `[SECURITY] ${key} must not be set in production. Remove it from your environment and restart.`
        );
      }
    }
  }
}
```

### SEC-03 — Session Expiry

**`frontend/src/lib/session.ts`** [VERIFIED: read file]
- Uses `createHmac` from Node.js `crypto` module — works because Next.js route handlers run in Node runtime by default (no `export const runtime = "edge"` in any BFF file) [VERIFIED: grep of all API files]
- `createSignedCookie(data: object)`: serialises data to base64url, appends HMAC signature — no `exp` field in data
- `verifySignedCookie(value: string)`: verifies signature, returns parsed payload — no expiry check
- **Required changes to `createSignedCookie`:** Inject `exp: Date.now() + 7 * 24 * 60 * 60 * 1000` and `iat: Date.now()` into the payload before serialisation (caller's `data` object is spread in; `exp` and `iat` are added by the function itself, not the caller)
- **Required changes to `verifySignedCookie`:** After signature verification, parse payload, check `typeof parsed.exp === "number" && Date.now() > parsed.exp`; if expired return `null`

**`frontend/src/app/api/otp/verify/route.ts`** — sets the cookie with `maxAge: 60 * 60 * 24 * 7`; this is the browser hint and is correct; the authoritative expiry check is now inside `verifySignedCookie` [VERIFIED: read file]

**`frontend/src/app/api/auth/me/route.ts`** — calls `verifySignedCookie` and already handles null return by deleting the cookie; no change needed [VERIFIED: read file]

### SEC-04 — Zod Validation on Existing Backend Routes

**Zod availability** [VERIFIED: `node_modules/zod` version 3.25.76 present; `node -e` confirmed `ZodString` is available]:
```typescript
import { z } from "zod";
```
Import path: `"zod"` (standard — not the Medusa internal `@medusajs/deps/zod`)

**Medusa error handler mapping** [VERIFIED: `error-handler.js` source read]:
- `MedusaError.Types.INVALID_DATA` → HTTP 400
- Response shape: `{ code, type: "invalid_data", message: "Invalid request: ..." }`
- The `zodValidator` helper in `@medusajs/framework` automatically throws `MedusaError(INVALID_DATA, ...)` on schema failure, which the Medusa error handler serialises to 400

**`validateAndTransformBody`** is available from `@medusajs/framework` [VERIFIED: `node -e`]:
- Used as Express middleware: `validateAndTransformBody(MyZodSchema)`
- Requires a `src/api/middlewares.ts` file with `defineMiddlewares` config
- Auto-loaded because `MiddlewareFileLoader.scanDir` checks for `middlewares.ts` in the same dir the routes loader scans [VERIFIED: `router.js` and `middleware-file-loader.js` source]

**Chosen approach for SEC-04:** Inline `zodValidator` call directly inside each route handler's `POST` function. This is simpler than creating a `middlewares.ts` and has no risk of path-matching mistakes with Medusa's route scanner.

**`backend/src/api/store/auth/send-otp/route.ts`** [VERIFIED: read file]
- Currently body cast: `const { identifier, firstName, lastName } = req.body as {...}`
- Manual guard: `if (!identifier) return res.status(400).json(...)`
- **Required change:** Replace cast + manual guard with:
```typescript
import { z } from "zod";
import { zodValidator } from "@medusajs/framework";

const SendOtpSchema = z.object({
  identifier: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = await zodValidator(SendOtpSchema, req.body);
  // body.identifier, body.firstName, body.lastName are now typed and validated
  // zodValidator throws MedusaError(INVALID_DATA) on failure → Medusa returns 400
  ...
}
```

**`backend/src/api/store/auth/verify-otp/route.ts`** [VERIFIED: read file]
- Currently body cast: `const { identifier, otp, firstName, lastName } = req.body as {...}`
- Manual guard: `if (!identifier || !otp) return res.status(400).json(...)`
- **Required change:** Replace with:
```typescript
const VerifyOtpSchema = z.object({
  identifier: z.string().min(1),
  otp: z.string().length(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = await zodValidator(VerifyOtpSchema, req.body);
  ...
}
```

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ioredis | 5.10.1 | Redis atomic counters (INCR, SET NX EX) | Already in backend `dependencies`; `getRedisClient()` exists |
| zod | 3.25.76 | Request body validation schemas | Already in `backend/node_modules/zod`; used internally by Medusa |
| `@medusajs/framework` | 2.13.6 | `zodValidator`, `MedusaError` | Already the backend framework; error handler auto-converts INVALID_DATA to 400 |
| Node.js `crypto` | built-in | HMAC for session signing | Already used in `session.ts` via `createHmac` |

### No New Installs Required

All dependencies for Phase 0 are already installed. Zero `npm install` commands needed.

---

## Architecture Patterns

### SEC-01: Redis Attempt Counter Pattern

```
POST /store/auth/verify-otp
        │
        ▼
  getAttempts(identifier)
        │
   >= 5 attempts? ──── YES ──► 429 { error: "Too many attempts", retryAfter: ttl }
        │ NO
        ▼
  getOtp(identifier) ──── null/expired ──► 401
        │
  OTP matches?
        │ NO
        ▼
  incrementAttempts(identifier)  ← INCR otp_attempts:{id}, set TTL on first call
        │
  new count >= 5? ──── YES ──► 401 + 429 (locked, attempts exhausted)
        │ NO ──────────────► 401 { error: "Invalid OTP", attemptsRemaining: N }
        │
        │ YES (match)
        ▼
  deleteOtp(identifier)
  deleteAttempts(identifier)   ← new: DEL otp_attempts:{id}
        │
        ▼
  Create/find customer → 200
```

**Redis key:** `otp_attempts:{identifier}` with TTL equal to OTP TTL (10 minutes)
**Atomic counter:** `INCR` is atomic by definition in Redis — no race condition risk [VERIFIED: ioredis 5 supports INCR]

### SEC-03: Session Payload with Expiry

```
createSignedCookie({ id, email, phone, ... })
        │
        ▼
  merge exp = now + 7d, iat = now into payload
        │
        ▼
  base64url(JSON.stringify(mergedPayload)) + "." + HMAC
        │
        ▼
  HttpOnly cookie (maxAge: 7d)

verifySignedCookie(value)
        │
        ▼
  split at last ".", verify HMAC
        │ invalid ──► null
        ▼
  parse payload
        │
  exp missing or Date.now() > exp ──► null (expired / legacy token)
        │
        ▼
  return payload
```

### SEC-04: Zod Validation Error Shape (Medusa)

When `zodValidator` throws `MedusaError(INVALID_DATA, ...)`, Medusa's error handler returns:
```json
{
  "code": null,
  "type": "invalid_data",
  "message": "Invalid request: Field 'identifier' is required"
}
```
HTTP status: **400** [VERIFIED: `error-handler.js` case INVALID_DATA → statusCode = 400]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic Redis counter | Custom lock or Lua script | `redis.incr(key)` | INCR is natively atomic in Redis; no scripts needed |
| Schema validation error formatting | Custom error serialiser | `zodValidator` from `@medusajs/framework` | Already formats ZodError into MedusaError with human-readable message |
| HTTP 400 mapping | Manual `res.status(400)` in route | Throw `MedusaError(INVALID_DATA)` or use `zodValidator` | Medusa error handler intercepts and returns consistent 400 shape |
| HMAC signature | Custom crypto implementation | Node.js `createHmac("sha256", secret)` | Already in `session.ts`; battle-tested standard |

---

## Common Pitfalls

### Pitfall 1: Attempt Counter TTL Not Set on First INCR
**What goes wrong:** Redis `INCR` creates the key if it does not exist but sets no TTL. The counter persists indefinitely.
**Why it happens:** `INCR` and `EXPIRE` are two separate commands — a crash between them leaves a TTL-less key.
**How to avoid:** Use `SET key 1 EX {ttl} NX` for the first increment, then `INCR` for subsequent ones. Or: after `INCR`, always call `EXPIRE` (idempotent — harmlessly resets TTL each attempt, which is correct behaviour).
**Warning signs:** Lockout persists across OTP re-sends after TTL should have expired.

### Pitfall 2: Attempt Key Not Deleted on Successful Verify
**What goes wrong:** User enters correct OTP on attempt 3; counter stays at 3; next OTP session starts at count 3 and locks after 2 more attempts.
**Why it happens:** `deleteOtp` removes the OTP value but leaves `otp_attempts:{id}`.
**How to avoid:** Add `deleteAttempts(identifier)` and call it alongside `deleteOtp` on success.
**Warning signs:** Second OTP session locks out earlier than expected.

### Pitfall 3: DEV Bypass in Medusa Backend (Non-Issue)
**What goes wrong:** Assuming the bypass is also in the backend and spending time searching for it.
**Reality:** Grep of entire `backend/src` confirms zero occurrences of `DEV_TEST_PHONE` or `DEV_TEST_OTP`. [VERIFIED: bash grep]
**How to avoid:** Only modify the two frontend BFF files identified.

### Pitfall 4: `createHmac` vs `crypto.subtle` Scope Confusion
**What goes wrong:** Replacing `createHmac` with `crypto.subtle` in `session.ts` during Phase 0, breaking the Node runtime route handlers unnecessarily.
**Why it happens:** CLAUDE.md mentions crypto.subtle is required for Edge Runtime — but that applies to `middleware.ts` (Phase 3), not to route handlers.
**How to avoid:** Phase 0 only adds `exp`/`iat` to the existing `createHmac` implementation. Do NOT migrate to `crypto.subtle` in Phase 0. That migration belongs in Phase 3 (BFF-02/BFF-03).
**Warning signs:** `crypto.subtle` import errors in route handlers that don't declare `export const runtime = "edge"`.

### Pitfall 5: `validateAndTransformBody` Middleware vs Inline `zodValidator`
**What goes wrong:** Creating `src/api/middlewares.ts` with route matchers that don't match Medusa's internal route ID format, so validation is silently skipped.
**How to avoid:** Use inline `zodValidator(Schema, req.body)` directly in each route handler's POST function. This is deterministic and requires no middleware config.
**Warning signs:** Sending a malformed body returns 401 (OTP logic runs) instead of 400 (validation fails first).

### Pitfall 6: `exp` Field Breaks Old Tokens (MIG-03 Concern)
**What goes wrong:** After Phase 0, any existing session cookie without `exp` is rejected by `verifySignedCookie` because `exp` is missing.
**Scope:** MIG-03 (Phase 5) handles backward-compat. For Phase 0, the `verifySignedCookie` check should be: `if (typeof parsed.exp === "number" && Date.now() > parsed.exp)` — tokens with no `exp` field pass this check (the `typeof` guard evaluates false). This means old tokens remain valid until they naturally expire via `maxAge` in the browser — acceptable because Phase 0 is a security hardening step, not a cutover.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7 (backend) — `jest.config.js` present |
| Config file | `backend/jest.config.js` |
| Quick run command | `npm run test:unit --prefix backend` |
| Full suite command | `npm run test:integration:http --prefix backend` |
| Frontend tests | None detected (no jest/vitest config in frontend) |

### Phase Requirements → Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| SEC-01 | 5 wrong OTPs → 429 lockout; 6th attempt blocked | Integration (HTTP) | `npm run test:integration:http --prefix backend -- --testPathPattern=verify-otp` | ❌ Wave 0 |
| SEC-01 | Correct OTP after lockout expired → 200 | Integration (HTTP) | same | ❌ Wave 0 |
| SEC-02 | Server throws on boot with DEV_TEST_PHONE in production | Unit / smoke | `node -e "process.env.NODE_ENV='production'; process.env.DEV_TEST_PHONE='1234'; require('./frontend/src/instrumentation')"` | ❌ Wave 0 |
| SEC-02 | DEV_TEST_PHONE absent from BFF route code | Static (grep) | `grep -r "DEV_TEST" frontend/src` | Manual |
| SEC-03 | Expired cookie (exp in past) → verifySignedCookie returns null | Unit | `npm run test:unit` (frontend — Wave 0 setup needed) | ❌ Wave 0 |
| SEC-03 | Valid unexpired cookie → returns payload | Unit | same | ❌ Wave 0 |
| SEC-04 | Missing `identifier` → 400 with `type: "invalid_data"` | Integration (HTTP) | `npm run test:integration:http --prefix backend -- --testPathPattern=send-otp` | ❌ Wave 0 |
| SEC-04 | Missing `otp` in verify-otp → 400 | Integration (HTTP) | same for verify-otp | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:unit --prefix backend`
- **Per wave merge:** `npm run test:integration:http --prefix backend`
- **Phase gate:** All integration tests green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/integration-tests/http/verify-otp.spec.ts` — covers SEC-01 brute-force lockout
- [ ] `backend/integration-tests/http/send-otp.spec.ts` — covers SEC-04 validation on send
- [ ] Unit test for `session.ts` expiry — covers SEC-03 (frontend test infra does not exist; add Vitest to frontend OR write a Node script)
- [ ] Smoke test for `instrumentation.ts` startup assertion — covers SEC-02

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | OTP lockout (SEC-01), DEV bypass removal (SEC-02) |
| V3 Session Management | yes | Cookie expiry validation (SEC-03) |
| V4 Access Control | no | Not in scope for Phase 0 |
| V5 Input Validation | yes | Zod schema validation (SEC-04) |
| V6 Cryptography | no | Existing HMAC is SHA-256 with secret — correct; not changed in Phase 0 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OTP brute-force (1M combinations in ~10 min with no lockout) | Elevation of Privilege | Redis attempt counter: 5 failures → 429, blocked until TTL expires (SEC-01) |
| Hardcoded test account bypass in production code | Spoofing | Remove bypass blocks; startup assertion throws in production (SEC-02) |
| Stolen session cookie with no expiry | Elevation of Privilege | `exp` field in HMAC payload; server-side expiry check (SEC-03) |
| Malformed request body causing 500 / stack traces | Information Disclosure | Zod validation returns structured 400 before business logic runs (SEC-04) |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis (local) | SEC-01 attempt counter | Assumed running (used by existing auth) | — | — |
| Node.js | All | ✓ | v22.19.0 | — |
| ioredis | SEC-01 | ✓ (in node_modules) | 5.10.1 | — |
| zod | SEC-04 | ✓ (in node_modules) | 3.25.76 | — |

**Note:** Redis availability cannot be verified from a static code audit. The existing `otp-store.ts` already depends on Redis for OTP storage — if the app is running at all, Redis is available.

---

## Open Questions

1. **SEC-03: Should old tokens (no `exp`) be accepted or rejected after Phase 0?**
   - What we know: MIG-03 (Phase 5) says old tokens should be silently re-issued
   - What's unclear: Phase 5 is far away; should Phase 0 reject them now (security) or accept (compatibility)?
   - Recommendation: Accept old tokens in Phase 0 (use `typeof parsed.exp === "number" && Date.now() > parsed.exp` — missing `exp` passes). This avoids forcing all currently logged-in users to re-authenticate during a security patch.

2. **SEC-01: Should the lockout counter reset on OTP re-send?**
   - What we know: A user can request a new OTP (new `otp:{id}` key), but the attempt counter key `otp_attempts:{id}` has the same TTL
   - What's unclear: Should requesting a new OTP clear the counter?
   - Recommendation: No — do not clear the counter on re-send. The lockout applies to the identifier, not the OTP value. This prevents the bypass of sending a new OTP to reset the counter. Counter TTL expires naturally with the OTP window.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Redis is running and accessible when the backend runs | Environment Availability | SEC-01 attempt counter calls would fail; catch Redis errors and fall through to allow verify (fail-open) — document this decision in task |
| A2 | Old session tokens (no `exp`) should be accepted post-Phase 0 | SEC-03 expiry logic | If wrong, all currently logged-in users lose their sessions; easily fixed by adjusting the guard |

---

## Sources

### Primary (HIGH confidence — verified by direct file read or node execution)
- `backend/src/api/store/auth/verify-otp/route.ts` — current verify-otp implementation
- `backend/src/api/store/auth/send-otp/route.ts` — current send-otp implementation
- `backend/src/lib/otp-store.ts` — Redis key patterns, TTL constants
- `backend/src/lib/redis.ts` — ioredis client singleton
- `frontend/src/lib/session.ts` — HMAC cookie implementation
- `frontend/src/app/api/otp/send/route.ts` — DEV bypass location (confirmed)
- `frontend/src/app/api/otp/verify/route.ts` — DEV bypass location (confirmed)
- `frontend/src/app/api/auth/me/route.ts` — session verification call
- `backend/node_modules/@medusajs/framework/dist/http/middlewares/error-handler.js` — INVALID_DATA → HTTP 400 mapping
- `backend/node_modules/@medusajs/framework/dist/zod/zod-helpers.js` — zodValidator throws MedusaError
- `backend/node_modules/@medusajs/framework/dist/http/router.js` — confirms middlewares.ts is auto-loaded
- `frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md` — Next.js 16 instrumentation API
- `backend/node_modules/@medusajs/medusa/dist/commands/start.js` — confirms `instrumentation.ts` register() is called at startup

### Secondary (MEDIUM confidence)
- `backend/package.json` — package versions confirmed (Medusa 2.13.6, ioredis 5.10.1)
- `frontend/package.json` — Next.js 16.2.4 confirmed

---

## Metadata

**Confidence breakdown:**
- File locations and current implementation: HIGH — verified by direct read
- Redis atomic counter pattern: HIGH — ioredis 5 `INCR` is documented atomic
- Medusa error handler 400 mapping: HIGH — read from compiled source
- zodValidator import path: HIGH — `node -e` confirmed availability
- Next.js instrumentation register() contract: HIGH — read from Next.js 16 docs bundled in node_modules
- Medusa instrumentation.ts register() contract: HIGH — read from `start.js` source

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (Medusa 2.x minor versions may shift middleware internals; re-verify if upgrading)

---

## RESEARCH COMPLETE
