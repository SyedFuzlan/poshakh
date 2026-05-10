---
phase: 06-security-hardening
plan: "01"
subsystem: auth
tags: [bcrypt, jwt, express, security, password-hashing]

requires:
  - phase: 05-critical-hotfixes
    provides: logger utility, pino-based structured logging in backend/utils/logger.js

provides:
  - Async bcrypt owner login handler in backend/routes/auth.js
  - OWNER_PASSWORD_HASH env var startup validation in backend/server.js
  - Hash generation documentation in backend/.env.example

affects: [06-security-hardening, deploy, ops]

tech-stack:
  added: [bcryptjs (already installed, now used in owner auth path)]
  patterns: [async/await bcrypt.compare over compareSync, both email+password evaluated before branch to prevent timing oracle]

key-files:
  created: []
  modified:
    - backend/routes/auth.js
    - backend/server.js
    - backend/.env.example

key-decisions:
  - "Use bcrypt cost-12 (matches customer auth) — not cost-10 — consistent hardness across all auth paths"
  - "Evaluate emailOk AND passOk before branching — prevents early-return timing oracle on email enumeration"
  - "Missing OWNER_PASSWORD_HASH returns 500 (not crash) in handler; server.exit(1) at startup via required[] ensures it is always set"
  - "Never use bcrypt.compareSync — blocks event loop ~100-200ms per call under authLimiter (10/hr) — always await bcrypt.compare"

patterns-established:
  - "Async password comparison pattern: const passOk = await bcrypt.compare(input, storedHash) — same as customers.js"
  - "Env var guard pattern: if (!ownerHash) { logger.error(...); return res.status(500).json(...) } before use"

requirements-completed: [SEC-01-bcrypt-owner-password]

duration: 15min
completed: 2026-05-09
---

# Phase 06 Plan 01: Security Hardening — bcrypt Owner Auth Summary

**Owner login replaced plaintext string compare with async bcrypt.compare(OWNER_PASSWORD_HASH), startup exits if hash is missing, .env.example documents the hash generation command**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-09T08:48:05Z
- **Completed:** 2026-05-09T09:03:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Rewrote owner login handler from synchronous plaintext `password !== ownerPassword` to `async/await bcrypt.compare(password, ownerHash)` — a leaked `.env` now yields a cost-12 hash, not a usable secret
- Updated `server.js` required[] array to require `OWNER_PASSWORD_HASH` at startup — process exits 1 if missing, preventing silent open-auth configuration
- Documented hash generation command in `.env.example` with a one-liner node command (`require('bcryptjs').hash(...)`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite auth.js login handler to use async bcrypt.compare** - `80c3df6` (feat)
2. **Task 2: Update server.js env validation and .env.example** - `74b420d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/routes/auth.js` — Async login handler with bcrypt.compare, OWNER_PASSWORD_HASH guard, timing-safe dual eval
- `backend/server.js` — required[] now references OWNER_PASSWORD_HASH instead of OWNER_PASSWORD
- `backend/.env.example` — OWNER_PASSWORD_HASH field with inline hash-generation command; OWNER_PASSWORD removed

## Decisions Made

- Use `await bcrypt.compare()` (not `bcrypt.compareSync()`) — compareSync blocks the event loop for ~100-200ms per call; under the existing `authLimiter` (10 req/hr) this is bounded, but async is the correct pattern
- Evaluate both `emailOk` and `passOk` before the conditional branch — prevents an attacker from inferring valid email addresses via timing differences
- Return HTTP 500 (not crash) when `OWNER_PASSWORD_HASH` is absent at login time — the startup `required[]` check is the primary guard; the handler guard is defense-in-depth
- Kept the comment `// async — never use compareSync` in auth.js as a code-level reminder for future maintainers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — `bcryptjs` was already installed in the backend (`backend/node_modules/bcryptjs`). Logger utility (`backend/utils/logger.js`) was already present from Phase 05. All criteria met on first attempt.

## User Setup Required

**OWNER_PASSWORD must be replaced with OWNER_PASSWORD_HASH in your .env file.**

Generate the hash:
```bash
node -e "require('bcryptjs').hash('YourPassword', 12).then(h => console.log('OWNER_PASSWORD_HASH=' + h))"
```

Add `OWNER_PASSWORD_HASH=<output>` to `backend/.env` and remove `OWNER_PASSWORD=`.

## Threat Surface

All STRIDE mitigations from the plan's threat model were implemented:

| Threat | Mitigation |
|--------|-----------|
| T-06-01-01 Spoofing | `await bcrypt.compare(password, ownerHash)` — cost-12 |
| T-06-01-02 Info Disclosure | Bcrypt hash stored, not plaintext — leaked .env is not usable |
| T-06-01-03 Tampering/Timing | Both emailOk + passOk evaluated before branch |
| T-06-01-05 Startup | `required["OWNER_PASSWORD_HASH"]` → process.exit(1) if missing |

T-06-01-04 (DoS/CPU) accepted — `authLimiter` (10/hr) already bounds bcrypt CPU use.

## Next Phase Readiness

- Plan 02 (rate limiting audit), Plan 03 (SQL injection hardening), Plan 04 (secrets rotation) can all proceed independently
- Owner auth path is now consistent with customer auth path (both use bcrypt cost-12 via bcryptjs)

---
*Phase: 06-security-hardening*
*Completed: 2026-05-09*
