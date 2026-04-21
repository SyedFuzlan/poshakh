# ROADMAP — Poshakh Auth System Rebuild

**Project:** Poshakh — Auth System Rebuild (OTP-only → Password + OTP)
**Milestone:** v1 Auth System
**Granularity:** Standard
**Created:** 2026-04-22
**Coverage:** 23/23 requirements mapped

---

## Phases

- [ ] **Phase 0: Security Hardening** — Patch 3 confirmed critical vulnerabilities before any new code ships
- [ ] **Phase 1: Auth Infrastructure** — Lay the backend foundation: database table, password utility, OTP store, SMS provider
- [ ] **Phase 2: Backend Auth Routes** — Implement all 5 new Medusa backend routes with Zod validation and dual OTP delivery
- [ ] **Phase 3: BFF + Session Upgrade** — Wire Next.js proxy routes, upgrade session payload, add Edge-compatible middleware
- [ ] **Phase 4: Frontend Auth UI** — Build all auth screens (signup, OTP, login, forgot-password, reset-password) with proper UX
- [ ] **Phase 5: Migration + Cutover** — Handle legacy users, fix cart persistence, ensure backward-compatible session tokens

---

## Phase Details

### Phase 0: Security Hardening
**Goal**: The existing auth system has no critical vulnerabilities before new code is added
**Depends on**: Nothing (prerequisite hardening — must run first)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Calling POST /store/auth/verify-otp with 5 wrong OTPs within the TTL window returns a 429 lockout response and further attempts are blocked until TTL expires
  2. The server refuses to start (throws on boot) if DEV_TEST_PHONE or DEV_TEST_OTP env vars are present in a NODE_ENV=production environment; neither variable exists in any BFF route code
  3. A session cookie issued today is rejected after 7 days without re-authentication — verifySignedCookie returns null for expired tokens
  4. Sending a malformed body (missing required fields, wrong types) to POST /store/auth/send-otp or /store/auth/verify-otp returns a 400 with a structured Zod error response, not a 500
**Plans**: TBD
**UI hint**: no

### Phase 1: Auth Infrastructure
**Goal**: The backend has a dedicated credentials table, a production-grade password utility, a purpose-scoped OTP store, and Twilio Verify wired in place of MSG91
**Depends on**: Phase 0
**Requirements**: INF-01, INF-02, INF-03, INF-04
**Success Criteria** (what must be TRUE):
  1. Running the migration script creates a poshakh_auth table with columns phone (UNIQUE), password_hash, password_set, session_version, created_at, updated_at — verifiable via `\d poshakh_auth` in psql
  2. Calling hashPassword() produces an argon2id hash and verifyPassword() returns true for the correct password and false for a wrong one; the hash string starts with `$argon2id$`
  3. OTP keys in Redis follow the pattern `otp:{purpose}:{phone}` (e.g., `otp:signup:9876543210`); a failed verify increments the attempt counter atomically; a successful verify deletes the key atomically
  4. Triggering an OTP send sends the SMS via Twilio Verify (confirmed via Twilio console log or delivery status); MSG91 has zero remaining references in the codebase (`grep -r "msg91" .` returns nothing)
**Plans**: TBD
**UI hint**: no

### Phase 2: Backend Auth Routes
**Goal**: All 5 new Medusa backend auth routes are live, validated, and deliver OTP via the correct channel for each scenario
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. POST /store/auth/signup with valid name, phone, and password returns 200 and an SMS OTP is delivered to the phone via Twilio Verify; a pending state is stored in Redis (no poshakh_auth row yet)
  2. POST /store/auth/verify-signup with the correct OTP creates a poshakh_auth row and a Medusa customer record atomically; with a wrong OTP it returns 400 and no records are created
  3. When email was provided at signup, POST /store/auth/verify-signup also triggers a Resend email OTP to that address (non-blocking — the account is created regardless of email OTP delivery)
  4. POST /store/auth/login with correct phone + password returns 200 with a session payload; after 10 failed attempts in 15 minutes it returns 429
  5. POST /store/auth/forgot-password sends a 6-digit SMS OTP with 5-minute TTL; POST /store/auth/reset-password with that OTP and a new password updates the password_hash in poshakh_auth
  6. Sending invalid bodies (missing fields, wrong types, phone not matching ^[6-9]\d{9}$, password under 8 chars) to any of the 5 routes returns 400 with a structured error code, not a 500
**Plans**: TBD
**UI hint**: no

### Phase 3: BFF + Session Upgrade
**Goal**: The Next.js frontend can securely proxy all auth calls, sessions include expiry and version data, and protected routes redirect unauthenticated users without a flash
**Depends on**: Phase 2
**Requirements**: BFF-01, BFF-02, BFF-03
**Success Criteria** (what must be TRUE):
  1. All 5 BFF proxy routes exist at frontend/src/app/api/auth/ (signup, verify-signup, login, forgot-password, reset-password); the poshakh_token cookie is set only by verify-signup and login BFF routes, and cleared only by the logout route
  2. A session token issued after this phase includes exp, iat, session_version, and passwordSet fields; verifySignedCookie rejects tokens missing exp or with exp in the past
  3. Navigating directly to /account, /checkout, or /orders without a valid session cookie redirects to /login immediately with no content flash; authenticated users are not redirected
**Plans**: TBD
**UI hint**: yes

### Phase 4: Frontend Auth UI
**Goal**: A user can complete the full signup, login, and password-recovery flows entirely through the UI with clear feedback at every step
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. The signup form collects full name, phone number (required), password (required with live strength meter), and email (optional with clear "optional" label); submitting with invalid data shows inline field errors before any network call
  2. After signup submission, a 6-digit OTP input screen appears with auto-submit on the 6th digit, a 60-second resend countdown, and an attempt counter ("3 attempts remaining"); entering the wrong code shows the remaining attempts without page reload
  3. The login form accepts phone + password and shows scenario-specific errors: "This number isn't registered — sign up instead" (with link), "Incorrect password — forgot your password?" (with link), and "Account locked — try again in 15 minutes"
  4. The forgot-password flow shows the phone input form, then reuses the OTP screen, then shows the reset-password form with password + confirm-password fields and a strength meter; success redirects to /login with a confirmation message
  5. Every auth screen is usable at 375px width without horizontal scrolling and all interactive elements meet WCAG 2.1 AA minimum touch-target size
**Plans**: TBD
**UI hint**: yes

### Phase 5: Migration + Cutover
**Goal**: Existing customers are not locked out, cart state survives authentication changes, and old session tokens are not suddenly invalidated
**Depends on**: Phase 4
**Requirements**: MIG-01, MIG-02, MIG-03
**Success Criteria** (what must be TRUE):
  1. A phone number with an existing Medusa customer record but no poshakh_auth row receives a { status: "legacy_user" } response on login; the frontend shows "Welcome back! Please set a password to continue" and routes to the forgot-password flow
  2. On page load, if poshakh_cart_id is present in localStorage, cart items are fetched from GET /store/carts/{cartId} and repopulated in Zustand state — cart is not lost after authentication
  3. A session token issued by the old auth system (no exp field) is accepted and silently re-issued with the new payload shape on the next authenticated request; it is not rejected with a 401
**Plans**: TBD
**UI hint**: no

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Security Hardening | 0/? | Not started | - |
| 1. Auth Infrastructure | 0/? | Not started | - |
| 2. Backend Auth Routes | 0/? | Not started | - |
| 3. BFF + Session Upgrade | 0/? | Not started | - |
| 4. Frontend Auth UI | 0/? | Not started | - |
| 5. Migration + Cutover | 0/? | Not started | - |

---

## Coverage Map

| REQ-ID | Phase | Requirement Summary |
|--------|-------|---------------------|
| SEC-01 | 0 | OTP verify brute-force lockout (5 attempts → Redis lockout) |
| SEC-02 | 0 | Remove DEV_TEST_PHONE / DEV_TEST_OTP bypass; startup assertion |
| SEC-03 | 0 | Session HMAC cookie includes exp; verifySignedCookie validates expiry |
| SEC-04 | 0 | Zod validation on existing send-otp and verify-otp route bodies |
| INF-01 | 1 | poshakh_auth table migration script |
| INF-02 | 1 | argon2id password utility (hash + verify) |
| INF-03 | 1 | Purpose-scoped OTP store keys + atomic attempt counters |
| INF-04 | 1 | Twilio Verify SDK replaces MSG91 entirely |
| AUTH-01 | 2 | POST /store/auth/signup — accepts name, phone, password, email; sends SMS OTP |
| AUTH-02 | 2 | POST /store/auth/verify-signup — verifies OTP; creates poshakh_auth + Medusa customer |
| AUTH-03 | 2 | Email OTP via Resend after phone OTP verified (non-blocking) |
| AUTH-04 | 2 | POST /store/auth/login — phone + argon2id password verify; rate-limited |
| AUTH-05 | 2 | POST /store/auth/forgot-password — sends 6-digit SMS OTP, 5-min TTL |
| AUTH-06 | 2 | POST /store/auth/reset-password — verifies OTP + hashes new password |
| AUTH-07 | 2 | Zod validation on all 5 new backend routes; structured error codes |
| BFF-01 | 3 | 5 Next.js BFF proxy routes; cookie set/clear only in verify-signup + login |
| BFF-02 | 3 | session.ts upgraded with exp, iat, session_version, passwordSet fields |
| BFF-03 | 3 | middleware.ts protecting /account, /checkout, /orders via crypto.subtle |
| UI-01 | 4 | Signup form with strength meter and inline validation |
| UI-02 | 4 | OTP confirmation screen with auto-submit, resend countdown, attempt counter |
| UI-03 | 4 | Login form with scenario-specific error messages |
| UI-04 | 4 | Forgot-password form (reuses OTP component) |
| UI-05 | 4 | Reset-password form with strength meter; redirects to login on success |
| UI-06 | 4 | All auth screens show specific, actionable error messages with direct links |
| MIG-01 | 5 | Legacy user detection at login; prompt to set password via forgot-password flow |
| MIG-02 | 5 | Cart persistence: re-fetch and repopulate Zustand from localStorage cartId on load |
| MIG-03 | 5 | Backward-compatible session: old tokens silently re-issued with new payload shape |

**Total: 27 requirements — wait, recount from REQUIREMENTS.md**

Confirmed: SEC-01 through SEC-04 (4) + INF-01 through INF-04 (4) + AUTH-01 through AUTH-07 (7) + BFF-01 through BFF-03 (3) + UI-01 through UI-06 (6) + MIG-01 through MIG-03 (3) = **27 requirements mapped, 27/27 covered.**

---

## Research Flags (Action Required Before Implementation)

These were raised by research and must be resolved before the relevant phase begins:

| Flag | Phase | Action |
|------|-------|--------|
| Twilio India DLT registration | Before Phase 1 | Verify DLT registration status; 5–10 business day lead time if not done |
| Resend domain DNS | Before Phase 2 | Confirm poshakh.in domain is verified in Resend dashboard |
| Medusa v2.13.x migration syntax | Before Phase 1 | Check docs.medusajs.com for exact custom table migration syntax |
| argon2 native binaries | Before Phase 1 | Confirm Python + make + gcc available on production server |

---

*Created: 2026-04-22 | Last updated: 2026-04-22*
