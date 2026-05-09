---
status: partial
phase: 06-security-hardening
source: [06-VERIFICATION.md]
started: 2026-05-09T00:00:00Z
updated: 2026-05-09T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end owner login with bcrypt
expected: POST /api/auth/login with correct email + bcrypt-hashed password returns 200 + { token, email }. Wrong password returns 401.
result: [pending]

### 2. Checkout rate limit enforcement
expected: 21st POST to /api/checkouts from same IP returns 429 with { "error": "Too many requests, please try again later." }
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
