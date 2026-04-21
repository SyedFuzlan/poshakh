# Requirements — Poshakh Auth System Rebuild

**Version:** v1
**Created:** 2026-04-22
**Scope:** Replace OTP-only auth with full account system (signup + password login + forgot-password)

---

## v1 Requirements

### Security Hardening (Phase 0)

- [ ] **SEC-01** — OTP verify endpoint locks out after 5 failed attempts (Redis attempt counter + TTL-based lockout)
- [ ] **SEC-02** — `DEV_TEST_PHONE` / `DEV_TEST_OTP` bypass is removed from all frontend BFF routes; startup assertion throws if env var is present in production
- [ ] **SEC-03** — Session HMAC cookie payload includes `exp` (7-day expiry timestamp); `verifySignedCookie` validates expiry server-side and rejects expired tokens
- [ ] **SEC-04** — All existing backend auth route bodies are validated with Zod schemas (send-otp, verify-otp)

### Infrastructure (Phase 1)

- [ ] **INF-01** — `poshakh_auth` database table exists (phone UNIQUE, password_hash, password_set, session_version, timestamps) via a standalone migration script
- [ ] **INF-02** — `password.ts` backend utility wraps argon2id hash and verify with OWASP-recommended parameters (memoryCost: 65536, timeCost: 3, parallelism: 4)
- [ ] **INF-03** — `otp-store.ts` extended with purpose-scoped keys (`otp:{purpose}:{phone}`) and attempt counters; atomic compare-and-delete on verify success
- [ ] **INF-04** — Twilio Verify SDK replaces MSG91 for all SMS OTP delivery; MSG91 code removed

### Backend Auth Routes (Phase 2)

- [ ] **AUTH-01** — User can sign up: `POST /store/auth/signup` accepts name (required), phone (required, 10-digit starts 6–9), password (required, 8–72 chars), email (optional); sends SMS OTP to phone via Twilio Verify
- [ ] **AUTH-02** — User can verify signup OTP: `POST /store/auth/verify-signup` validates phone + OTP; only on success creates `poshakh_auth` row and Medusa customer record
- [ ] **AUTH-03** — If email was provided at signup, an email OTP is sent via Resend after phone OTP verification (non-blocking — phone OTP gates account creation)
- [ ] **AUTH-04** — User can log in: `POST /store/auth/login` accepts phone + password; verifies against `poshakh_auth` password_hash with argon2id; rate-limited to 10 attempts per 15-minute window
- [ ] **AUTH-05** — User can request password reset: `POST /store/auth/forgot-password` accepts phone; sends 6-digit SMS OTP via Twilio Verify with 5-minute TTL
- [ ] **AUTH-06** — User can reset password: `POST /store/auth/reset-password` accepts phone + OTP + new password; verifies OTP, hashes new password, updates `poshakh_auth` row
- [ ] **AUTH-07** — All 5 new backend routes validate request bodies with Zod schemas and return structured error codes (not generic messages)

### BFF Routes + Session (Phase 3)

- [ ] **BFF-01** — 5 Next.js BFF proxy routes created for signup, verify-signup, login, forgot-password, reset-password; cookie is set/cleared only in verify-signup and login BFF routes
- [ ] **BFF-02** — `session.ts` upgraded: HMAC payload includes `exp`, `iat`, `session_version`, `passwordSet`; `verifySignedCookie` validates all fields
- [ ] **BFF-03** — `middleware.ts` created at `frontend/src/middleware.ts` protecting `/account`, `/checkout`, and `/orders` routes; uses `crypto.subtle` (Web Crypto API, Edge Runtime compatible)

### Frontend UI (Phase 4)

- [ ] **UI-01** — Signup form: full name, phone number, password (required) + email (optional); real-time password strength meter; inline validation
- [ ] **UI-02** — OTP confirmation screen: 6-digit input with `inputMode="numeric"`, auto-submit on 6th digit, 60-second resend countdown timer, attempt counter display ("3 attempts remaining")
- [ ] **UI-03** — Login form: phone number + password; "Forgot password?" link; specific error messages per scenario (wrong password, number not registered, account locked)
- [ ] **UI-04** — Forgot-password form: phone number input → OTP confirmation screen (reuses OTP component)
- [ ] **UI-05** — Reset-password form: new password + confirm password fields with strength meter; redirects to login on success
- [ ] **UI-06** — All auth screens show specific, actionable error messages (e.g., "This number isn't registered — sign up instead" with a direct link)

### Legacy User Migration (Phase 5)

- [ ] **MIG-01** — Login detects legacy user (Medusa customer exists but no `poshakh_auth` row) and returns `{ status: "legacy_user" }` response; frontend shows "Welcome back! Please set a password to continue" and routes to forgot-password flow
- [ ] **MIG-02** — Cart persistence fixed: on app load, if `poshakh_cart_id` exists in localStorage, cart items are re-fetched from `GET /store/carts/{cartId}` and repopulated in Zustand
- [ ] **MIG-03** — Session token backward compatibility: old tokens (without `exp` field) are accepted and silently re-issued with the new payload shape on the next request; not rejected

---

## v2 Requirements (Deferred)

- Web OTP API auto-read on Android Chrome (`navigator.credentials.get`)
- Guest-to-authenticated cart merge via Medusa cart transfer API
- Order confirmation email via Resend after successful checkout
- Next.js route middleware for `/orders` page (depends on orders page existing)
- Account deletion flow (DPDP Act compliance)

---

## Out of Scope

- Social login (Google, Apple, Facebook) — not requested; future milestone
- Email as primary login identifier — phone is the identifier; email is supplementary only
- Username-based login — phone number is the identifier
- Admin panel auth — Medusa built-in admin auth is sufficient
- i18n / multi-language — hardcoded English for v1

---

## Traceability

| REQ-ID | Phase | Status | Requirement summary |
|--------|-------|--------|---------------------|
| SEC-01 | 0 | Pending | OTP verify brute-force lockout |
| SEC-02 | 0 | Pending | Remove DEV bypass |
| SEC-03 | 0 | Pending | Session expiry enforcement |
| SEC-04 | 0 | Pending | Zod validation on existing routes |
| INF-01 | 1 | Pending | poshakh_auth table migration |
| INF-02 | 1 | Pending | argon2id password utility |
| INF-03 | 1 | Pending | Extended otp-store |
| INF-04 | 1 | Pending | Twilio Verify replaces MSG91 |
| AUTH-01 | 2 | Pending | Signup backend route |
| AUTH-02 | 2 | Pending | Verify-signup backend route |
| AUTH-03 | 2 | Pending | Email OTP via Resend |
| AUTH-04 | 2 | Pending | Login backend route |
| AUTH-05 | 2 | Pending | Forgot-password backend route |
| AUTH-06 | 2 | Pending | Reset-password backend route |
| AUTH-07 | 2 | Pending | Zod validation on all new routes |
| BFF-01 | 3 | Pending | BFF proxy routes |
| BFF-02 | 3 | Pending | Session payload upgrade |
| BFF-03 | 3 | Pending | Next.js middleware route protection |
| UI-01 | 4 | Pending | Signup form |
| UI-02 | 4 | Pending | OTP confirmation screen |
| UI-03 | 4 | Pending | Login form |
| UI-04 | 4 | Pending | Forgot-password form |
| UI-05 | 4 | Pending | Reset-password form |
| UI-06 | 4 | Pending | Error messages |
| MIG-01 | 5 | Pending | Legacy user detection + prompt |
| MIG-02 | 5 | Pending | Cart persistence fix |
| MIG-03 | 5 | Pending | Backward-compatible session tokens |

**Coverage: 27/27 requirements mapped — 0/27 complete**

---

*Created: 2026-04-22 | Traceability confirmed: 2026-04-22*
