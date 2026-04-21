# Domain Pitfalls

**Domain:** Auth system replacement — OTP-only to password + OTP, Indian e-commerce, Next.js 16 + Medusa.js v2
**Researched:** 2026-04-22
**Confidence:** HIGH on security fundamentals (well-established, OWASP-backed); MEDIUM on Medusa v2 specifics (version-specific migration behaviour); MEDIUM on India SMS delivery (operational knowledge, patterns may shift)

---

## Critical Pitfalls

These mistakes cause security incidents, data loss, or full rewrites.

---

### Pitfall 1: bcrypt Work Factor Too Low (Password Storage)

**What goes wrong:** Developers default to bcrypt cost factor 10 because that is what tutorials use. At cost 10, a modern GPU cracks a weak 8-character password in seconds. At cost 12, the same operation takes ~4x longer with negligible UX impact (hash time ~250ms on modern server hardware vs ~65ms at 10).

**Why it happens:** Copy-paste from 2015 tutorials that pre-date GPU cracking as a realistic threat for indie projects. The bcrypt API default of 10 feels "official" so it never gets questioned.

**Consequences:** If the PostgreSQL database is ever exposed (misconfigured backup, SQL injection), user passwords are crackable without bcrypt being the bottleneck.

**Prevention:**
- Use `bcrypt.hash(password, 12)` — cost 12 is the current OWASP minimum recommendation for bcrypt in 2024+
- Store `cost_factor` alongside the hash in a separate column so you can transparently re-hash on login when you raise the factor later (progressive upgrade pattern)
- Never store plaintext, MD5, or SHA-based password hashes — bcrypt, Argon2id, or scrypt only
- On login, after successful bcrypt verify, check if stored hash was computed at the current cost factor; if not, re-hash immediately with the new factor and save

**Warning signs:**
- `bcrypt.hash(password, 10)` in any route handler — change to 12
- Password hash column is `varchar(60)` instead of `varchar(72)` — bcrypt output is always 60 chars but some ORMs truncate if column is wrong type

**Detection:** `grep -r "bcrypt.hash" backend/src` — review the second argument in every call.

**Phase mapping:** Address in the phase that creates `POST /store/auth/register`. Do not ship password storage code without a code review checkpoint on this line specifically.

**Confidence:** HIGH — bcrypt cost factor guidance is stable OWASP doctrine.

---

### Pitfall 2: Timing Attack on Password Comparison

**What goes wrong:** An attacker sends many login attempts and measures response time. If password comparison short-circuits on first non-matching byte (as naive string equality does), the response time leaks information about how many characters matched. Over millions of requests this enables character-by-character reconstruction.

**Why it happens:** Developers call `storedPassword === inputPassword` for speed, or they fetch the user first and only hash-compare if the user exists — causing a measurable time difference between "user not found" and "user found but wrong password."

**Consequences:** Password enumeration and eventual reconstruction under automation. Also: user existence enumeration if "user not found" returns faster than "wrong password."

**Prevention:**
- Always use `bcrypt.compare()` — it is constant-time by construction
- Even when the user is NOT found, still run a dummy `bcrypt.compare(input, DUMMY_HASH)` to equalise response time (prevents user enumeration via timing)
- Return the same HTTP 401 body for "user not found" and "wrong password" — never differentiate in the response

**Warning signs:**
- Any `===` comparison in a password login path
- `if (!user) return 401` placed BEFORE the bcrypt compare call (timing leak even if you do use bcrypt)

**Phase mapping:** Address in the login route handler, Phase 1 of auth rebuild.

**Confidence:** HIGH — constant-time comparison is well-understood cryptographic hygiene.

---

### Pitfall 3: OTP Brute-Force — The Existing Critical Vulnerability

**What goes wrong:** This is already confirmed present in CONCERNS.md. A 6-digit numeric OTP has 1,000,000 possible values (000000–999999). With a 10-minute TTL and no attempt limit, an automated attacker can try all values programmatically within the window. At 100 requests/second (trivial with async HTTP), exhausting 1,000,000 combinations takes ~166 minutes — but with 900,000 meaningful non-zero-padded values and no lockout, realistic success is near-certain within the TTL.

**Why it happens:** Rate limiting is applied to the SEND endpoint (60-sec cooldown) but the VERIFY endpoint has no equivalent. Developers assume "only the user has the OTP" without modelling an attacker who already has the phone number.

**Consequences:** Any phone number whose owner has recently requested an OTP can be silently taken over. This is not theoretical — Indian phone numbers are enumerable from leaked datasets.

**Prevention:**
- Add a Redis key `otp_attempts:{identifier}` with INCR on every failed verify
- After 5 failed attempts: delete the OTP from Redis, return HTTP 429, force the user to request a new OTP
- Apply the same 60-second rate limit already on send-OTP to the verify endpoint as well (IP-level, not just identifier-level)
- OTP Redis key must be deleted immediately after first successful verify (one-time use — see Pitfall 4)

**Warning signs:**
- No `otp_attempts:` key pattern in `otp-store.ts`
- Verify route does not call Redis INCR before or after comparison
- HTTP 429 is never returned from the verify route

**Detection:** The verify route in CONCERNS.md is confirmed to have no attempt counter. This is the first fix, not an optional hardening.

**Phase mapping:** Fix in Phase 0 (security hardening of existing code) BEFORE any new auth features are built. Building password auth on top of a brute-forceable OTP layer is building on a broken foundation.

**Confidence:** HIGH — confirmed present in audit, attack math is straightforward.

---

### Pitfall 4: OTP Replay Attack — One-Time Use Not Enforced

**What goes wrong:** After a user successfully verifies an OTP, the OTP key is left in Redis until the 10-minute TTL naturally expires. A network-level attacker who observed the OTP value (e.g., via SMS interception, shoulder surfing, or a compromised device) can replay it within the TTL window to authenticate as that user again.

**Why it happens:** Developers focus on the "happy path" — OTP is verified, user is logged in, done. The cleanup step (delete the key) is easy to forget because the flow works correctly without it.

**Consequences:** Verified OTPs become persistent credentials within their TTL window. For a forgot-password OTP, this means the reset window stays open for 10 minutes after the legitimate user already used it.

**Prevention:**
- In `otp-store.ts`, after a successful OTP comparison, call Redis `DEL otp:{identifier}` immediately before returning success
- Also delete the attempts counter key `DEL otp_attempts:{identifier}`
- This must be atomic: use a Redis transaction (`MULTI/EXEC`) or Lua script to compare-and-delete in one operation — prevents a race condition where two concurrent verify requests both succeed

**Warning signs:**
- Verify route does not call any Redis DEL after a successful match
- OTP store has no `deleteOtp(identifier)` function

**Phase mapping:** Same phase as Pitfall 3. Both are one atomic fix to the verify route.

**Confidence:** HIGH — standard OTP security requirement.

---

### Pitfall 5: DEV_TEST_PHONE Bypass in Production

**What goes wrong:** Confirmed in CONCERNS.md. The frontend BFF routes contain a bypass: if the `DEV_TEST_PHONE` environment variable matches the submitted phone number, authentication is skipped and a synthetic customer is returned. If any developer accidentally sets this variable in a production `.env`, any person who knows the bypass phone number can log in as any customer.

**Why it happens:** Test bypass code is written during development and never removed. In the auth rebuild, new routes will be written — but the OLD bypass routes may still be active alongside the new ones during a transition period.

**Consequences:** Complete authentication bypass in production for the bypass phone number. Not detectable from application logs unless you specifically log env var reads.

**Prevention:**
- Remove the bypass entirely from both `send-otp/route.ts` and `verify-otp/route.ts` — do not gate it with `NODE_ENV !== "production"`, remove it completely
- If a test bypass is genuinely needed for CI, create a separate test-only route at a path that is blocked by `middleware.ts` in production, or use environment-level feature flags that default to OFF
- Add a startup assertion in `medusajs.config.ts` or server init: `if (process.env.DEV_TEST_PHONE) throw new Error("DEV_TEST_PHONE must not be set in production")` — this makes misconfiguration a deploy failure rather than a silent vulnerability

**Warning signs:**
- `DEV_TEST_PHONE` appears anywhere in non-test files
- Any hardcoded phone number string in route handlers
- Any code path that skips `bcrypt.compare` or Redis OTP lookup

**Phase mapping:** Fix as part of the auth rebuild kickoff, before writing any new auth code. The old OTP routes will be replaced — ensure the replacements contain zero bypass logic.

**Confidence:** HIGH — confirmed present in audit, no ambiguity.

---

### Pitfall 6: Session Token Without Server-Side Expiry Validation

**What goes wrong:** Confirmed in CONCERNS.md. The `poshakh_token` HMAC-signed cookie has a `maxAge` of 7 days on the browser side, but the server-side verify function does not check an embedded expiry timestamp. A token extracted from the cookie (e.g., via XSS, browser extension, or compromised device) can be replayed indefinitely after the cookie itself would have expired.

**Why it happens:** HMAC signing ensures the token is not tampered with, but HMAC alone does not encode time. Developers conflate "signature is valid" with "token is current."

**Consequences:** Stolen session tokens do not expire. With a new password auth system, the value of a stolen session increases — a token now proves authenticated identity rather than just "this phone number sent an OTP."

**Prevention:**
- Add `iat` (issued-at) and `exp` (expiry) fields to the signed payload: `{ customerId, phone, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }`
- In `verifySignedCookie`, after HMAC validation, check `payload.exp > Date.now()` — reject expired tokens with 401
- This is a one-file fix in `session.ts` — do it during the auth rebuild, not after

**Warning signs:**
- Session payload has `customerId` and `phone` but no `exp` or `expiresAt` field
- `verifySignedCookie` returns the payload without checking any timestamp

**Phase mapping:** Fix in the session utility during auth rebuild Phase 1. Any new auth routes will create new tokens — ensure new tokens have expiry from day one.

**Confidence:** HIGH — confirmed present in audit.

---

### Pitfall 7: Breaking Existing Logged-In Users During Auth System Cutover

**What goes wrong:** The existing system issues `poshakh_token` cookies to already-authenticated users. When the new auth system goes live, if the token payload schema changes (e.g., adding password hash reference, new fields, or different HMAC secret), all existing tokens become invalid simultaneously. Every previously logged-in user is logged out on the next page load, with no warning.

**Why it happens:** Developers test the new auth flow with new accounts and never test token validation against a token issued by the old system. The cutover happens in a single deploy.

**Consequences:** Mass session invalidation on deploy. For an e-commerce platform, this means users with items in cart or mid-checkout lose their session. Combined with the existing cart-not-persisted concern (CONCERNS.md), users also lose their cart. This causes immediate visible broken experience at launch.

**Prevention:**
- Keep the HMAC secret (`SESSION_SECRET`) unchanged — do not rotate it during the rebuild
- Ensure the new `verifySignedCookie` function is backward-compatible: if the payload has no `exp` field (old token), accept it but immediately re-issue a new token with `exp` in the Set-Cookie header (token upgrade on next request)
- OR: deploy a 24-hour grace period where both old and new token shapes are accepted
- Before cutover, add the `exp` field validation in a way that treats missing `exp` as "expired immediately" vs "accept indefinitely" — choose which is safer for your migration window

**Warning signs:**
- New session utility throws on any token that lacks the new fields
- HMAC secret is regenerated as part of the auth rebuild (causes 100% session invalidation)
- No backward-compatibility test against a token minted by the current production code

**Phase mapping:** Must be explicitly planned in the cutover phase. Write a migration test: mint a token using current code, verify it against new code, confirm it does not throw.

**Confidence:** HIGH — auth migration pattern is well-understood; this specific stack's HMAC approach makes backward-compat tractable.

---

## High-Severity Pitfalls

These cause significant user-facing problems or security weaknesses that can be exploited.

---

### Pitfall 8: Medusa v2 Custom Fields on Customer Entity — Migration Pitfalls

**What goes wrong:** Medusa v2 uses a module-based architecture with its own migration runner. Adding custom fields to the `Customer` entity (e.g., `password_hash`, `phone_verified`, `email_verified`, `otp_channel`) requires either extending the Customer module via Medusa's Data Model API or creating a parallel custom table linked by customer ID. If you attempt to alter the Medusa-managed `customer` table via raw SQL or a hand-written migration, Medusa's own migration runner may conflict, overwrite your changes, or fail on next `medusa db:migrate`.

**Why it happens:** Medusa v2's Data Model API is unfamiliar. Developers fall back to "just add a column" via raw SQL or Knex migration, not realising Medusa treats its own tables as owned schema.

**Consequences:** Medusa migration failures on upgrade or re-deploy. Custom columns silently dropped. Password hashes stored in a column Medusa doesn't know about — orphaned on customer table refresh.

**Prevention:**
- Do NOT add `password_hash` to Medusa's `customer` table directly
- Store auth credentials in a separate custom table: `customer_auth_credentials (customer_id FK, password_hash, phone_verified_at, email_verified_at, created_at, updated_at)` linked by `customer.id`
- Create this table via a Medusa-compatible migration: `medusa db:generate auth_credentials` and write the migration using Medusa's MikroORM-based migration format, not raw Knex
- This separation also means if Medusa releases a Customer module update, your auth data is unaffected

**Warning signs:**
- `ALTER TABLE customer ADD COLUMN password_hash` anywhere in migration files
- Schema changes to `customer` table not created via `medusa db:generate`
- Raw SQL in any migration file that touches Medusa core tables

**Phase mapping:** Architecture decision must be made in Phase 1 design, before writing any migration file. The separate table approach is non-negotiable.

**Confidence:** MEDIUM — Medusa v2 Data Model API specifics may have edge cases not fully captured without live testing; the separation principle is correct regardless.

---

### Pitfall 9: Phone Number Enumeration via API Response Differentiation

**What goes wrong:** The send-OTP endpoint returns different HTTP status codes or response bodies for "phone number not registered" vs "OTP sent successfully." An attacker can use this to enumerate which phone numbers have accounts on the platform, then target those accounts specifically.

**Why it happens:** Developers naturally want to give users helpful feedback ("This number isn't registered, please sign up first"). This is a good UX intention with a bad security consequence.

**Consequences:** India has leaked phone number datasets (Truecaller, JioFibre, Airtel breaches). A targeted attacker can cross-reference a leaked dataset against the Poshakh API to identify which numbers have accounts, then target those for OTP brute-force.

**Prevention:**
- The send-OTP endpoint must always return HTTP 200 with `{ success: true }` regardless of whether the phone is registered — even if no OTP was sent
- Differentiate behavior in the forgot-password flow: if phone not registered, still return success but send nothing (silent no-op)
- Client-side: show the same message regardless: "If this number is registered, you will receive an OTP"

**Warning signs:**
- `return res.status(404).json({ error: "Phone number not registered" })` in any send-OTP route
- Different response schemas for registered vs unregistered phone numbers in the same endpoint

**Phase mapping:** Address when designing the forgot-password OTP route. Also apply to the signup flow — "phone already registered" should only be surfaced after OTP verification, not before.

**Confidence:** HIGH — standard account enumeration prevention, well-documented in OWASP.

---

### Pitfall 10: Next.js Middleware Cookie Inspection — Edge Runtime Pitfalls

**What goes wrong:** Next.js `middleware.ts` runs on the Edge Runtime. The Edge Runtime does not support Node.js crypto APIs including `crypto.createHmac`. If you write middleware that validates the HMAC signature of `poshakh_token` using Node.js crypto, it throws at runtime. Developers then either (a) move the full validation to each page (defeating the purpose of middleware) or (b) use a weaker check (cookie presence only) and leave actual validation to the page handler.

**Why it happens:** The distinction between Edge Runtime and Node.js Runtime is not obvious. `crypto.createHmac` works in development with a polyfill but fails in production Edge deployment.

**Consequences:** Either middleware does no real auth validation (cookie presence check only), or the middleware crashes all protected routes. Both outcomes are bad.

**Prevention:**
- Use the Web Crypto API (`crypto.subtle`) in middleware — it is natively available in the Edge Runtime
- Alternatively, add `export const config = { runtime: 'nodejs' }` to middleware — but this disables Edge optimizations
- Recommended approach for this project: middleware does a lightweight presence-and-format check (is the cookie present and does it have the right structure?), while the actual HMAC verification happens in each protected API route handler and server component. This is acceptable because the middleware redirect prevents the flash-of-content problem; deep auth is validated at the data-access layer
- Sign the token with an HMAC-SHA256 algorithm using `crypto.subtle.importKey` + `crypto.subtle.sign` — this works in Edge Runtime and is equivalent in security

**Warning signs:**
- `import crypto from 'crypto'` in `middleware.ts` — this is the Node.js crypto module, not the Web Crypto API
- `crypto.createHmac` anywhere in the middleware file

**Phase mapping:** Address when implementing `middleware.ts`. Write the Edge-compatible crypto utility before the middleware, test it in a minimal Edge function first.

**Confidence:** HIGH — Next.js Edge Runtime limitations are well-documented and this specific `crypto.createHmac` failure is a common reported mistake.

---

### Pitfall 11: MSG91 Silent Delivery Failures — Confirmed Reliability Risk

**What goes wrong:** Confirmed in CONCERNS.md. MSG91 returns HTTP 200 even when the message fails to deliver due to DLT (Distributed Ledger Technology) template mismatch, insufficient balance, or TRAI delivery restrictions. The current code checks only `res.ok` and treats 200 as success.

**Why it happens:** Developers test with a phone number that works, see delivery, and assume the integration is correct. The failure cases (DLT mismatch, operator filtering) only appear under specific conditions that don't arise during local testing.

**Consequences for the new auth system:** Signup OTPs that silently fail. Users complete the signup form, see "OTP sent," wait, never receive it, and abandon. This is invisible — the platform cannot distinguish "user didn't receive OTP" from "user is not checking their phone." Support requests escalate as "verification is broken."

**Prevention:**
- Parse MSG91 response body and inspect the `type` field — `"success"` vs `"error"` — log failures as ERROR level with the phone number prefix (last 4 digits only, not full number) and MSG91 error code
- The new auth system should be built with a provider abstraction (`ISmsProvider` interface) so switching from MSG91 to Twilio Verify is a one-file change
- For signup specifically: if the OTP send fails, return HTTP 503 to the frontend, not success — the user cannot continue without the OTP
- Evaluate Twilio Verify for production: it provides delivery status webhooks, retry logic, and GSMA-compliant delivery to Indian operators. MSG91's DLT template requirement is a compliance burden that Twilio handles internally.

**Warning signs:**
- No parsing of MSG91 response body beyond `res.ok`
- SMS provider calls are not wrapped in try/catch with explicit error logging
- No ERROR-level log entry when SMS fails

**Phase mapping:** Fix MSG91 parsing in the same phase as building the new send-OTP route. The provider abstraction layer should be designed before writing the first line of the new send route.

**Confidence:** MEDIUM on MSG91 specifics (operational behaviour, confirmed from audit pattern); HIGH on the principle of parsing provider response body.

---

### Pitfall 12: Forgot-Password OTP vs Email Reset Link — Wrong Choice for India

**What goes wrong:** Email-based password reset links are the Western standard but India's phone-first market has different patterns. However, SMS OTP for password reset has a specific attack: SIM swapping. In India, SIM swaps are relatively accessible (telecom stores, social engineering) compared to Western markets. A SIM-swapped number gives an attacker full password reset capability.

**Why it happens:** Product teams adopt one reset mechanism without considering the threat model for their specific market.

**The real pitfall:** Building the forgot-password flow as SMS-OTP-only with no email fallback makes SIM swap the single attack surface for account takeover.

**Prevention for Poshakh:**
- AUTH-06 and AUTH-07 specify SMS OTP for forgot-password — this is correct for UX (phone is primary)
- Add the following safeguard: if the user provided an email at signup and has verified it, send the reset OTP to email, not SMS, as the default channel (email is harder to SIM-swap)
- Show the user which channel they are receiving the OTP on: "We sent a reset code to your registered email" or "We sent a reset code to your phone ending in XXXX"
- Do not send the reset OTP to SMS if the phone number is unverified
- Impose a stricter TTL on forgot-password OTPs than signup OTPs: 5 minutes instead of 10

**Warning signs:**
- Forgot-password route always uses SMS regardless of whether email is available
- Same OTP TTL (10 min) for signup confirmation and password reset

**Phase mapping:** AUTH-06/AUTH-07 implementation phase. The channel selection logic (email preferred over SMS when available and verified) should be in the OTP routing layer, not scattered across route handlers.

**Confidence:** MEDIUM — SIM swap prevalence is India-specific operational knowledge; channel preference logic is architectural, verifiable.

---

## Moderate Pitfalls

These cause correctness issues, poor UX, or technical debt if not caught early.

---

### Pitfall 13: Cart State Lost on Auth System Cutover

**What goes wrong:** Confirmed in CONCERNS.md — cart state is in Zustand without persistence. During auth rebuild, any route handler changes that touch the cookie or session will cause session invalidation, which logs the user out. A logged-out user loses their cart (Medusa cart is linked to the session). If this happens during the cutover deploy, users mid-shopping lose their cart.

**Why it happens:** Auth and cart are treated as separate concerns. They are not — Medusa carts are associated with customers via the session.

**Prevention:**
- Before the auth cutover deploy, fix cart persistence: store cart via `GET /store/carts/{cartId}` on page load using the `cartId` from localStorage (already present per audit)
- The Medusa cart ID persists in localStorage even after logout — on next login, call `POST /store/carts/{cartId}/customer` to re-associate the cart with the authenticated customer
- Test the full flow: add item to cart → log out → log in → verify cart is restored

**Warning signs:**
- `cart` array in Zustand store has no `persist` middleware
- No `GET /store/carts/{cartId}` call on app initialization

**Phase mapping:** Fix cart persistence before or simultaneously with the auth rebuild. Do not ship auth rebuild without cart recovery tested.

**Confidence:** HIGH — confirmed in audit; Medusa cart-customer association API is standard.

---

### Pitfall 14: Email OTP During Signup Creates a Race Condition UX Problem

**What goes wrong:** AUTH-02 requires phone OTP and AUTH-03 requires email OTP when email is provided. If both are sent simultaneously and the user must verify both before signup completes, you have a UI sequencing problem: which OTP input comes first? What if email delivery is slow (Resend transactional email can take 10–60 seconds)? The user verifies phone OTP immediately but is blocked waiting for email OTP to arrive.

**Why it happens:** Requirements are written as feature items, not user flows. The dual-OTP scenario is not modelled as a state machine.

**Consequences:** Users abandon signup waiting for the email OTP. Or the UI shows two OTP inputs simultaneously, which is confusing on a mobile screen.

**Prevention:**
- Implement as a two-step sequential flow: Step 1 — phone OTP (mandatory, blocks progression). Step 2 — email OTP (if email provided, shown after phone is verified). Email can be skipped with a "verify later" option.
- The account is created in Medusa after Step 1 (phone verified), with `email_verified: false`. Email verification upgrades the account but is not a blocker for shopping.
- This matches the AUTH-04 requirement: "Signup completes only after OTP is verified (phone OTP is mandatory)" — email OTP should be treated as an optional second step.

**Warning signs:**
- Signup backend route waits for both OTPs before creating the customer record
- Two OTP input fields visible simultaneously on the signup screen

**Phase mapping:** Explicitly model the signup state machine during Phase 1 design. Document: phone OTP gates account creation; email OTP gates email-verified status only.

**Confidence:** HIGH — UX pattern is clear; the requirement wording in PROJECT.md supports this interpretation.

---

### Pitfall 15: Input Validation Missing — Confirmed on All Backend Routes

**What goes wrong:** Confirmed in CONCERNS.md. All existing routes accept `req.body as any`. For the new auth routes, unvalidated input means: phone numbers that are not 10-digit Indian numbers can be submitted, passwords with no minimum length can be stored, and Redis keys can be constructed from unsanitised user input (e.g., `otp:{identifier}` where `identifier` is `../../../../etc/passwd`).

**Why it happens:** Validation is seen as a UX concern (show error messages) rather than a security concern (reject malformed input at the server boundary).

**Consequences:** Redis key injection. Empty password hashes stored. 500 errors surfaced to users instead of clean 400 validation errors. Eventual SQL injection risk if Medusa query parameters are constructed from raw input.

**Prevention:**
- Add Zod schemas to every new auth route before writing any business logic — validation is the first line in the handler, not an afterthought
- Phone number schema: `z.string().regex(/^[6-9]\d{9}$/)` — 10-digit Indian mobile number starting with 6-9
- Password schema: `z.string().min(8).max(128)` — 8 minimum, 128 maximum (bcrypt silently truncates inputs beyond 72 bytes; 128 char limit with explicit truncation check is safer)
- Sanitise the `identifier` field used to build Redis keys: only allow the phone regex or a verified email regex — reject anything else with 400

**Warning signs:**
- `req.body as any` in any new route file
- No `z.parse()` or `z.safeParse()` call near the top of a route handler
- Redis keys constructed with direct string interpolation: `otp:${req.body.phone}` without validation

**Phase mapping:** Establish the Zod validation pattern as a template in the first new auth route, then enforce it in code review for all subsequent routes.

**Confidence:** HIGH — confirmed gap in audit; Zod + Medusa v2 is the documented pattern.

---

### Pitfall 16: Password Reset Without Invalidating Existing Sessions

**What goes wrong:** A user resets their password via the forgot-password OTP flow. The new password is saved. But any existing `poshakh_token` cookies in other browser sessions (or on the attacker's browser, if the account was compromised) remain valid. The attacker who prompted the password reset continues to have a live session.

**Why it happens:** Password reset is implemented as "update the hash in the database" without touching sessions. The HMAC-signed cookie approach has no server-side session store to invalidate.

**Consequences:** Password reset does not actually evict an attacker from a compromised account. The legitimate user changes the password but the attacker's session stays alive for up to 7 days.

**Prevention:**
- Add a `session_version` field to the `customer_auth_credentials` table (integer, starts at 1, increments on every password change or explicit logout-all)
- Embed `session_version` in the signed cookie payload
- In `verifySignedCookie`, after HMAC validation and expiry check, fetch the current `session_version` for the customer from the database and compare — reject if cookie version is lower than current
- This adds one DB read per authenticated request — acceptable; cache it in a short-lived in-memory map if needed

**Warning signs:**
- Password reset route only updates `password_hash`, nothing else
- No `session_version` or equivalent revocation mechanism in the session schema

**Phase mapping:** Address in AUTH-07 (password reset) implementation. Must be designed before AUTH-05 (login) because the session schema must include `session_version` from the first token ever minted.

**Confidence:** HIGH on the security requirement; MEDIUM on the specific implementation (session_version vs alternative approaches like a token blocklist).

---

## Minor Pitfalls

These cause technical debt, maintenance friction, or edge-case bugs.

---

### Pitfall 17: Resend SDK Not Installed — Integration Will Be Rushed

**What goes wrong:** Confirmed in PROJECT.md. Resend is not installed. When AUTH-03 (email OTP) is implemented, developers install Resend under time pressure, write the integration directly in the route handler, and skip error handling. The email integration becomes a fragile inline implementation rather than a proper service module.

**Prevention:**
- Install Resend as the first action in the email OTP phase: `npm install resend`
- Create `backend/src/lib/email-provider.ts` as a wrapper before writing any route that sends email
- The wrapper should expose `sendOtpEmail(to: string, otp: string): Promise<{ success: boolean; error?: string }>` — error is handled inside, never thrown to callers
- Test with Resend's sandbox/test mode before wiring to live routes

**Phase mapping:** AUTH-03 implementation phase; install and wrap Resend before writing the route.

**Confidence:** HIGH — confirmed not installed; integration pattern is standard.

---

### Pitfall 18: bcrypt Silently Truncates Passwords Beyond 72 Bytes

**What goes wrong:** bcrypt has a hard limit of 72 bytes (not characters — bytes, so UTF-8 multi-byte characters count more). Passwords longer than 72 bytes are silently truncated. Two different passwords that share the same first 72 bytes are treated as identical. A user who sets a 100-character passphrase with a typo at byte 73 can still log in.

**Why it happens:** The 72-byte limit is not documented prominently. Developers testing with ASCII passwords never hit it.

**Prevention:**
- Enforce `z.string().max(72)` on the password field (conservative; prevents user from setting a password they cannot rely on)
- Or use the pre-hash pattern: `SHA-256(password)` → feed the 32-byte hash to bcrypt. This allows arbitrarily long passwords without truncation. Use `crypto.subtle.digest('SHA-256', ...)` with Web Crypto or Node.js `crypto.createHash('sha256')` in the backend (not middleware)
- For this project: `max(72)` in the Zod schema is the simpler and correct choice; document the limit clearly in the UI ("Maximum 72 characters")

**Phase mapping:** Zod schema definition phase, same as Pitfall 15.

**Confidence:** HIGH — bcrypt 72-byte limit is well-documented library behaviour.

---

### Pitfall 19: Twilio India Coverage Gaps for Specific Operators

**What goes wrong:** If the project switches from MSG91 to Twilio Verify for SMS OTP, Twilio routes through international carriers for Indian numbers. Delivery to BSNL and MTNL (government telecom operators) is unreliable via Twilio. DLT registration in India (required since 2021 for transactional SMS) adds a compliance step that Twilio handles differently from MSG91.

**Why it happens:** Twilio's global reputation leads developers to assume it "just works" in India. The TRAI DLT requirement is an India-specific regulatory layer that is often discovered post-integration.

**Prevention:**
- If switching to Twilio Verify: register for Twilio's India DLT sender ID separately. Twilio has a specific India DLT registration process in its dashboard.
- Test delivery to a BSNL number and a Jio number before going live — these are the two largest operators and represent different routing paths
- Alternative: Keep MSG91 for SMS (it is already DLT-registered) but fix the delivery confirmation parsing (Pitfall 11). MSG91's domestic routing is superior for Indian numbers. Twilio's advantage is programmatic delivery receipts and Verify API abstraction.
- Recommended decision: keep MSG91 with the provider abstraction layer, fix delivery parsing, and switch to Twilio only if MSG91 delivery rates drop below acceptable threshold in production monitoring

**Phase mapping:** SMS provider decision must be locked before the first new send-OTP route is written. The abstraction layer (Pitfall 11) makes the decision reversible.

**Confidence:** MEDIUM — India DLT and operator-level routing specifics are operational knowledge; may have changed since 2024.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| OTP verify route hardening (pre-auth rebuild) | Pitfall 3 (brute-force), Pitfall 4 (replay) | Fix both in a single atomic Redis refactor of `otp-store.ts` before new routes |
| DEV bypass removal | Pitfall 5 | Remove entirely; add startup assertion against the env var |
| Customer auth schema design | Pitfall 8 (Medusa migration) | Separate `customer_auth_credentials` table, MikroORM migration format only |
| Password route handlers | Pitfall 1 (bcrypt rounds), Pitfall 2 (timing), Pitfall 15 (validation), Pitfall 18 (72-byte) | All four are resolved by a single shared `AuthService` class with validated inputs and correct bcrypt calls |
| Session utility upgrade | Pitfall 6 (no server-side expiry), Pitfall 16 (no session revocation) | Add `exp` and `session_version` to payload in `session.ts` before any new token is minted |
| Next.js middleware | Pitfall 10 (Edge Runtime crypto) | Use Web Crypto API (`crypto.subtle`) or presence-only check in middleware |
| Send-OTP route (new) | Pitfall 9 (enumeration), Pitfall 11 (MSG91 parsing), Pitfall 19 (provider choice) | Always return 200; parse provider response; lock provider decision first |
| Forgot-password OTP | Pitfall 12 (SIM swap), Pitfall 9 (enumeration), Pitfall 16 (session revocation) | Prefer email channel when verified; shorter TTL; increment session_version on reset |
| Email OTP (signup) | Pitfall 14 (race condition), Pitfall 17 (Resend not installed) | Sequential flow; phone gates account creation; install Resend first |
| Auth cutover deploy | Pitfall 7 (session invalidation), Pitfall 13 (cart loss) | Backward-compatible token validation; fix cart persistence before deploy |
| Input validation (all routes) | Pitfall 15 (no validation) | Zod schema as first line of every handler; enforce in PR template |

---

## Sources

All findings are drawn from:
- Codebase audit: `C:\Users\Fuzlan\Claude Projects\poshakh2\.planning\codebase\CONCERNS.md` (2026-04-22)
- Project requirements: `C:\Users\Fuzlan\Claude Projects\poshakh2\.planning\PROJECT.md` (2026-04-22)
- OWASP Password Storage Cheat Sheet (bcrypt work factor 12+, constant-time comparison, enumeration prevention) — HIGH confidence, stable doctrine
- OWASP Multifactor Authentication Cheat Sheet (attempt limits, replay prevention, OTP TTL) — HIGH confidence
- Next.js Edge Runtime documentation (crypto.createHmac not available in Edge) — HIGH confidence, well-documented platform constraint
- bcrypt library documentation (72-byte truncation limit) — HIGH confidence, library-level specification
- India TRAI DLT SMS regulations (2021 requirement for transactional SMS sender registration) — MEDIUM confidence, regulatory details may have updated
- MSG91 API documentation (response body structure, type field) — MEDIUM confidence, confirmed from audit code pattern
- Medusa v2 Data Model API (separate table approach for custom fields) — MEDIUM confidence, recommend validation during implementation phase
