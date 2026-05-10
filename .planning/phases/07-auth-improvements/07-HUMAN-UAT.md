---
status: partial
phase: 07-auth-improvements
source: [07-VERIFICATION.md]
started: "2026-05-10T00:00:00Z"
updated: "2026-05-10T00:00:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cookie attributes on login/signup response headers
expected: Login and signup responses set `Set-Cookie: refreshToken=...; HttpOnly; SameSite=Lax; Path=/api/customers` — confirmed via curl -v or browser DevTools Network tab
result: [pending]

### 2. Refresh token rotation enforces single-use at runtime
expected: After POST /api/customers/refresh returns a new cookie, the old cookie value returns 401 "Invalid or expired refresh token" on a second attempt
result: [pending]

### 3. Dev-mode console logging of email/reset links
expected: In dev (NODE_ENV not 'production'), signup logs the email verification URL to console instead of sending via Resend; /forgot-password logs the reset link to console
result: [pending]

### 4. PostgreSQL integer 1 accepted in email_verified column
expected: After GET /api/customers/verify-email with a valid token, the customers row shows email_verified = 1 with no type error (PostgreSQL boolean vs integer check)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
