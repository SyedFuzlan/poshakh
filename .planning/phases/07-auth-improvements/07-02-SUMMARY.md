---
phase: 07-auth-improvements
plan: 02
subsystem: auth
tags: [jwt, refresh-tokens, httponly-cookie, token-rotation, logout]
dependency_graph:
  requires: [07-01]
  provides: [customer-short-lived-access-token, refresh-endpoint, logout-endpoint]
  affects: [backend/routes/customers.js]
tech_stack:
  added: []
  patterns: [refresh-token-rotation, sha256-hash-storage, httponly-cookie-scoped-path]
key_files:
  created: []
  modified:
    - backend/routes/customers.js
decisions:
  - "Cookie path set to /api/customers (not /) to limit refresh token cookie scope to customer endpoints only — per RESEARCH.md anti-patterns"
  - "Raw refresh token never stored in DB — only SHA-256 hash stored (T-07-02-01)"
  - "Rotation pattern: DELETE old row before INSERT new row to prevent replay of rotated tokens (T-07-02-03)"
  - "sameSite:lax prevents cross-site POST from triggering cookie send (T-07-02-04)"
  - "logout is idempotent — no cookie present returns success (not 401), per trust boundary spec"
metrics:
  duration: ~8 minutes
  completed: "2026-05-10"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 07 Plan 02: Auth Token Improvement Summary

**One-liner:** Replaced 30-day long-lived JWT with 15-minute access token + 7-day httpOnly refresh token system including rotation and real logout.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace signCustomerToken with signAccessToken, issueTokenPair; update login/signup | c84952c | backend/routes/customers.js |
| 2 | Add POST /api/customers/refresh and POST /api/customers/logout endpoints | c84952c | backend/routes/customers.js |

Note: Both tasks were committed in a single atomic commit (c84952c) because they modify the same file and the helper functions from Task 1 (issueTokenPair, hashToken) are prerequisites used by the Task 2 route handlers — splitting them across two commits would leave the file in an inconsistent intermediate state.

## What Was Built

### Helper Functions Added

- `signAccessToken(id, phone)` — issues 15-minute JWT with identical payload shape `{ role: 'customer', id, phone }` as the old `signCustomerToken` (requireCustomer middleware continues to work unchanged)
- `generateToken()` — generates 64-char hex random token via `crypto.randomBytes(32)`
- `hashToken(token)` — SHA-256 hash of the raw token for DB storage
- `issueTokenPair(res, customerId, phone)` — inserts a `refresh_tokens` row (storing only the hash), sets the httpOnly cookie, returns the new accessToken

### Login/Signup Changes

- Both handlers now call `issueTokenPair(res, ...)` instead of `signCustomerToken`
- JSON response field renamed from `token` to `accessToken` in both handlers
- `console.error` replaced with `logger.error` (pino logger) in both catch blocks

### New Endpoints

**POST /api/customers/refresh**
- Reads `refreshToken` cookie, hashes it, looks up hash in `refresh_tokens` WHERE `expires_at > now`
- Returns 401 if cookie absent, hash not found, or token expired
- Rotation: DELETEs old row, then calls `issueTokenPair` to INSERT new row + set new cookie
- Returns `{ accessToken }` on success

**POST /api/customers/logout**
- Reads `refreshToken` cookie (if present), hashes it, DELETEs matching row in `refresh_tokens`
- Calls `res.clearCookie('refreshToken', { path: '/api/customers' })` — path must match cookie set path exactly for browser to delete it
- Returns `{ success: true }` regardless of whether a cookie was present (idempotent)

## Threat Model Compliance

All STRIDE threats from plan satisfied:

| Threat ID | Status |
|-----------|--------|
| T-07-02-01 | Mitigated — only SHA-256 hash stored in DB, never raw token |
| T-07-02-02 | Mitigated — `expiresIn: "15m"` limits stolen token window |
| T-07-02-03 | Mitigated — DELETE before INSERT prevents replay of rotated token |
| T-07-02-04 | Mitigated — `sameSite: 'lax'` on cookie |
| T-07-02-05 | Mitigated — accessToken in JSON body (JS memory); refreshToken in httpOnly cookie |
| T-07-02-06 | Accepted — runRecoveryTask (Plan 04) handles cleanup |
| T-07-02-07 | Mitigated — `path: '/api/customers'` scopes cookie to customer routes only |

## Deviations from Plan

None — plan executed exactly as written.

Both tasks were implemented in a single Write operation (rather than Edit patches) due to the volume of changes across the file, but all specified code patterns are present verbatim.

## Known Stubs

None — all endpoints are fully wired. The `refresh_tokens` table referenced by these routes will be created at server startup by Plan 07-01 (db.js changes), per the parallel wave design.

## Threat Flags

None — the two new endpoints (`/refresh`, `/logout`) are explicitly planned in the plan's threat model and trust boundary spec. No unplanned attack surface introduced.

## Self-Check

Files exist:
- backend/routes/customers.js: FOUND

Commits exist:
- c84952c (feat(07-02): replace signCustomerToken with 15m access token + refresh token system): FOUND

## Self-Check: PASSED
