# STATE — Poshakh Auth System Rebuild

> Project memory. Updated at every phase transition and plan completion.
> Read this at the start of every session to restore context instantly.

---

## Project Reference

**Project:** Poshakh — Auth System Rebuild
**Core value:** Customers can discover, buy, and track Indian fashion products with a seamless phone-number-first checkout experience — from browse to paid order in under 2 minutes.
**Current milestone:** v1 Auth System (OTP-only → Password + OTP full account system)
**Stack:** Next.js 16 (frontend) + Medusa.js v2 (backend) + PostgreSQL + Redis + Razorpay

---

## Current Position

**Current phase:** Phase 0 — Security Hardening
**Current plan:** Not started
**Status:** Awaiting first plan (`/gsd-plan-phase 0`)
**Overall progress:** 0/6 phases complete

```
Phase 0 [Security Hardening]   [ ] Not started
Phase 1 [Auth Infrastructure]  [ ] Not started
Phase 2 [Backend Auth Routes]  [ ] Not started
Phase 3 [BFF + Session]        [ ] Not started
Phase 4 [Frontend Auth UI]     [ ] Not started
Phase 5 [Migration + Cutover]  [ ] Not started
```

**Progress bar:** ░░░░░░░░░░░░░░░░░░░░ 0%

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements defined | 27 |
| Requirements complete | 0 |
| Phases defined | 6 |
| Phases complete | 0 |
| Plans complete | 0 |
| Session started | 2026-04-22 |

---

## Accumulated Context

### Key Decisions (Confirmed)

| Decision | Rationale |
|----------|-----------|
| Replace OTP-only auth with password + OTP system | Standard signup/login/forgot-password UX; existing system has 3 critical vulnerabilities |
| Phone is primary identifier (not email) | India market norm; customer base is phone-first |
| Email is optional at signup | Reduces friction for first-time users |
| SMS OTP via Twilio Verify (replaces MSG91) | Unambiguous delivery status; built-in brute-force protection; MSG91 had silent failures |
| Email OTP via Resend SDK | 3k/month free; first-class TypeScript |
| Credentials in separate poshakh_auth table | Never pollute Medusa's managed customer table (migrations would overwrite) |
| argon2id for password hashing | OWASP first choice; avoids bcrypt 72-byte truncation; memory-hard |
| Keep HMAC HttpOnly cookie session | Architecturally sound; patch gaps (add exp, session_version) |
| middleware.ts uses crypto.subtle (Web Crypto API) | crypto.createHmac unavailable in Next.js Edge Runtime in production |
| Legacy user migration: lazy detection at login | No batch operation; zero downtime; prompt to set password on first login |
| Signup flow: OTP verify THEN create account | Prevents orphaned unverified records |
| Brute-force enforcement on Medusa backend | BFF can be bypassed; backend is authoritative |
| Phase 0 before all new code | 3 confirmed critical vulnerabilities must be fixed before building on this foundation |

### Known Constraints

- No framework changes: Next.js 16 + Medusa.js v2 are fixed
- Razorpay checkout flow must not break during auth rebuild
- TypeScript everywhere — no plain .js files in new code
- Free tier first: Twilio trial, Resend 3k/month, Neon/Supabase PostgreSQL
- Indian phone validation: `^[6-9]\d{9}$` (10-digit, starts 6–9)

### Active Blockers

None at roadmap creation. Check research flags before Phase 1 begins:
- Twilio India DLT registration status (5–10 business day lead time)
- Resend domain DNS verification for poshakh.in
- Medusa v2.13.x custom table migration syntax
- argon2 native binary support on production server

### Technical Debt / Risks

| Item | Risk | Mitigation |
|------|------|-----------|
| OTP verify has no brute-force protection (CONFIRMED) | Critical — 1M combinations attackable in 10-min window | Phase 0 SEC-01 |
| DEV bypass has no production guard (CONFIRMED) | Critical — account takeover possible | Phase 0 SEC-02 |
| Session cookie has no expiry (CONFIRMED) | High — stolen token valid indefinitely | Phase 0 SEC-03 |
| MSG91 unreliable (silent delivery failures) | Medium — OTP non-delivery breaks signup | Phase 1 INF-04 |
| No Next.js middleware for route protection | Low-Medium — page flash before redirect | Phase 3 BFF-03 |
| argon2 requires native binaries | Low — must verify on production server | Before Phase 1 |
| Twilio India DLT registration | Medium — 5–10 day lead time if not done | Start immediately |

---

## Session Continuity

### Completed Sessions

| Date | Work Done |
|------|-----------|
| 2026-04-22 | Project initialized: PROJECT.md, REQUIREMENTS.md, research/SUMMARY.md, ROADMAP.md, STATE.md |

### Next Action

Run `/gsd-plan-phase 0` to break Phase 0 (Security Hardening) into atomic executable tasks.

Phase 0 scope: SEC-01 (OTP lockout), SEC-02 (DEV bypass removal), SEC-03 (session expiry), SEC-04 (Zod validation on existing routes).

---

## Phase Completion Log

*(Entries added here as phases complete via `/gsd-progress`)*

---

*Created: 2026-04-22 | Last updated: 2026-04-22*
