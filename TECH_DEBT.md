# TECHNICAL DEBT — POSHAKH
> Items that slow development, reduce confidence, or will break under scale  
> Date: 2026-04-25

---

## DEBT CLASSIFICATION

| Class | Definition |
|-------|-----------|
| **STRUCTURAL** | Architecture decisions that force rework as the system grows |
| **CODE QUALITY** | Patterns that make code hard to read, test, or change |
| **MISSING INFRA** | Tooling gaps that create operational risk |
| **TESTING** | Absence of test coverage in critical paths |
| **SECURITY** | Deferred security controls that must be addressed |
| **DEPENDENCY** | Libraries not yet installed that are already required |

---

## STRUCTURAL DEBT

### SD-01: Business Logic in Route Handlers
**Severity**: HIGH  
**Files**: All `route.ts` files

Route handlers currently contain business logic directly. The checkout complete route is 83 lines of orchestration: address attachment, shipping setup, payment session creation, and order completion all live in a single request handler. This violates the Single Responsibility Principle and makes logic untestable without HTTP.

**What needs to happen**:
```
Current:  route.ts → Medusa workflow (direct)
Required: route.ts → service layer → Medusa workflow
```

Add `src/services/auth.service.ts`, `src/services/checkout.service.ts`, etc. Route handlers should only parse input, call a service, and format output.

---

### SD-02: No Shared Middleware Layer
**Severity**: HIGH  
**Files**: All `route.ts` files

Every route handles its own error catching, input parsing, and (absent) auth checking. There is no shared middleware for:
- Authentication guard
- Input validation
- Error normalization
- Request logging
- Rate limiting

As more routes are added, copy-paste patterns will diverge and cause inconsistent behavior.

---

### SD-03: No Zod / Validation Layer
**Severity**: HIGH  
**Files**: All `route.ts` files

Input is validated with ad-hoc `if (!field)` checks. No type enforcement, no schema documentation, no field-level error messages. When more routes are added, this becomes a maintenance nightmare and a source of subtle bugs (e.g., `amount_in_rupees` accepting negative values).

---

### SD-04: Payment Flow is Client-Orchestrated
**Severity**: HIGH  
**Files**: `checkout/complete/route.ts`, `checkout/verify-payment/route.ts`

The current payment flow requires the client to:
1. Call `/create-order` (get Razorpay order)
2. Show Razorpay widget (get payment)
3. Call `/verify-payment` (verify signature)
4. Call `/complete` (create Medusa order)

If any step fails client-side, the order state is corrupted. The correct pattern is a server-side Razorpay webhook that drives order state transitions, with the client acting only as a trigger, not a coordinator.

---

### SD-05: No Custom Error Classes
**Severity**: MEDIUM  
**Files**: All

Errors are thrown as generic `Error` objects. There is no way to distinguish validation errors from auth errors from payment errors programmatically. Error handling is `catch (error) { return 500 }` everywhere.

**Required**: `src/errors/` directory with:
- `ValidationError` (400)
- `AuthError` (401/403)
- `NotFoundError` (404)
- `ConflictError` (409)
- `PaymentError` (422)

---

### SD-06: Auth is a Custom Implementation Outside Medusa's Auth System
**Severity**: MEDIUM  
**Files**: `store/auth/send-otp/`, `store/auth/verify-otp/`

Medusa v2 ships with a built-in auth module supporting custom providers. The current OTP implementation bypasses this entirely (direct customer creation, manual cookie/session management). This means:
- Auth bypass is possible if Medusa's session validation is inconsistent
- Custom auth logic won't benefit from Medusa auth improvements
- Session revocation, token refresh, and MFA are not handled by the framework

---

## CODE QUALITY DEBT

### CQ-01: `console.log` Throughout Production Code
**Severity**: HIGH  
**Files**: `send-otp/route.ts`, `redis.ts`

`console.log` is used for both debugging and error reporting. Logs have no structure, no log levels, no correlation IDs, and cannot be queried or alerted on. In production, these logs are unindexed noise.

**Replace with**: `pino` structured logger with fields: `{ requestId, userId, event, duration, error }`

---

### CQ-02: Process.env Read Inline Without Validation
**Severity**: HIGH  
**Files**: All route handlers, `medusa-config.ts`

```typescript
// Current pattern (bad):
const authKey = process.env.MSG91_AUTH_KEY  // undefined if not set
```

Missing env vars fail silently at runtime (often as `Cannot read property of undefined`) instead of at startup. A developer deploying without MSG91 credentials will see a confusing error on the first OTP send.

**Replace with**: `envalid` or `zod` env schema validated at process start:
```typescript
// Good pattern:
const env = cleanEnv(process.env, {
  MSG91_AUTH_KEY: str(),
  RAZORPAY_KEY_ID: str(),
  ...
})
```

---

### CQ-03: MSG91 Integration via Raw `fetch()`
**Severity**: MEDIUM  
**File**: `send-otp/route.ts`

MSG91 is called with raw `fetch()` — no retry logic, no timeout, no circuit breaker. A 500ms network hiccup to MSG91 will cause the OTP endpoint to fail entirely. PROJECT_STATUS.md already notes MSG91 is unreliable.

**Replace with**: Twilio Verify SDK (retry + delivery status built in)

---

### CQ-04: Empty Stub Files Committed to Main
**Severity**: LOW  
**Files**: `admin/custom/route.ts`, `store/custom/route.ts`

These files return empty 200 responses and serve no purpose. They add noise to the API surface and could confuse developers who find them via route discovery.

**Action**: Delete or replace with 501 Not Implemented responses until purposeful.

---

### CQ-05: `instrumentation.ts` is Dead Code
**Severity**: LOW  
**File**: `backend/instrumentation.ts`

100% of the file is commented out. It appears to have been generated by Medusa scaffolding and never implemented.

**Action**: Either implement OpenTelemetry tracing or delete the file.

---

### CQ-06: Seed Script Filters by Hardcoded Strings
**Severity**: LOW  
**File**: `src/scripts/seed.ts`

Category lookups use `filter.name` comparisons against hardcoded strings like `"Sarees"`, `"Salwar Kameez"`. If category names are ever changed, the seed script silently creates duplicates.

---

## MISSING INFRASTRUCTURE DEBT

### MI-01: No Docker / docker-compose
**Severity**: HIGH

No container configuration exists. Every developer must manually set up PostgreSQL, Redis, and the Node runtime. Onboarding a new developer takes hours instead of `docker-compose up`.

**Required**:
```yaml
services:
  api: { build: ./backend }
  postgres: { image: postgres:16 }
  redis: { image: redis:7 }
```

---

### MI-02: No CI/CD Pipeline
**Severity**: HIGH

No GitHub Actions, no automated tests on PR, no deployment pipeline. Code can be merged and deployed without any quality gate.

**Required**:
- `on: pull_request` → lint, typecheck, unit tests
- `on: push to main` → integration tests → deploy to staging
- `on: tag` → deploy to production

---

### MI-03: No Linter or Formatter
**Severity**: MEDIUM

ESLint and Prettier are not installed or configured. Code style is inconsistent across files.

---

### MI-04: No Pre-commit Hooks
**Severity**: MEDIUM

No Husky + lint-staged to enforce code quality before commit.

---

### MI-05: No API Documentation
**Severity**: MEDIUM

No OpenAPI / Swagger spec. External developers (frontend, mobile) must read source code to understand API contracts.

---

### MI-06: No Monitoring or Alerting
**Severity**: HIGH (when live)

No Sentry for error tracking, no Prometheus/Datadog for metrics, no uptime monitoring. Production failures will be discovered by customers, not engineers.

---

### MI-07: Health Check Endpoint Too Shallow
**Severity**: MEDIUM  
**File**: `integration-tests/http/health.spec.ts`

The only test is `GET /health` returns 200. The health endpoint does not check:
- Database connectivity
- Redis connectivity
- Razorpay API reachability

A deployment with a broken database passes the health check.

---

## TESTING DEBT

### TD-01: <1% Test Coverage
**Severity**: CRITICAL

Only a single integration test exists (`GET /health`). The entire auth system, checkout flow, and payment integration are untested. This is the highest-risk form of technical debt: changes break silently.

**Target**: 80% coverage on critical paths (auth, checkout, payment)

---

### TD-02: No Auth Tests
No test for:
- OTP rate limiting behavior
- OTP expiry
- Customer creation on first verify
- Customer retrieval on subsequent verifies
- Duplicate customer protection

---

### TD-03: No Checkout Tests
No test for:
- Razorpay order creation
- Payment signature verification (valid and invalid)
- Checkout complete (success, failure, duplicate)

---

### TD-04: No Security Tests
No automated security scanning:
- Snyk for dependency vulnerabilities
- OWASP ZAP for API security
- SQLMap for injection

---

### TD-05: `.env.test` is Empty
Tests run against whatever `.env` is in the environment, including potentially production databases.

---

## SECURITY DEBT

(See also BUG_REPORT.md for exploitable issues)

### SEC-01: No Secrets Management
Secrets are managed via `.env` files. No Vault, AWS Secrets Manager, or equivalent. Secret rotation requires SSH access to every server.

### SEC-02: No Dependency Audit
`npm audit` has not been run. Some of the 600+ transitive dependencies may have known CVEs.

### SEC-03: No Content Security Policy
No CSP headers configured. When frontend is added, XSS attacks have no mitigation layer.

### SEC-04: No Security Headers Middleware
Missing: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`.

---

## DEPENDENCY DEBT

| Package | Required For | Priority |
|---------|-------------|---------|
| `bcrypt` or `argon2` | Password hashing | CRITICAL |
| `resend` | Email OTP delivery | CRITICAL |
| `zod` | Input validation | HIGH |
| `pino` | Structured logging | HIGH |
| `twilio` | SMS reliability | HIGH |
| `@sentry/node` | Error tracking | HIGH |
| `envalid` | Env validation | MEDIUM |
| `eslint` + `@typescript-eslint` | Code linting | MEDIUM |
| `prettier` | Code formatting | MEDIUM |
| `husky` + `lint-staged` | Pre-commit hooks | MEDIUM |
| `bullmq` | Async job queue | LOW (now), CRITICAL (at scale) |
| `swagger-ui-express` | API docs | MEDIUM |

---

## DEBT PRIORITY MATRIX

| Debt Item | Impact | Effort | Fix First? |
|-----------|--------|--------|-----------|
| No test coverage (TD-01) | CRITICAL | HIGH | Yes — start with auth + checkout |
| Business logic in routes (SD-01) | HIGH | MEDIUM | Yes — before adding more routes |
| No Zod validation (SD-03) | HIGH | LOW | Yes — 1-2 days to add |
| console.log logging (CQ-01) | HIGH | LOW | Yes — replace with pino |
| No Docker/CI (MI-01, MI-02) | HIGH | MEDIUM | Yes — blocks team growth |
| Missing dependencies (all) | CRITICAL | LOW | Yes — npm install |
| No error classes (SD-05) | MEDIUM | LOW | Soon |
| Env validation (CQ-02) | HIGH | LOW | Yes |
| Stub files in API (CQ-04) | LOW | LOW | Next cleanup sprint |
| Dead instrumentation.ts (CQ-05) | LOW | LOW | Next cleanup sprint |
