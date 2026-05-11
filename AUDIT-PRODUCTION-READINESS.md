# AUDIT — PRODUCTION READINESS
> Poshakh E-commerce | Date: 2026-05-11 | Branch: master → updated 2026-05-11 fix/phase-1-security-blockers
> Methodology: Static analysis of all route handlers, config files, CI/CD, Docker setup
> ⚠️ CORRECTION: Original audit analyzed backend/.medusa/server/ (old Medusa build artifacts).
> Actual running backend is backend/ (plain Express.js). File references below corrected where applicable.

---

## SCORECARD SUMMARY

| Domain | PASS | PARTIAL | FAIL | Score |
|--------|------|---------|------|-------|
| Security | 7 | 2 | 5 | 🟡 57% |
| Observability | 1 | 1 | 2 | 🔴 37% |
| Reliability | 3 | 1 | 0 | 🟢 87% |
| DevOps | 2 | 0 | 2 | 🟡 50% |
| **Overall** | **13** | **4** | **9** | 🟡 **58%** |

**Not production-ready. 4 CRITICAL blockers remain before any live traffic.**

---

## SECURITY

| # | Check | Status | Evidence | Fix |
|---|-------|--------|----------|-----|
| 1 | JWT secret rotated from default | **FAIL** | `backend/.env:9` → `JWT_SECRET=change-this-to-a-random-secret-before-deploying` | Generate 32-byte secret: `openssl rand -hex 32` |
| 2 | CORS locked to production domains | **PASS** | `medusa-config.js:11–13` — uses `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` env vars | Verify env vars contain real production domains in deploy |
| 3 | Brute-force protection on auth | **PASS** | `otp-store.js:37–39` — OTP send rate-limited (60s). `verify-otp.js:18–22` — MAX_ATTEMPTS=5. `routes/customers.js:158` — `authLimiter` (5 req/15min) applied directly to `POST /login`, `/signup`, `/forgot-password`, `/reset-password` | ✓ Complete coverage |
| 4 | Input validation (Zod) on all POST routes | **PASS** | `src/validators/auth.schemas.js` + `checkout.schemas.js` — all POST routes covered via `safeParse()` | ✓ Complete coverage |
| 5 | Razorpay replay attack protection | **PASS** | `verify-payment.js:20–24` — Redis dedup key `verified_payment:{paymentId}` with 30-day TTL + `timingSafeEqual` HMAC | ✓ Implemented |
| 6 | OTP encrypted at rest in Redis | **FAIL** | `otp-store.js:19–20` — `JSON.stringify(value)` stored plaintext — Redis access = all OTPs exposed | Encrypt OTP before store: `crypto.createCipheriv` with app secret |
| 7 | Request size limits configured | **PASS** | `server.js:129,133` — `express.json({ limit: "10mb" })` and `express.urlencoded({ limit: "10mb" })` both configured; webhook route bypassed intentionally for raw body | ✓ Configured (10mb limit; reduce to 1mb if no large file uploads expected) |
| 8 | CSRF protection on state-mutating routes | **FAIL** | No CSRF tokens on POST `/signup`, `/login`, `/checkout/complete` | Add CSRF token validation; set `SameSite=Strict` on session cookies |
| 9 | Security headers (CSP, HSTS, X-Frame) | **PARTIAL** | `server.js:72–75` — `helmet()` active: provides X-Frame-Options (DENY), HSTS, X-Content-Type-Options, Referrer-Policy. **CSP explicitly disabled** (`contentSecurityPolicy: false`) | Enable CSP in helmet with appropriate directives; add security headers to `next.config.ts` for frontend |
| 10 | No hardcoded/committed secrets | **PARTIAL** | `docker-compose.yml:25` — `COOKIE_SECRET: ${COOKIE_SECRET}` (env var interpolation, no hardcoded value) ✓ fixed. `.env` file with live Razorpay/SMS keys still a concern — see item 25/Blocker B2 | Rotate all keys; ensure `.env` is in `.gitignore` and not committed |
| 11 | Error responses do not leak stack traces | **PASS** | `handle-error.js:11–12` — Returns generic "An unexpected error occurred" to client; full error logged server-side only | ✓ Safe |
| 12 | Cookie secret has no insecure fallback | **PASS** | `frontend/src/lib/session.ts:3–4` — `if (!SECRET) throw new Error("COOKIE_SECRET environment variable is required")` — hard crash on startup if env missing; no fallback | ✓ Fixed |
| 13 | HTTPS enforced in production | **FAIL** | `frontend/src/app/api/auth/login/route.ts:6` → `API_URL ?? "http://localhost:9000"` — HTTP fallback in production if env missing | Use `envalid` to reject non-HTTPS `API_URL` when `NODE_ENV=production` |
| 14 | Dependency CVEs cleared | **FAIL** | `axios` has **13 HIGH severity CVEs** (prototype pollution, SSRF, DoS, header injection) — no upstream fix in v1.x | Replace `axios` with `undici` or native `fetch`; run `npm audit` in CI |

---

## OBSERVABILITY

| # | Check | Status | Evidence | Fix |
|---|-------|--------|----------|-----|
| 15 | Structured logging (pino/winston) | **PASS** | `src/lib/logger.js` — pino configured with ISO timestamps, service name, log levels; `NODE_ENV=production` → `level='info'` | ✓ Implemented |
| 16 | OpenTelemetry enabled and exporting | **FAIL** | `backend/.medusa/server/instrumentation.js:2–23` — 100% commented out | Uncomment; configure Zipkin/Datadog exporter; add to startup |
| 17 | Error tracking (Sentry) | **FAIL** | `src/config/env.js:19` — `SENTRY_DSN` env var defined but never imported; no Sentry SDK init anywhere | Initialize `@sentry/node` in server entry; wrap error handlers with `captureException()` |
| 18 | `/health` checks DB + Redis | **PARTIAL** | Test mock checks DB only (`health.test.js:15–22`); no actual `/health` route in `src/api` | Implement real `/api/health` endpoint: ping DB + Redis; return 503 if either fails |

---

## RELIABILITY

| # | Check | Status | Evidence | Fix |
|---|-------|--------|----------|-----|
| 19 | Graceful shutdown (SIGTERM handler) | **PASS** | `server.js:232–257` — SIGTERM + SIGINT handlers close HTTP server, call `db.close()`, exit cleanly; unhandledRejection triggers same shutdown path | ✓ Implemented |
| 20 | Razorpay webhook endpoint verified | **PASS** | `src/api/webhooks/razorpay/route.js:12–19` — HMAC signature verified; Redis dedup; handles `payment.captured` + `payment.failed` | ✓ Implemented |
| 21 | Order confirmation sent on checkout | **PARTIAL** | `src/lib/email.js` — OTP and password reset emails implemented. Checkout complete (`complete-order.js:71`) **only logs** — no email sent | Add `sendOrderConfirmationEmail()` call in checkout complete handler |
| 22 | Idempotency on payment endpoints | **PASS** | `complete-checkout.js:19–23` — `Idempotency-Key` header checked; result cached in Redis (60-day TTL) | ✓ Implemented |

---

## DEVOPS

| # | Check | Status | Evidence | Fix |
|---|-------|--------|----------|-----|
| 23 | CI/CD pipeline passing | **PASS** | `.github/workflows/ci.yml` — lint, typecheck, unit tests on PR + push to master; frontend build included | ✓ Configured |
| 24 | Docker / docker-compose for local dev | **PASS** | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` — multi-stage builds, healthchecks defined | ✓ Complete |
| 25 | Secrets in env vars (not committed) | **FAIL** | `.env` file in working directory contains live test keys for Razorpay, Fast2SMS, MSG91 — must not be committed or present on any shared system | Rotate all keys; add `.env` to `.gitignore`; use GitHub Secrets + Vault/AWS SM for production |
| 26 | Dependency vulnerability scan in CI | **FAIL** | `npm audit` not in CI pipeline — 13 known HIGH CVEs in `axios` currently undetected by automation | Add `npm audit --audit-level=high` to CI; configure Dependabot or Snyk |

---

## CRITICAL BLOCKERS (Must fix before production)

These 6 items will cause security incidents or data loss under real traffic:

| Blocker | File | Risk |
|---------|------|------|
| **B1** JWT secret is placeholder | `backend/.env:9` | All JWTs forgeable — complete auth bypass |
| **B2** `.env` committed with live keys | root `.env` | Credential leak — rotate Razorpay, SMS, email keys now |
| **B3** OTP stored plaintext in Redis | `otp-store.js:19–20` | Redis read → all active OTPs exposed → full account takeover |
| **B4** axios with 13 HIGH CVEs | `backend/package.json` | Active SSRF + prototype pollution vulnerabilities in payment/auth flows |
| ~~B5~~ ✓ Login rate limiting | resolved | `authLimiter` applied to `/login` route |
| ~~B6~~ ✓ Cookie secret fallback | resolved | Throws on startup if `COOKIE_SECRET` unset |

---

## HIGH PRIORITY (Fix before first real user)

| Issue | File | Action |
|-------|------|--------|
| OTP not encrypted in Redis | `otp-store.js:19` | Encrypt before store |
| CSP disabled | `server.js:73` | Enable `contentSecurityPolicy` in helmet with appropriate directives |
| No CSP on frontend | `next.config.ts` | Add Content-Security-Policy header in Next.js config |
| No CSRF on state-mutating routes | All POST auth/checkout routes | Add CSRF token middleware |
| No order confirmation email | `checkout/complete/route.js:71` | Call sendOrderConfirmationEmail() |
| No Sentry error tracking | Server entry | Init @sentry/node |
| HTTP fallback in production | `frontend/route.ts:6` | Enforce HTTPS via env validation |
| ~~No graceful shutdown~~ ✓ | resolved `server.js:232–257` | SIGTERM/SIGINT implemented |

---

## WHAT IS ALREADY PRODUCTION-QUALITY

| Feature | File | Notes |
|---------|------|-------|
| Razorpay HMAC verification | `verify-payment.js` | Timing-safe comparison, correct |
| Payment idempotency | `complete-checkout.js` | 60-day Redis cache on Idempotency-Key |
| Razorpay webhook signature + dedup | `webhooks/razorpay/route.js` | Correct pattern |
| CORS via env vars | `medusa-config.js` | Not hardcoded, correct |
| Error message sanitization | `handle-error.js` | Client never sees stack traces |
| Structured logging | `src/lib/logger.js` | pino configured correctly |
| CI/CD pipeline | `.github/workflows/ci.yml` | lint + typecheck + tests on PR |
| Docker setup | `docker-compose.yml` | Multi-stage, healthchecks present |
| Zod input validation | `src/validators/` | All POST routes covered |
| OTP rate limiting + max attempts | `otp-store.js` + `verify-otp.js` | 60s cooldown + 5 attempts |
