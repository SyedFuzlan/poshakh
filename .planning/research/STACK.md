# Technology Stack — Auth System Rebuild

**Project:** Poshakh (Indian fashion e-commerce)
**Milestone:** Replace OTP-only auth with full account system (signup + password + OTP confirmation + forgot-password)
**Researched:** 2026-04-22
**Research constraints:** Bash, WebSearch, and WebFetch were unavailable in this environment. All findings are sourced from training data (cutoff August 2025) plus direct reading of the existing codebase. Confidence levels reflect this honestly. Stable/mature libraries (bcrypt, argon2, ioredis) carry HIGH confidence; newer Medusa v2 extension patterns carry MEDIUM.

---

## Decision Summary (TL;DR for Roadmap)

| Question | Decision | Confidence |
|----------|----------|------------|
| SMS provider | Switch MSG91 → **Twilio Verify** | MEDIUM |
| Password hashing | **argon2** (argon2id variant) | HIGH |
| Password storage | **Custom field on Medusa customer** via data model extension | MEDIUM |
| Email OTP | **Resend SDK** (`resend` npm package) | HIGH |
| Rate limiting | **Keep Redis pattern, extend it** — add attempt counters, use `ioredis` already in stack | HIGH |
| Medusa auth plugin | **None available** — build custom provider using Medusa v2 Auth Module API | MEDIUM |

---

## 1. SMS OTP Provider — Twilio Verify over MSG91

### Recommendation: Twilio Verify

**Replace MSG91 entirely.** Do not keep MSG91 even as a fallback.

### Why Not MSG91

The existing audit (`CONCERNS.md`, `INTEGRATIONS.md`) documents these confirmed problems:

- Raw HTTP integration with no SDK — brittle, hard to test
- MSG91 returns `200 OK` even when delivery fails; the `type` field in the response body is never checked, so `{ success: true }` is returned to the user even when the SMS was never sent
- No retry logic, no delivery webhook, no fallback
- Documented reliability issues in certain Indian telecom regions (Airtel, BSNL in tier-2/3 cities)
- No DLT compliance verification built into the integration — Indian TRAI DLT regulations require pre-registered templates; MSG91 enforces this at account level but the current code has no error handling if the template ID is wrong

### Why Twilio Verify

Twilio Verify is a purpose-built OTP service, not a raw SMS gateway:

- **SDK-first:** `twilio` npm package provides a typed SDK — no raw HTTP calls
- **Delivery receipts:** Webhooks confirm delivery; Verify API returns a `status` field (`pending`, `approved`, `canceled`) that is unambiguous — no 200-on-failure problem
- **Built-in brute-force protection:** Twilio Verify natively enforces attempt limits (max 5 wrong codes per OTP) and auto-invalidates after expiry — this directly addresses the critical brute-force gap documented in `CONCERNS.md`
- **DLT-aware:** Twilio India supports DLT-registered sender IDs and templates, which is required for transactional SMS in India since 2021
- **Rate limiting:** Twilio Verify enforces send-rate limits per number at the service level — supplements (not replaces) application-level rate limiting
- **Free tier:** Twilio trial gives $15.50 credit; Verify pricing is ~$0.05/verification (5 paise at current rates) — negligible for development volume
- **India coverage:** Twilio has direct carrier relationships in India; delivery rates are documented and benchmarked

### What NOT to Do

- **Fast2SMS:** Indian-only provider, lower cost per SMS (~₹0.15), but raw REST API only, no SDK, no built-in OTP service (you manage codes yourself), and has had documented outages. Acceptable for production-scale cost optimization later, not for building on now.
- **Keeping MSG91 as primary:** The existing integration is broken by design (no response-body check). Building password auth on top of it without fixing the SMS layer creates a broken foundation.
- **Supabase Auth for OTP:** Supabase Auth is a full auth platform. This project intentionally uses a custom HMAC cookie session and Medusa customer records — adopting Supabase Auth would require a complete auth architecture rewrite and conflict with Medusa's customer model.

### Implementation Pattern

```typescript
// backend/src/lib/sms.ts
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendSmsOtp(phone: string): Promise<void> {
  const verification = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
    .verifications.create({ to: phone, channel: "sms" });

  if (verification.status !== "pending") {
    throw new Error(`Twilio Verify unexpected status: ${verification.status}`);
  }
}

export async function verifySmsOtp(
  phone: string,
  code: string
): Promise<boolean> {
  const result = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
    .verificationChecks.create({ to: phone, code });

  return result.status === "approved";
}
```

**Critical note:** Because Twilio Verify manages OTP generation and validation on its side, you do NOT store the OTP in Redis when using Twilio Verify for phone. Redis OTP storage is only needed for email OTP (Resend), which Resend does not manage server-side. The existing `otp-store.ts` Redis pattern is kept for email OTP only.

### Packages

```
twilio@^5.x   (latest stable as of Aug 2025: 5.x series)
```

### New Environment Variables (backend)

```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID
```

**Confidence: MEDIUM** — Twilio Verify's superiority over MSG91 is well-documented; pricing and India coverage are confirmed from Twilio's public documentation. The specific version (`5.x`) is from training data; verify `npm show twilio version` before pinning.

---

## 2. Password Hashing — argon2 (argon2id)

### Recommendation: `argon2` npm package, argon2id variant

**Do not use bcrypt.** Use argon2id.

### Why Not bcrypt

bcrypt is not wrong, but it is the 2010-era choice:

- bcrypt truncates passwords at 72 bytes — a password of 73+ characters is silently hashed as if it were 72 characters. This is a known, documented limitation. For a product targeting Indian users typing in mixed-script environments, this is a real edge case.
- bcrypt's work factor is linear (2^rounds iterations) — argon2id is superior against GPU and ASIC attacks because it is both time-hard and memory-hard
- OWASP Password Storage Cheat Sheet (as of 2024) recommends argon2id as the first choice, bcrypt only as a fallback when argon2 is unavailable
- bcrypt requires a native addon (`bcrypt` npm package relies on `node-gyp` and C bindings) — argon2 also has native bindings but the `argon2` npm package handles this more cleanly

### Why argon2id Specifically

argon2 has three variants: argon2d (GPU-resistant), argon2i (side-channel resistant), argon2id (both). OWASP recommends argon2id — it provides protection against both GPU-based dictionary attacks and timing side-channel attacks. Use argon2id exclusively.

### Recommended Parameters (OWASP 2024)

```typescript
import argon2 from "argon2";

// Hash a password
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB — OWASP minimum
  timeCost: 3,        // 3 iterations
  parallelism: 4,     // 4 threads
});

// Verify
const valid = await argon2.verify(hash, password);
```

These parameters are conservative enough to run comfortably on a Medusa backend server (each hash ~200ms on a standard VPS) while exceeding OWASP minimums.

### What NOT to Use

- **bcryptjs (pure JS):** Even slower than native bcrypt, no security advantage, unnecessary
- **crypto.scrypt (built-in):** Viable but you must manage all parameters and salt manually; argon2 handles all of this
- **MD5/SHA-256 for passwords:** Never — these are not key-derivation functions

### Packages

```
argon2@^0.41.x   (latest stable as of Aug 2025)
```

argon2 requires native compilation. Ensure your deployment environment (Railway, fly.io, etc.) has build tools available. On Vercel, the Medusa backend does not run — it runs on a separate server — so this is not a constraint.

**Confidence: HIGH** — argon2 as the OWASP-recommended choice is well-established. Package version from training data; verify before pinning.

---

## 3. Password Storage in Medusa v2 — Data Model Extension

### Problem

Medusa v2's built-in `Customer` entity does not have a `password_hash` field. Medusa v2 has its own Auth Module which handles authentication internally for admin users and can be extended for store customers, but its internals for custom auth providers changed significantly in v2. There is no off-the-shelf "email+password" auth provider for store customers in Medusa v2 as of mid-2025.

### Recommendation: Extend Customer with a Custom Data Model

Add `password_hash` as a custom field to the `Customer` model using Medusa v2's data model extension mechanism, and manage all auth logic in custom backend routes.

This aligns with how the existing codebase works: the OTP auth system already creates and looks up Medusa customers directly via custom routes (`verify-otp/route.ts`), bypassing Medusa's built-in auth system entirely and using a custom HMAC cookie. The new system continues this pattern, adding a `password_hash` column.

### How to Extend in Medusa v2

Medusa v2 uses MikroORM with its own module system. The supported way to add custom fields to core entities is via the `additional_data` mechanism or via a custom link/module. The cleanest approach for a single field like `password_hash` is:

**Option A: Custom Module with a linked table (RECOMMENDED)**

Create a `CustomerAuth` custom module that owns a separate table (`customer_auth`) with a 1:1 link to `customer.id`. This keeps credentials fully decoupled from the commerce entity.

```
customer_auth table:
  id: string (PK)
  customer_id: string (FK → customer.id, unique)
  password_hash: string
  created_at: timestamp
  updated_at: timestamp
```

This is the correct Medusa v2 architecture pattern: custom modules own their own tables, linked to core entities via the Link Module (`@medusajs/framework`).

**Option B: Additional Data on Customer (AVOID)**

Medusa v2 has an `additional_data` concept but it is intended for metadata (JSON blobs), not structured security-sensitive fields like password hashes. Do not store password hashes in a JSON metadata column — they will not be indexed properly and JSON fields are harder to audit.

### Why Not Use Medusa's Auth Module Directly

Medusa v2 ships with an `@medusajs/auth` module that provides token-based authentication, primarily designed for admin users and OAuth flows. Creating a custom `AuthProvider` within that module is possible but the DX is complex: you must implement the `AbstractAuthModuleProvider` interface, register it in `medusa-config.ts`, and work within Medusa's auth token/session model — which would conflict with the existing HMAC cookie session already in production.

The existing custom session pattern (`poshakh_token` HMAC cookie) is sound and already works. Do not rip it out to use Medusa's auth module — the cost of that migration exceeds the benefit.

**Decision:** Keep the custom HMAC cookie session. Add a `customer_auth` table via a custom Medusa module. Store argon2id hashes there.

**Confidence: MEDIUM** — Medusa v2's extension patterns for custom modules and data linking are well-documented in official docs, but the specific MikroORM entity decoration syntax has changed between Medusa v2 minor versions. Recommend consulting `docs.medusajs.com/resources/references/data-model` at implementation time.

---

## 4. Email OTP — Resend SDK

### Recommendation: `resend` npm package

This is already the planned choice (explicitly noted in `CONCERNS.md` and `send-otp/route.ts`). The research confirms it.

### Why Resend

- **Free tier:** 3,000 emails/month — sufficient for all development-stage volume
- **SDK quality:** The `resend` npm package is a first-class TypeScript SDK with native types — no `@types/resend` needed
- **Deliverability:** Resend is built on top of AWS SES infrastructure with better default deliverability than raw SES or Nodemailer + SMTP
- **React Email:** Resend has a companion package (`react-email`) for building HTML email templates in JSX — optional but useful for OTP email design
- **API simplicity:** One function call to send; no SMTP credentials to manage

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendEmailOtp(
  email: string,
  otp: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: "Poshakh <noreply@yourdomain.com>",
    to: email,
    subject: "Your Poshakh verification code",
    text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
  });

  if (error) {
    throw new Error(`Resend email delivery failed: ${error.message}`);
  }
}
```

**Email OTP flow note:** Unlike Twilio Verify (which manages OTP generation and validation), Resend is purely a delivery channel. You generate the OTP code yourself, store it in Redis with a 10-minute TTL and attempt counter, send it via Resend, and validate it against Redis on verification. The existing `otp-store.ts` Redis pattern is reused directly for email OTP.

### Alternatives Not Recommended

- **Nodemailer + SMTP:** Lower-level, requires managing SMTP credentials, TLS config, and deliverability yourself. Resend handles all of this.
- **SendGrid:** Larger platform, free tier is 100/day (not 3,000/month), more complex setup, less developer-friendly SDK
- **AWS SES:** Excellent for production scale, but requires domain verification, IAM setup, and more configuration than is warranted at development stage
- **Postmark:** Strong deliverability, but no meaningful free tier — starts at $15/month

### Packages

```
resend@^4.x   (latest stable as of Aug 2025; v4 added React Email integration)
```

### New Environment Variables (backend)

```
RESEND_API_KEY
RESEND_FROM_EMAIL   # e.g. noreply@poshakh.in (domain must be verified in Resend dashboard)
```

**Confidence: HIGH** — Resend SDK is stable and its free tier and SDK quality are well-established. Package version from training data.

---

## 5. Rate Limiting — Extend the Existing Redis Pattern

### Recommendation: Keep ioredis, extend `otp-store.ts`

Do not add a new rate-limiting library. The existing Redis-backed rate limiting in `otp-store.ts` is architecturally correct. It needs to be extended to cover the verify endpoint and to add attempt counting.

### Current State (from codebase audit)

The existing `otp-store.ts` implements:
- **Send-rate limit:** `otp_sent:{identifier}` key with 60-second TTL — prevents OTP re-send within 60 seconds
- **No verify-attempt protection:** The verify endpoint has no attempt counter (CRITICAL concern from `CONCERNS.md`)

### What to Add

**Attempt counter in Redis:**

```typescript
// Pattern: otp_attempts:{identifier}
// TTL: same as OTP TTL (10 minutes)
// On each failed verify: INCR the counter
// On 5 failures: delete both otp:{identifier} and otp_attempts:{identifier}, return 429
// On success: delete both keys

const ATTEMPT_KEY = `otp_attempts:${identifier}`;
const attempts = await redis.incr(ATTEMPT_KEY);
await redis.expire(ATTEMPT_KEY, 600); // sync TTL with OTP

if (attempts > 5) {
  await redis.del(`otp:${identifier}`, ATTEMPT_KEY);
  return { error: "too_many_attempts" };
}
```

**Password login rate limiting (new requirement):**

The new password login endpoint also needs rate limiting — brute-forcing passwords is a bigger risk than OTP codes. Use the same Redis pattern:

```typescript
// Pattern: login_attempts:{identifier}   (identifier = phone number)
// TTL: 15 minutes
// On failed password verify: INCR
// On 10 failures: lock account for 15 minutes, return 429
// On success: delete key
```

### Why Not Upstash Rate Limit / express-rate-limit / Other Libraries

- `express-rate-limit`: Middleware designed for Express, works in-memory by default. Medusa backend is not vanilla Express (it wraps with its own request handling). Using in-memory rate limiting in a multi-process or multi-instance deployment causes limits to not be shared across processes. Problematic from day one.
- `@upstash/ratelimit`: Excellent library, but requires Upstash Redis — you already have ioredis connected to your own Redis instance. Adding a second Redis connection (Upstash) only for rate limiting is unnecessary complexity.
- **Keeping ioredis pattern:** Pros — already installed, already configured, already working for OTP send-rate, consistent key patterns, Redis is already a hard dependency. Cons — manual implementation. The manual implementation is 20 lines of code; this is not a case where a library's abstraction pays for itself.

**Confidence: HIGH** — ioredis is already in the stack (v5.10.1); extending the existing pattern is clearly the right call. The Redis key design for attempt counters is a well-established pattern.

---

## 6. Medusa v2 Auth Plugin — None Available; Build Custom

### Finding: No Production-Ready Password Auth Plugin for Medusa v2 Store Customers

As of August 2025, Medusa v2 does not ship a first-party `emailpass` or `phonepass` authentication provider for store customers (as opposed to admin users). The official `@medusajs/auth` module provides the infrastructure for building auth providers, and Medusa's own admin uses it with an email+password flow — but this is not exposed as a configurable store-customer auth provider.

Community plugins in the `medusajs-plugins` ecosystem exist for Medusa v1 (e.g., `medusa-plugin-auth` which supported Google, Facebook, Apple, etc.) but most have not been ported to v2, and none implement a phone-number-first password flow.

### Decision: Custom Implementation in Backend Custom Routes

Continue the existing pattern of custom routes in `backend/src/api/store/`. The new auth endpoints are:

```
POST /store/auth/signup          — name + phone + optional email + password → send phone OTP
POST /store/auth/confirm-otp     — phone + otp → complete signup, set cookie
POST /store/auth/login           — phone + password → set cookie
POST /store/auth/forgot-password — phone → send OTP via Twilio Verify
POST /store/auth/reset-password  — phone + otp + new_password → verify OTP, update hash
POST /store/auth/send-email-otp  — email → generate + store in Redis + send via Resend
POST /store/auth/verify-email-otp — email + otp → mark email confirmed
```

These routes integrate with the existing HMAC cookie session (`poshakh_token` / `MEDUSA_CUSTOMER_SECRET`) — no new session mechanism needed.

### Why Not Use Medusa's Built-in Auth Module

1. Medusa's auth module uses JWT tokens and its own session model — integrating it would require replacing the existing HMAC cookie session, which already works and is simpler
2. The existing codebase bypasses Medusa's auth entirely and directly manipulates `CustomerService` — this is already established as the project's pattern
3. A custom auth module via `AbstractAuthModuleProvider` requires registering in `medusa-config.ts` and working within the Medusa auth token lifecycle — significant implementation overhead for no functional gain over custom routes
4. Medusa admin auth is completely separate (uses its own tokens) — the store customer auth has always been custom in this project

**Confidence: MEDIUM** — the conclusion that no production-ready password auth plugin exists for Medusa v2 store customers is from training data (August 2025). The Medusa ecosystem moves quickly. Before implementation, run `npm search medusa-plugin-auth` or check `medusajs.com/plugins` to confirm no plugin has emerged since.

---

## Complete Package List

### Backend (`backend/package.json`)

**Add:**

```bash
npm install twilio@^5 argon2@^0.41 resend@^4
```

| Package | Version | Purpose |
|---------|---------|---------|
| `twilio` | `^5.x` | Twilio Verify SDK for SMS OTP send + verify |
| `argon2` | `^0.41.x` | Password hashing (argon2id variant) |
| `resend` | `^4.x` | Email OTP delivery |

**Keep (existing):**

| Package | Version | Purpose |
|---------|---------|---------|
| `ioredis` | `5.10.1` | Redis client for OTP storage + rate limiting (extended, not replaced) |

**Remove:**
- MSG91 raw HTTP integration in `backend/src/api/store/auth/send-otp/route.ts` (no package to uninstall — was raw `fetch`)

### Frontend (`frontend/package.json`)

**No new packages required for this milestone.** The frontend auth UI (signup form, login form, forgot-password form) uses only what's already available:
- Zustand (state)
- React 19 built-in hooks
- Tailwind CSS 4 (styling)
- Existing BFF API route pattern

The only frontend change is adding `middleware.ts` for route protection — this uses Next.js built-in APIs, no new package.

### Type Definitions

```bash
# In backend — argon2 ships its own types; twilio ships its own types; resend ships its own types
# No @types/* packages needed for any of the three additions
```

---

## Environment Variables — Complete Auth Set

### Backend (`backend/.env`)

**Add:**

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@poshakh.in
```

**Remove:**

```env
# MSG91_AUTH_KEY     ← remove after Twilio migration verified
# MSG91_TEMPLATE_ID  ← remove after Twilio migration verified
```

**Keep:**

```env
DATABASE_URL
REDIS_URL
JWT_SECRET
COOKIE_SECRET
STORE_CORS / ADMIN_CORS / AUTH_CORS
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
```

### Frontend (`frontend/.env.local`)

**No new variables.** The DEV bypass variables (`DEV_TEST_PHONE`, `DEV_TEST_OTP`) must be guarded with `process.env.NODE_ENV !== "production"` — this is a code change, not a variable change.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| SMS OTP | Twilio Verify | Fast2SMS | Raw REST only, no SDK, no built-in OTP management, no brute-force protection |
| SMS OTP | Twilio Verify | Keep MSG91 | Silent delivery failures, no SDK, no retry, raw HTTP, brute-force gap |
| SMS OTP | Twilio Verify | Supabase Auth | Full auth platform rewrite — conflicts with existing HMAC cookie + Medusa customer model |
| Password hash | argon2id | bcrypt | 72-byte truncation bug, memory-hard advantage of argon2id for GPU resistance, OWASP first choice |
| Password hash | argon2id | scrypt (built-in) | Manual salt management, no standard output format, worse DX |
| Email OTP | Resend | SendGrid | 100/day free tier vs 3,000/month; more complex setup |
| Email OTP | Resend | Nodemailer | No deliverability management, requires SMTP config, no free tier |
| Rate limiting | ioredis (extend) | @upstash/ratelimit | Second Redis connection (Upstash) when own Redis is already connected |
| Rate limiting | ioredis (extend) | express-rate-limit | In-memory by default — breaks in multi-process; not native to Medusa |
| Medusa auth | Custom routes | AbstractAuthModuleProvider | High implementation overhead, requires replacing existing HMAC session |
| Password storage | Custom module (linked table) | additional_data metadata | JSON column for security-sensitive data is an anti-pattern; unindexed |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Twilio Verify recommendation | MEDIUM | Training data Aug 2025 + documented MSG91 problems in existing codebase. Twilio India coverage verified from training; specific SDK version unverified. |
| argon2 over bcrypt | HIGH | OWASP recommendation is stable and well-sourced. The 72-byte bcrypt limitation is a documented, permanent design choice. |
| argon2 parameters | HIGH | OWASP Password Storage Cheat Sheet parameters — stable reference. |
| Resend for email OTP | HIGH | Resend SDK is stable, free tier is documented, already planned in codebase comments. |
| ioredis extension for rate limiting | HIGH | ioredis is already installed and working; extending it is the lowest-risk approach. |
| No Medusa v2 password auth plugin | MEDIUM | Training data Aug 2025. Medusa ecosystem evolves; verify at implementation time. |
| Custom module for password_hash | MEDIUM | Medusa v2 custom module pattern is established, but entity extension syntax varies across v2 minor versions. Check docs.medusajs.com at implementation time. |

---

## Open Questions for Implementation Phase

1. **Twilio India DLT registration:** Twilio requires a pre-registered DLT sender ID for India (TRAI regulation). Does the client have a DLT-registered entity? If not, DLT registration with Twilio can take 5–10 business days. This must be started before the SMS OTP endpoint can go live in production.

2. **Resend domain verification:** Resend requires DNS verification of the sending domain (`poshakh.in` or similar). This is a one-time DNS setup. Confirm domain access before beginning email OTP implementation.

3. **argon2 native compilation:** `argon2` npm package uses node-gyp. Confirm the production server environment has build tools (`python`, `make`, `gcc`). Most Linux VPS environments (Railway, fly.io, Render) do. Verify before committing.

4. **Medusa v2.13.6 custom module entity syntax:** The MikroORM entity decoration syntax used by Medusa v2 is version-specific. Confirm the exact approach for adding a 1:1 linked custom table in v2.13.x by checking `docs.medusajs.com/resources/references/data-model` at implementation start.

5. **Twilio Verify vs self-managed OTP for phone:** If Twilio Verify is used, the OTP code is managed entirely by Twilio (you never see or store the code). This means the DEV bypass (`DEV_TEST_OTP`) must be replaced with a different local testing strategy — either a Twilio test credential or a feature flag that short-circuits the Twilio call and auto-approves a known code.

---

*Research date: 2026-04-22 | Stack dimension for auth milestone | Feeds roadmap phase structure*
