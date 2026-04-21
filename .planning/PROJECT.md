# Poshakh

## What This Is

Poshakh is an Indian fashion e-commerce platform selling sarees and apparel. It is built on a headless Next.js 16 + Medusa.js v2 stack, targeting Indian customers with INR pricing and Razorpay payments. The platform is ~50% complete with core shopping and checkout flows built; the current work focuses on replacing the existing OTP-only auth system with a full account system (signup with password + OTP confirmation, password-based login, forgot-password reset via OTP).

## Core Value

Customers can discover, buy, and track Indian fashion products with a seamless phone-number-first checkout experience — from browse to paid order in under 2 minutes.

## Requirements

### Validated

<!-- Existing working functionality inferred from codebase map. -->

- ✓ Product listing with category filtering — existing
- ✓ Product detail pages (server-side fetched) — existing
- ✓ Cart (add / update / remove items, synced to Medusa) — existing
- ✓ Checkout flow: address → shipping method → Razorpay payment — existing
- ✓ Razorpay payment order creation + HMAC signature verification — existing
- ✓ Order confirmation page — existing
- ✓ Medusa backend: products, carts, orders, regions (India/INR) seeded — existing
- ✓ Redis-backed OTP store with 10-min TTL and 60-sec rate limit — existing
- ✓ Custom Medusa backend routes: OTP send/verify, checkout create/verify/complete — existing

### Active

<!-- New auth system replacing the current OTP-only flow. -->

- [ ] **AUTH-01** — User can sign up with full name, phone number (required), email (optional), and password
- [ ] **AUTH-02** — On signup, user receives an SMS OTP to their phone for account confirmation
- [ ] **AUTH-03** — If email is provided at signup, user also receives an email OTP to confirm the email
- [ ] **AUTH-04** — Signup completes only after OTP is verified (phone OTP is mandatory)
- [ ] **AUTH-05** — Existing user can log in with phone number + password
- [ ] **AUTH-06** — User who forgets password can request an SMS OTP to their registered phone
- [ ] **AUTH-07** — User can reset their password after verifying the forgot-password OTP
- [ ] **AUTH-08** — Existing OTP-only auth system is fully replaced (no regression on cart/checkout/session)

### Out of Scope

- Social login (Google, Apple, Facebook) — not requested; can add later
- Email-as-primary-login — phone is the primary identifier; email is supplementary
- Username-based login — phone number is the identifier
- Guest checkout with real email capture — separate concern, existing flow unchanged for now
- Admin panel auth — Medusa built-in admin auth is sufficient

## Context

- The existing auth system is a custom phone OTP flow: enter phone → receive MSG91 SMS OTP → verify → signed HMAC cookie session. There is no password, no email field, no signup form with name.
- MSG91 is already integrated for SMS OTP but flagged as unreliable (no delivery confirmation, no retry, raw HTTP). Evaluate keeping MSG91 or switching to Twilio Verify during implementation.
- Resend SDK is not yet installed — needed for email OTP on signup.
- The OTP verify endpoint has no brute-force protection (critical concern from audit) — must be addressed as part of this auth rebuild.
- The dev bypass (`DEV_TEST_PHONE` / `DEV_TEST_OTP`) exists in frontend BFF routes — must be guarded with `NODE_ENV !== "production"` check.
- Session is stored as HMAC-signed HttpOnly cookie (`poshakh_token`) — this pattern is sound and should be kept.
- Frontend has no `middleware.ts` for route protection — account/checkout pages flash before redirect.

## Constraints

- **Tech stack**: Next.js 16 + Medusa.js v2 — no framework changes
- **Payments**: Razorpay INR — checkout flow must not break during auth rebuild
- **SMS OTP**: Phone number is primary; MSG91 is current provider (may switch to Twilio)
- **Email OTP**: Resend free tier (3,000/month) — install and wire up
- **Free tier first**: All new services must have a free tier suitable for development stage
- **TypeScript everywhere**: No plain `.js` files in new code

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Replace OTP-only auth with password + OTP system | User requested standard signup/login/forgot-password UX | — Pending |
| Phone is primary identifier (not email) | User's customer base is phone-first; India market norm | — Pending |
| Email is optional at signup | Reduces friction for first-time users | — Pending |
| SMS OTP for phone, Email OTP for email (dual channel) | OTP channel matches the identifier provided | — Pending |
| Keep HMAC-signed HttpOnly cookie session | Existing pattern is sound; no third-party auth provider needed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-22 after initialization*
