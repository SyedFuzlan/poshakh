---
phase: 07-auth-improvements
plan: "03"
subsystem: backend
tags: [email, verification, resend, signup, token]
dependency_graph:
  requires: [07-01, 07-02]
  provides:
    - backend/utils/email.js with sendVerificationEmail and sendPasswordResetEmail
    - email verification token creation in POST /api/customers/signup
    - GET /api/customers/verify-email endpoint
  affects:
    - backend/utils/email.js
    - backend/routes/customers.js
tech_stack:
  added: []
  patterns:
    - lazy-resend-client-init (avoids constructor throw on missing API key)
    - dev-mode-console-fallback (NODE_ENV !== production skips Resend, logs to console)
    - atomic-signup-transaction (db.transaction wraps customer + token INSERT)
    - single-use-token (DELETE on verification prevents replay)
key_files:
  created:
    - backend/utils/email.js
  modified:
    - backend/routes/customers.js
decisions:
  - "Resend client initialized lazily (getResend() factory) — constructor throws on missing API key, which would break require() in dev/test environments"
  - "sendVerificationEmail fires outside db.transaction with .catch() — email delivery failure does not roll back or block signup (T-07-03-05)"
  - "Token only created when email is present — phone-only signups skip email_verification_tokens INSERT"
  - "Token length validated at 64 chars before any DB lookup — prevents hash-length extension attacks (T-07-03-03)"
  - "UPDATE + DELETE wrapped in db.transaction() for atomic single-use verification (T-07-03-02)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-10"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 1
---

# Phase 07 Plan 03: Email Verification Summary

**One-liner:** Resend-based email utility (with dev-mode console fallback) wired into signup for atomic token creation and single-use verification via GET /verify-email.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create backend/utils/email.js with Resend wrapper | 246b1de | backend/utils/email.js |
| 2 | Wire email verification into signup and add GET /verify-email endpoint | 7283cd5 | backend/routes/customers.js |

## What Was Built

### Email Utility Module (Task 1)

New file `backend/utils/email.js` following the `sms.js` structural pattern:

- **`sendVerificationEmail(to, rawToken)`** — builds verification link with `APP_URL + /api/customers/verify-email?token=<rawToken>`, logs to console in dev, calls Resend in production
- **`sendPasswordResetEmail(to, rawToken)`** — builds reset link with `APP_URL + /reset-password?token=<rawToken>`, same dev/prod split
- **Lazy Resend client init** — `getResend()` factory function initializes `new Resend(key)` on first production call. This is a deviation from the plan's module-level `const resend = new Resend(...)` pattern because the Resend SDK constructor throws immediately on a missing key, which would break `require('./email')` in all dev/test environments. The lazy init is the correct pattern per the sms.js spirit (no-op when key absent).
- **`module.exports = { sendVerificationEmail, sendPasswordResetEmail }`** at bottom

### Signup + Verification Flow (Task 2)

**customers.js changes:**

1. Added import: `const { sendVerificationEmail } = require('../utils/email')`

2. Signup handler extended:
   - Generates `rawVerifToken = generateToken()` (64-char hex) and `verifHash = hashToken(rawVerifToken)` before the transaction
   - `db.transaction()` now wraps both the customer INSERT and (conditionally) the `email_verification_tokens` INSERT — partial state cannot persist (T-07-03-04)
   - Token is only inserted when `email` is present — phone-only signups are unaffected
   - `sendVerificationEmail(...).catch(...)` fires outside the transaction — email failure is logged but does not roll back or block the 201 response

3. New **`GET /api/customers/verify-email`** endpoint:
   - Validates `token` query param: must be present, string, exactly 64 chars (blocks malformed tokens before DB query, T-07-03-03)
   - Looks up `hashToken(token)` in `email_verification_tokens` WHERE `expires_at > now`
   - Returns 400 for missing/malformed/expired/unknown tokens
   - On valid token: wraps `UPDATE customers SET email_verified = 1` + `DELETE FROM email_verification_tokens` in `db.transaction()` for atomic single-use enforcement (T-07-03-02)
   - Returns `{ verified: true }` on success

## Threat Model Compliance

All STRIDE threats from plan satisfied:

| Threat ID | Status |
|-----------|--------|
| T-07-03-01 | Mitigated — only `hashToken(rawToken)` stored in DB; raw token in email link only |
| T-07-03-02 | Mitigated — DELETE in verify transaction immediately after UPDATE; token is single-use |
| T-07-03-03 | Mitigated — `token.length !== 64` check before DB lookup |
| T-07-03-04 | Mitigated — `db.transaction()` wraps customer INSERT + token INSERT atomically |
| T-07-03-05 | Mitigated — `sendVerificationEmail` called with `.catch()` outside transaction |
| T-07-03-06 | Accepted — RESEND_API_KEY only in env var, not in source |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy Resend client initialization**
- **Found during:** Task 1 verification
- **Issue:** The plan specified `const resend = new Resend(process.env.RESEND_API_KEY)` at module scope. The Resend SDK constructor throws `Error: Missing API key. Pass it to the constructor` immediately when the API key is absent (not undefined-safe). This makes `require('./email')` throw in all dev/test environments where `RESEND_API_KEY` is not set — violating the Task 1 acceptance criteria.
- **Fix:** Replaced module-level `const resend = new Resend(...)` with a `getResend()` lazy factory that initializes the client on first production call. The dev-mode guard fires before `getResend()` is ever called, so the constructor is never reached in dev.
- **Files modified:** backend/utils/email.js
- **Commit:** 246b1de

## Known Stubs

None — all functions are fully implemented and wired.

## Threat Flags

None — the new GET /verify-email endpoint is explicitly covered in the plan's threat model. No unplanned attack surface introduced.

## Self-Check: PASSED

Files exist:
- backend/utils/email.js: FOUND
- backend/routes/customers.js: FOUND (modified)

Commits exist:
- 246b1de (feat(07-03): create email utility with Resend wrapper and dev-mode console fallback): FOUND
- 7283cd5 (feat(07-03): wire email verification into signup and add GET /verify-email endpoint): FOUND
