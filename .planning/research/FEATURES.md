# Feature Landscape: Phone-Number-First Auth for Indian E-Commerce

**Domain:** Phone-number-first authentication — signup, OTP confirmation, password login, forgot-password via SMS OTP
**Project:** Poshakh (sarees / Indian fashion e-commerce, Medusa v2 + Next.js 16)
**Researched:** 2026-04-22
**Confidence:** HIGH — grounded in OWASP auth standards (stable), Indian market platform observation (Flipkart, Myntra, Meesho, Ajio, Nykaa), and direct project audit findings from CONCERNS.md

---

## Table Stakes

Features users expect from any auth system. Absence makes the product feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Signup form: name + phone + optional email + password | Minimum viable account creation; phone-first is Indian norm | Low | Email must be truly optional — no validation failure if blank |
| Indian phone number format validation (10-digit, +91 prefix) | Prevents garbage data; users expect instant format feedback | Low | Regex: `^[6-9]\d{9}$` (Indian mobile numbers start with 6–9) |
| OTP sent to phone on signup | Required for phone ownership proof; industry baseline | Low | Already implemented via MSG91; replace/harden during rebuild |
| OTP input: 6-digit numeric field, auto-advance | Standard UX; deviating from it causes confusion | Low | Single input or 6 individual boxes — both acceptable |
| OTP expiry (10 min) with clear countdown | Users need to know how long they have | Low | Existing Redis TTL is 10 min — surface it in UI |
| Resend OTP with cooldown (60 sec) | Prevents spam; users always need a retry path | Low | Existing 60-sec rate limit on send — surface as countdown |
| OTP brute-force protection (max 5 attempts, then lockout) | Security baseline; currently missing (CRITICAL concern) | Medium | Lock OTP in Redis after 5 wrong attempts; return 429 |
| Password login: phone + password | Standard returning-user flow | Low | New flow — phone is identifier, not email |
| Password strength enforcement (min 8 chars, mixed case or digit) | Prevents weak passwords; OWASP minimum | Low | Enforce server-side (Zod) AND client-side (visual meter) |
| Password confirmation field on signup | Prevents typo-locked accounts | Low | Client-side match check before submit |
| Forgot password: enter phone → receive OTP → set new password | Recovery path is non-negotiable | Medium | New flow — reuses OTP infrastructure |
| Show/hide password toggle | Universal UX expectation | Low | Single eye-icon toggle on password field |
| Clear, specific error messages per scenario | Vague errors cause support tickets and drop-off | Low | See edge case table below |
| Session persistence across page refresh | Users expect to stay logged in | Low | Cookie is already 7-day HttpOnly — must survive refresh |
| Logout that clears session completely | Security and privacy baseline | Low | Clear cookie + invalidate Medusa customer session |
| Rate limiting on all auth endpoints | Prevents enumeration and spam | Medium | Send OTP already has 60-sec limit; verify OTP has none — add it |
| Backend input validation on all auth routes | Currently absent (HIGH concern) — prevents injection | Medium | Zod schemas on every route; already missing per CONCERNS.md |
| DEV bypass guard (`NODE_ENV !== 'production'`) | Security — currently a HIGH-severity risk | Low | One-line guard; documented as must-have in CONCERNS.md |
| Session expiry timestamp in signed cookie | Prevents stolen-token replay attacks | Low | Add `expiresAt` to HMAC payload; validate in `verifySignedCookie` |
| Next.js middleware route protection | Stops auth-page flash for unauthenticated users | Medium | `middleware.ts` inspecting `poshakh_token` cookie |

---

## Edge Cases That Must Be Handled

Every one of these will happen in production. Missing any one causes user-visible failures.

| Scenario | Required Behaviour | Complexity |
|----------|--------------------|------------|
| Phone number already registered (duplicate signup) | Return specific error: "This number is already registered. Log in instead." — include login CTA | Low |
| Wrong OTP entered | Show attempt count remaining: "Incorrect OTP. 3 attempts left." | Low |
| OTP expired (past 10-min TTL) | Clear message: "OTP has expired. Request a new one." — show Resend button | Low |
| OTP locked after 5 failed attempts | "Too many incorrect attempts. Request a new OTP." — existing OTP is invalidated | Medium |
| OTP resend requested within 60-sec cooldown | Disable resend button with live countdown timer: "Resend in 42s" | Low |
| Forgot password: unregistered phone entered | Neutral message: "If this number is registered, an OTP will be sent." — prevents enumeration | Low |
| SMS OTP not received (delivery failure) | User-visible retry path + fallback message "Didn't receive it? Resend OTP" | Low |
| Password reset OTP expired or already used | "This link/OTP has expired. Request a new one." | Low |
| Optional email: invalid format if provided | Validate only when field is non-empty | Low |
| User enters email already linked to another account | "This email is already in use on another account." | Low |
| Password too weak at submit | Inline error with specific rule that failed | Low |
| Password confirmation mismatch | Real-time inline error "Passwords do not match" | Low |
| Network failure during OTP send | Error state with retry option — no silent failure | Low |
| Session cookie tampered / invalid HMAC | Treat as logged-out — clear cookie, redirect to login | Low |
| Checkout attempted with expired session | Redirect to login, restore cart after re-auth | Medium |

---

## Security Must-Haves

Grounded in OWASP Authentication Cheat Sheet and direct CONCERNS.md audit findings.

| Control | Why Required | Implementation Note |
|---------|--------------|---------------------|
| OTP attempt counter in Redis (max 5, then delete OTP + return 429) | Currently absent — attackers can enumerate all 900k 6-digit combos in 10-min window | `otp_attempts:{identifier}` key alongside OTP key |
| Rate limit on verify-OTP endpoint | Currently absent — pairs with attempt counter for defence-in-depth | Match the send-OTP pattern already in `otp-store.ts` |
| Rate limit on login endpoint (password) | Prevents credential stuffing | 10 attempts per phone per 15-min window |
| Constant-time HMAC comparison for session cookie | Prevents timing attacks on signature verification | Use `crypto.timingSafeEqual` |
| `expiresAt` in signed cookie payload (server-side expiry) | Prevents indefinitely-valid stolen tokens | Existing concern in CONCERNS.md |
| Zod validation on all auth route bodies | Prevents injection via unexpected payload shapes | Currently missing per CONCERNS.md |
| DEV bypass (`DEV_TEST_PHONE`) guarded by `NODE_ENV` | Leaking to production = account takeover via known phone | One `if (process.env.NODE_ENV === 'production') throw` |
| Password stored as bcrypt hash (cost factor 12) | Never store plaintext or reversible hash | Medusa v2 handles this natively for its customer entity |
| OTP is single-use (invalidated immediately on correct verify) | Prevents OTP reuse attacks | Delete Redis key on successful verify |
| HTTPS-only cookie (`Secure` flag) | Prevents cookie interception on non-TLS connections | Already present in HMAC cookie pattern — verify flag is set |

---

## UX Expectations — Indian Mobile-First Users

Observation-grounded (Flipkart, Myntra, Meesho, Ajio, Nykaa — all follow these patterns). MEDIUM confidence on preference nuances, HIGH confidence on structural patterns.

| Expectation | Basis | Implementation Note |
|-------------|-------|---------------------|
| Phone number is the identity — not email | Myntra, Flipkart, Meesho all default to phone | Phone field is prominent; email is visually secondary |
| Single-page / minimal-step flows | Indian mobile users have lower tolerance for multi-screen auth | Signup: one screen → OTP screen → done. 2 steps max |
| SMS OTP is the trust signal | Users distrust password-only; OTP confirmation feels "official" | OTP screen must look clean and purposeful |
| Numeric OTP keyboard on mobile | Default text keyboard on OTP input is a known frustration point | `inputMode="numeric"` on OTP input element |
| Auto-submit OTP when 6 digits entered | Expected on all major Indian apps | Trigger verify on 6th digit without requiring tap of "Verify" button |
| Real-time validation feedback | No waiting until form submit to see an error | Validate phone format and password strength on blur, not submit |
| Indian phone format: 10 digits, no country code required | Users don't type +91 naturally | Accept bare 10-digit; prepend +91 internally |
| Error messages in plain language | "Invalid credentials" is acceptable; cryptic codes are not | "Wrong password. Forgot it?" is better than "401 Unauthorized" |
| "Remember me" behaviour (session survives browser close) | Indian users share devices less than assumed — still expected on personal phones | 7-day HttpOnly cookie already covers this |
| Fast SMS delivery (under 5 seconds) | MSG91 often delivers within 3s; Twilio similar — users abandon at 30s | Surface delivery delay gracefully: spinner + "Sending…" |

---

## Differentiators

Features that are not universally expected but would meaningfully improve auth experience for Poshakh's audience.

| Feature | Value Proposition | Complexity | Build When |
|---------|-------------------|------------|------------|
| SMS OTP auto-read via Web OTP API (`navigator.credentials.get`) | On Android Chrome, OTP fills automatically without user needing to open messages app — Meesho and Swiggy use this | Medium | Phase 1 optional — significant UX uplift on Android |
| Visual password strength meter (real-time) | Reduces weak passwords and account-takeover risk; improves user confidence | Low | Phase 1 — low effort, high perceived quality |
| "Resend in Xs" live countdown timer on OTP screen | Reduces "did it send?" anxiety; prevents support tickets | Low | Phase 1 — timer already implied by existing 60-sec limit |
| Attempt counter shown on OTP verify ("3 attempts remaining") | Reduces user panic; gives them information to act on | Low | Phase 1 |
| Cart preserved across login (merge guest cart with logged-in cart) | Users who add to cart before login should not lose it | High | Phase 2 — depends on Medusa cart merge logic; complex |
| Account page: real order history fetched from Medusa | Currently broken (orders lost on refresh — CRITICAL concern) | Medium | Phase 2 — fix existing bug; not strictly auth but auth-adjacent |
| Session token rotation on each login | Forward secrecy — invalidates old sessions when user logs in again | Medium | Phase 2 |
| "Logged in as [name]" confirmation after signup | Immediate onboarding signal; reduces "did it work?" confusion | Low | Phase 1 |
| Email OTP confirmation (if email provided at signup) | AUTH-03 in PROJECT.md; differentiates from phone-only competitors | Medium | Phase 1 — Resend SDK required; already planned |

---

## Anti-Features

Features to explicitly not build in this milestone. Each has a cost with no proportional return at this stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Social login (Google, Apple, Facebook) | Explicitly out of scope per PROJECT.md; adds OAuth complexity with no current user demand | Plan for later milestone; OAuth can coexist with phone-first |
| Magic link login (email) | Email is optional — a login method that depends on it excludes a segment of users | Phone + password is the login method; OTP is confirmation only |
| TOTP / authenticator app 2FA | Overcomplicated for Indian fashion e-commerce audience; abandonment risk is high | OTP-confirmed signup is sufficient second factor for this market |
| Username-based login | Explicitly out of scope; phone is the identifier | Use phone as the single identifier |
| Biometric auth (fingerprint/FaceID via WebAuthn) | No browser API standard for this without HTTPS + passkey infrastructure; significant complexity | Revisit if PWA is built |
| Account deletion flow (GDPR/DPDP right-to-erasure) | Correct long-term, but not blocking for current milestone | Flag for compliance milestone; India's DPDP Act 2023 requires it eventually |
| Password history enforcement | Engineering overhead not justified for e-commerce at this stage | Single current password + bcrypt is sufficient |
| Email-as-primary-login | Explicitly out of scope per PROJECT.md | Phone is the primary identifier without exception |

---

## Feature Dependencies

```
Phone validation (regex) → Signup form → OTP send (MSG91/Twilio)
                                      → Email OTP send (Resend) [if email provided]
OTP send → OTP verify screen → Brute-force protection (Redis attempt counter)
                             → Auto-read (Web OTP API) [differentiator]
OTP verify success → Account created → Session cookie (HMAC) → Middleware route protection

Password login → Rate limiting on login endpoint → Session cookie

Forgot password → OTP send (reuses same flow) → OTP verify → Password reset form → Session cookie

Session cookie → expiresAt validation → Logout (cookie clear)
              → Next.js middleware → Protected routes (/account, /checkout)

Signup complete → Cart merge (guest → authenticated) [Phase 2 dependency]
              → Account page → Order history fetch from Medusa [Phase 2 dependency]
```

---

## MVP Recommendation

Build in this order within the milestone (strict dependency sequence):

**Must ship in Phase 1 (auth rebuild):**
1. Backend Zod validation on all auth routes — unblocks everything safely
2. OTP brute-force protection (Redis attempt counter + lockout) — security prerequisite; currently CRITICAL severity
3. DEV bypass guard (`NODE_ENV` check) — HIGH severity; one-line fix, do it first
4. Session expiry timestamp in signed cookie — LOW effort, HIGH security value
5. Signup form (name + phone + optional email + password) with Indian phone validation
6. OTP confirmation flow (phone mandatory; email via Resend if provided)
7. Password login (phone + password)
8. Forgot password via SMS OTP
9. Next.js `middleware.ts` route protection — stops auth-page flash (HIGH concern in CONCERNS.md)
10. Clear per-scenario error messages for all edge cases above

**Differentiators to include in Phase 1 (low complexity, high value):**
- Visual password strength meter
- Auto-submit OTP on 6th digit
- "Resend in Xs" countdown
- `inputMode="numeric"` on OTP field
- Attempt counter display on OTP screen

**Defer to Phase 2:**
- Web OTP API auto-read (Android Chrome) — test environment needed
- Cart merge (guest to authenticated) — Medusa cart merge logic complexity
- Session token rotation on login
- Order history fetch fix (separate CRITICAL concern, not auth)

---

## Sources and Confidence

| Area | Confidence | Basis |
|------|------------|-------|
| Security controls (brute-force, rate limit, bcrypt, HMAC) | HIGH | OWASP Authentication Cheat Sheet, stable standards; cross-referenced with CONCERNS.md audit findings |
| Indian phone number format (6–9 prefix, 10 digits) | HIGH | TRAI numbering plan, stable since 2015 |
| Indian e-commerce UX patterns (phone-first, OTP trust signal, auto-submit) | HIGH | Structural observation of Flipkart, Myntra, Meesho, Ajio, Nykaa — consistent industry pattern |
| Web OTP API support on Android Chrome | MEDIUM | Chrome 84+ documented; iOS Safari does not support `OTPCredential` as of 2024 |
| DPDP Act 2023 compliance (account deletion) | MEDIUM | India's Digital Personal Data Protection Act 2023 — enforcement timeline still evolving |
| Cart merge complexity via Medusa v2 | MEDIUM | Medusa v2 cart transfer patterns known; specific API surface needs validation against current docs |
| Edge case error messages (enumeration prevention) | HIGH | OWASP auth guidance on information leakage prevention |
