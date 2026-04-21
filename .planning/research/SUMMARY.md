# Project Research Summary

**Project:** Poshakh — Auth System Rebuild (OTP-only to Password + OTP)
**Domain:** Phone-number-first authentication for Indian fashion e-commerce (Medusa v2 + Next.js 16)
**Researched:** 2026-04-22
**Confidence:** HIGH on security fundamentals and architecture; MEDIUM on Medusa v2 extension specifics and SMS provider choice

---

## Executive Summary

Poshakh's authentication system requires a full rebuild from its current OTP-only flow to a complete phone-number-first account system with password login, forgot-password recovery, and optional email OTP. The existing implementation has three confirmed critical vulnerabilities that must be patched before any new auth features are built: an OTP verify endpoint with no brute-force protection, a DEV bypass with no production guard, and HMAC session cookies with no server-side expiry timestamp.

Keep the HMAC HttpOnly cookie session (architecturally sound), replace MSG91 with Twilio Verify SDK, use argon2id for password hashing, deliver email OTP via Resend SDK, extend the existing ioredis rate-limiting pattern, and store credentials in a separate `poshakh_auth` table.

---

## Recommended Stack

| Need | Choice | Reason |
|------|--------|--------|
| SMS OTP | Twilio Verify (`twilio@^5`) | Unambiguous delivery status; built-in brute-force protection; replaces MSG91 silent failures |
| Password hashing | argon2id (`argon2@^0.41`) | OWASP first choice; avoids bcrypt 72-byte truncation; memory-hard |
| Email OTP | Resend SDK (`resend@^4`) | 3k/month free; first-class TypeScript; already planned |
| Rate limiting | ioredis (extend existing) | Already installed; purpose-scoped keys + attempt counters |
| Credentials store | Separate `poshakh_auth` table | Never pollute Medusa's managed `customer` table |
| Session | Keep HMAC HttpOnly cookie | Add `exp` + `session_version` to payload; no JWT needed |

---

## Table Stakes Features (Must Ship)

**Security (Phase 0 — before anything else):**
- OTP brute-force protection: 5-attempt limit + Redis lockout on verify endpoint
- Remove `DEV_TEST_PHONE` bypass entirely (startup assertion if env var exists)
- Add `exp` timestamp to session payload; validate in `verifySignedCookie`
- Zod validation on all auth route bodies

**Auth flows (Phase 1–4):**
- Signup: name + phone (required) + email (optional) + password
- Indian phone validation: 10-digit, starts 6–9 (`^[6-9]\d{9}$`)
- SMS OTP: 6-digit, 10-min TTL, auto-submit on 6th digit, 60-sec resend cooldown
- Password login: phone + password, 10-attempt / 15-min lockout
- Password constraints: 8–72 chars (argon2 byte limit enforced in Zod)
- Forgot-password via SMS OTP (5-min TTL — stricter)
- Next.js `middleware.ts` protecting `/account`, `/checkout`, `/orders`
- Per-scenario error messages (specific, not generic "invalid credentials")

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Credentials storage | Separate `poshakh_auth` table | Medusa migrations would overwrite columns added to `customer` |
| Signup flow order | OTP verify → THEN create account | Prevents orphaned unverified records |
| Password hashing location | Medusa backend only | BFF never processes plaintext password |
| Session token | Upgrade HMAC cookie (add `exp`, `session_version`) | Keep working pattern; patch known gaps |
| middleware.ts crypto | `crypto.subtle` (Web Crypto API) | `crypto.createHmac` not available in Next.js Edge Runtime |
| Legacy user migration | Lazy (detect at login, prompt to set password) | No batch operation; zero downtime |
| Brute-force enforcement | Medusa backend (not BFF) | BFF can be bypassed; backend is authoritative |

**Signup data flow:**
```
Browser → BFF → Medusa: hash password → store pending state in Redis →
send SMS OTP → user enters OTP → Medusa: verify OTP → INSERT poshakh_auth +
CREATE Medusa customer → BFF: set HMAC cookie → browser
```

---

## Top 5 Pitfalls

1. **OTP brute-force (confirmed present)** — 1M combinations in 10-min window; fix: Redis INCR attempt counter, atomic DEL on lockout. Phase 0.
2. **DEV bypass in production (confirmed present)** — `DEV_TEST_PHONE` with no NODE_ENV guard = account takeover; fix: remove code entirely. Phase 0.
3. **Session without expiry (confirmed present)** — stolen token valid indefinitely; fix: add `exp` + `session_version` to payload. Phase 0.
4. **Medusa schema contamination** — `ALTER TABLE customer ADD COLUMN` gets overwritten by Medusa migrations; fix: always use a separate table. Phase 1.
5. **Edge Runtime crypto failure** — `crypto.createHmac` works in dev (polyfilled) but throws in production Edge; fix: use `crypto.subtle` in `middleware.ts`. Phase 3.

---

## Suggested Build Order

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| 0 | Security hardening | Fix 3 confirmed critical vulnerabilities before new code |
| 1 | Infrastructure | `poshakh_auth` table, `password.ts`, extended `otp-store.ts`, Twilio Verify |
| 2 | Backend routes | 5 Medusa routes (signup, verify, login, forgot, reset) + Resend email OTP |
| 3 | BFF + session | 5 proxy routes, upgraded `session.ts`, `middleware.ts` with Web Crypto |
| 4 | Frontend UI | Signup, OTP, login, forgot-password, reset-password forms |
| 5 | Migration + cutover | Legacy user handling, cart persistence fix, backward-compat session |
| 6 | Hardening | IP rate limits, structured logging, production deployment checks |

---

## Research Flags (Verify at Implementation Start)

- **Twilio India DLT registration** — 5–10 business day lead time; start immediately if not done
- **Resend domain DNS** — verify `poshakh.in` domain access before email OTP routes
- **Medusa v2.13.x migration syntax** — check `docs.medusajs.com` for exact custom table syntax
- **argon2 native binaries** — confirm Python + make + gcc on production server

---

*Research completed: 2026-04-22 | Ready for roadmap: yes*
