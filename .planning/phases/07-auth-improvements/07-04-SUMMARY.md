---
phase: 07-auth-improvements
plan: "04"
subsystem: backend
tags: [password-reset, token-cleanup, anti-enumeration, atomic-transaction, recovery-task]
dependency_graph:
  requires: [07-01, 07-02, 07-03]
  provides:
    - POST /api/customers/forgot-password endpoint (anti-enumeration, 30min token)
    - POST /api/customers/reset-password endpoint (single-use token, atomic UPDATE+DELETE)
    - runRecoveryTask token cleanup for all three token tables
  affects:
    - backend/routes/customers.js
    - backend/routes/checkouts.js
tech_stack:
  added: []
  patterns:
    - anti-enumeration-response (always 200 regardless of email existence)
    - sha256-token-storage (only hash stored in DB, raw token emailed)
    - atomic-password-reset (db.transaction wraps UPDATE + DELETE)
    - non-blocking-email (sendPasswordResetEmail with .catch, outside transaction)
    - periodic-token-cleanup (DELETE WHERE expires_at < now in runRecoveryTask)
key_files:
  created: []
  modified:
    - backend/routes/customers.js
    - backend/routes/checkouts.js
decisions:
  - "POST /forgot-password always returns 200 with identical body to prevent email enumeration (T-07-04-01)"
  - "sendPasswordResetEmail called with .catch() outside any transaction — email failure never blocks the 200 response"
  - "token.length !== 64 validated before any DB lookup — rejects malformed tokens cheaply (T-07-04-04)"
  - "UPDATE customers SET password_hash + DELETE FROM password_reset_tokens wrapped in single db.transaction() — token is destroyed atomically with password change (T-07-04-02)"
  - "BCRYPT_ROUNDS constant (12) reused for reset password hash — not hardcoded"
  - "Three DELETE statements placed inside try{} block of runRecoveryTask, after the abandoned cart loop, so errors are caught by existing catch handler (T-07-04-05)"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-10"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 07 Plan 04: Password Reset Flow Summary

**One-liner:** Anti-enumeration /forgot-password with 30-min SHA-256-hashed tokens and atomic /reset-password endpoint, plus runRecoveryTask extended to purge all three token tables on every 30-min cycle.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add POST /forgot-password and POST /reset-password endpoints to customers.js | e8cecc1 | backend/routes/customers.js |
| 2 | Extend runRecoveryTask to clean up expired token rows | dd33a2c | backend/routes/checkouts.js |

## What Was Built

### Password Reset Endpoints (Task 1)

**Import update:**
- Extended email utility import to include `sendPasswordResetEmail` alongside `sendVerificationEmail`

**POST /api/customers/forgot-password:**
- Accepts `{ email }` in body
- If email is absent or not a string: returns `200 { message: 'If that email exists...' }` immediately (no DB query)
- If email is present: looks up customer; if found, generates 64-char hex raw token, stores SHA-256 hash in `password_reset_tokens` with 30-minute expiry, calls `sendPasswordResetEmail` with `.catch()` (non-blocking)
- Returns identical `200 { message: 'If that email exists, a reset link has been sent' }` regardless of whether customer was found — prevents email enumeration (T-07-04-01)

**POST /api/customers/reset-password:**
- Accepts `{ token, newPassword }` in body
- Validates: `token` must be present, string, exactly 64 chars (rejects malformed before DB query — T-07-04-04)
- Validates: `newPassword` must be >= 8 chars
- Hashes token via `hashToken()` and looks up in `password_reset_tokens` WHERE `expires_at > now`
- Returns `400 { error: 'Invalid or expired reset token' }` if not found (covers expired and already-used)
- On valid token: bcrypt-hashes new password with `BCRYPT_ROUNDS` (12), then `db.transaction()` atomically runs `UPDATE customers SET password_hash = ?` + `DELETE FROM password_reset_tokens WHERE token_hash = ?` — single-use enforcement (T-07-04-02)
- Returns `{ success: true }` on success

### Token Table Cleanup (Task 2)

Three `db.prepare().run()` statements appended inside `runRecoveryTask`'s `try {}` block, after the existing abandoned cart SMS loop:

```sql
DELETE FROM refresh_tokens WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')
DELETE FROM email_verification_tokens WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')
DELETE FROM password_reset_tokens WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')
```

These run every 30 minutes (same cadence as the recovery task scheduler) and prevent unbounded growth in the three token tables (T-07-04-05). Errors are caught by the existing `catch (err) { logger.error(err, 'Abandoned Cart Recovery Task Error') }` handler.

## Threat Model Compliance

All STRIDE threats from plan satisfied:

| Threat ID | Status |
|-----------|--------|
| T-07-04-01 | Mitigated — identical `200` response with same body whether email found or not |
| T-07-04-02 | Mitigated — `db.transaction()` destroys token atomically with password update; second use returns 400 |
| T-07-04-03 | Mitigated — `Date.now() + 30 * 60 * 1000` (30 minutes) expiry window |
| T-07-04-04 | Mitigated — `token.length !== 64` check before any DB lookup |
| T-07-04-05 | Mitigated — runRecoveryTask now DELETEs all three token tables every cycle |
| T-07-04-06 | Mitigated — only `hashToken(rawToken)` stored in DB; raw token is emailed and never persisted |

## Deviations from Plan

None — plan executed exactly as written.

Note: The worktree was created before master had the Plan 01-03 merges. A `git merge master` was performed at the start of execution to pull in those changes. This is expected operational setup (not a deviation from the implementation plan).

## Known Stubs

None — both endpoints are fully implemented and wired. The `password_reset_tokens` table is created at startup by Plan 01 (db.js), and `sendPasswordResetEmail` is implemented in Plan 03 (email.js).

## Threat Flags

None — the two new endpoints (`/forgot-password`, `/reset-password`) are explicitly covered in the plan's threat model. No unplanned attack surface introduced.

## Self-Check: PASSED

Files exist:
- backend/routes/customers.js: FOUND (contains forgot-password and reset-password routes)
- backend/routes/checkouts.js: FOUND (contains three DELETE cleanup statements)

Commits exist:
- e8cecc1 (feat(07-04): add POST /forgot-password and POST /reset-password endpoints): FOUND
- dd33a2c (feat(07-04): extend runRecoveryTask with expired token cleanup for all three token tables): FOUND
