---
phase: 07-auth-improvements
plan: "01"
subsystem: backend
tags: [database, schema, middleware, email, auth]
dependency_graph:
  requires: []
  provides:
    - refresh_tokens table in SQLite schema
    - email_verification_tokens table in SQLite schema
    - password_reset_tokens table in SQLite schema
    - customers.email_verified column
    - cookie-parser middleware mounted in server.js
    - resend npm package available
    - RESEND_API_KEY/APP_URL production guard in server.js
  affects:
    - backend/db.js
    - backend/server.js
    - backend/package.json
    - backend/.env.example
tech_stack:
  added:
    - resend@^6.12.3
    - cookie-parser@^1.4.7
  patterns:
    - safeMigrate pattern for backwards-compatible schema changes
    - httpOnly cookie support via cookie-parser
    - production-only env guard pattern (NODE_ENV === 'production')
key_files:
  created: []
  modified:
    - backend/package.json
    - backend/package-lock.json
    - backend/db.js
    - backend/server.js
    - backend/.env.example
decisions:
  - Three token tables use UNIQUE constraint on token_hash to prevent hash collision reuse
  - cookieParser() mounted before body-parser middleware per threat model T-07-01-02
  - email_verified added via safeMigrate for backwards compatibility with existing DBs
  - RESEND_API_KEY guard is production-only so local dev without Resend account is unblocked
metrics:
  duration: "~10 minutes"
  completed: "2026-05-10"
  tasks_completed: 4
  tasks_total: 4
---

# Phase 07 Plan 01: Auth Infrastructure Foundation Summary

**One-liner:** SQLite token tables (refresh/email-verify/password-reset), email_verified migration, cookie-parser middleware mount, and Resend package install to unblock all Wave 2 auth plans.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Install resend and cookie-parser npm packages | 7089cb5 | backend/package.json, backend/package-lock.json |
| 1 | Add token tables to db.js and email_verified migration | f4a60de | backend/db.js |
| 2 | Mount cookie-parser and add production env validation in server.js | df928e7 | backend/server.js |
| 3 | Add RESEND_API_KEY and APP_URL to .env.example | 9544947 | backend/.env.example |

## What Was Built

### npm Packages (Task 0)
- `resend@^6.12.3` — Resend email API SDK for transactional emails (verification, password reset)
- `cookie-parser@^1.4.7` — Express middleware to parse httpOnly cookies for refresh token storage

### Database Schema (Task 1)
Three new token tables added inside the existing `_db.run()` call in db.js:

- **refresh_tokens** — Stores hashed refresh tokens (7-day expiry, per Plan 02)
- **email_verification_tokens** — Stores hashed email verification tokens (24hr expiry, per Plan 03)
- **password_reset_tokens** — Stores hashed password reset tokens (1hr expiry, per Plan 03)

All three tables share the same schema pattern:
- `token_hash TEXT NOT NULL UNIQUE` — prevents hash collision reuse (T-07-01-01)
- `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE` — prevents orphaned tokens (T-07-01-05)

Also added via safeMigrate: `ALTER TABLE customers ADD COLUMN email_verified INTEGER DEFAULT 0` — backwards compatible with existing databases.

### Server Middleware (Task 2)
- `const cookieParser = require('cookie-parser')` added to require block
- `app.use(cookieParser())` mounted BEFORE body-parser middleware (critical ordering for T-07-01-02)
- Production env guard: exits with clear error if `RESEND_API_KEY` or `APP_URL` are missing when `NODE_ENV=production` (T-07-01-04)

### Environment Documentation (Task 3)
Two new sections appended to `backend/.env.example`:
- `RESEND_API_KEY=` with link to resend.com/api-keys and domain verification note
- `APP_URL=http://localhost:3000` with production/dev instructions

## Verification Results

All success criteria confirmed:
- resend@^6.12.3 and cookie-parser@^1.4.7 in package.json dependencies and node_modules
- refresh_tokens, email_verification_tokens, password_reset_tokens tables exist after initDb()
- customers.email_verified column present
- app.use(cookieParser()) appears before express.json() middleware
- backend/.env.example contains RESEND_API_KEY= and APP_URL=http://localhost:3000
- Production startup guard conditional on NODE_ENV=production (local dev unblocked)

## Deviations from Plan

None — plan executed exactly as written.

Minor observation: The worktree's server.js and .env.example differed from the main branch (fewer safeMigrate calls, different CORS setup, OWNER_PASSWORD vs OWNER_PASSWORD_HASH) — changes were applied to the worktree's version as the executor's source of truth without altering existing content.

## Known Stubs

None — this plan is infrastructure only (tables, middleware, packages). No UI rendering or data flows involved.

## Threat Surface Scan

No new network endpoints introduced. All threat model items from the plan are addressed:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-07-01-01 | token_hash TEXT NOT NULL UNIQUE on all three tables |
| T-07-01-02 | cookieParser() mounted before body-parser (verified via line number check) |
| T-07-01-03 | ON DELETE CASCADE on all token tables; cleanup to be added in Plan 04 |
| T-07-01-04 | Production env guard exits process on missing RESEND_API_KEY/APP_URL |
| T-07-01-05 | FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE on all tables |

## Self-Check: PASSED

Files verified:
- backend/package.json — FOUND (resend and cookie-parser in dependencies)
- backend/db.js — FOUND (three CREATE TABLE blocks, email_verified safeMigrate)
- backend/server.js — FOUND (cookieParser require, app.use mount, production guard)
- backend/.env.example — FOUND (RESEND_API_KEY=, APP_URL=http://localhost:3000)

Commits verified:
- 7089cb5 — FOUND (chore: install packages)
- f4a60de — FOUND (feat: token tables)
- df928e7 — FOUND (feat: cookie-parser + env guard)
- 9544947 — FOUND (docs: env.example)
