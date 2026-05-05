# PROJECT ANALYSIS — POSHAKH
> CTO + Senior Engineer + Architect Perspective  
> Date: 2026-04-25 | Branch: master | Commit: 3a28675

---

## 1. PROJECT OVERVIEW

**Poshakh** is an Indian fashion e-commerce platform selling sarees, salwar kameez, lehengas, and gowns. The backend is built on **Medusa.js v2** (headless commerce framework). The frontend was deleted and the directory is now empty.

---

## 2. CURRENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                        POSHAKH PLATFORM                         │
├────────────────────┬────────────────────┬───────────────────────┤
│    FRONTEND        │     BACKEND         │     INFRASTRUCTURE    │
│    (MISSING)       │   Medusa.js v2      │                       │
│                    │   Node 20+          │  Redis (OTP store)    │
│    Next.js 16      │   TypeScript 5.6    │  PostgreSQL/SQLite    │
│    (empty dir)     │   Port 9000         │  MSG91 (SMS)          │
│                    │                     │  Razorpay (payments)  │
└────────────────────┴────────────────────┴───────────────────────┘
```

### Backend Layer (Only Active Layer)

```
backend/src/
├── api/
│   ├── store/auth/send-otp        ← Phone OTP dispatch (MSG91)
│   ├── store/auth/verify-otp      ← OTP verification + customer creation
│   ├── store/checkout/create-order ← Razorpay order creation
│   ├── store/checkout/verify-payment ← HMAC signature verification
│   ├── store/checkout/complete    ← Cart → Order workflow
│   ├── store/custom               ← STUB (200 only)
│   └── admin/custom               ← STUB (200 only)
├── lib/
│   ├── redis.ts                   ← Singleton Redis client
│   └── otp-store.ts               ← Redis-backed OTP CRUD
└── scripts/
    └── seed.ts                    ← 9 products, 4 categories, INR pricing
```

---

## 3. TECHNOLOGY STACK

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Backend Framework | Medusa.js | v2.13.6 | Active |
| Language | TypeScript | v5.6.2 | Active |
| Runtime | Node.js | >=20 | Active |
| ORM | MikroORM | (via Medusa) | Active |
| Database | PostgreSQL / SQLite | Not configured | Missing URL |
| Cache / OTP | Redis (ioredis) | v5.10.1 | Active |
| Payments | Razorpay SDK | v2.9.6 | Active |
| SMS | MSG91 (REST) | - | Unreliable |
| Email OTP | Resend SDK | NOT INSTALLED | Stubbed |
| Frontend | Next.js | 16 | Missing (empty dir) |
| Admin UI | Medusa Admin SDK | v2.13.6 | Empty |
| Build | SWC + TypeScript | - | Active |
| Testing | Jest | v29.7.0 | <1% coverage |
| Observability | OpenTelemetry | Commented out | Disabled |

---

## 4. PROJECT MATURITY LEVEL

**Overall: ~35–40% complete**

| Domain | Completion | Notes |
|--------|-----------|-------|
| Core commerce (products, cart, checkout) | 60% | Works in backend; no frontend to drive it |
| Authentication | 30% | OTP works; password system not started |
| Frontend | 0% | Deleted entirely |
| Admin customizations | 5% | Stubs only |
| DevOps / Infrastructure | 10% | Health check exists; nothing else |
| Observability | 0% | OpenTelemetry commented out |
| Security hardening | 15% | Razorpay HMAC is good; auth is not |
| Test coverage | <1% | One health check test |
| Documentation | 20% | ai-brain/ mostly empty |

---

## 5. COMPLETED MODULES

| Module | File(s) | Notes |
|--------|---------|-------|
| OTP Send (phone) | `api/store/auth/send-otp/route.ts` | MSG91 SMS delivery |
| OTP Verify + Customer Create | `api/store/auth/verify-otp/route.ts` | Single-use OTP; creates customer |
| Redis OTP Store | `lib/otp-store.ts` + `lib/redis.ts` | TTL + rate-limit logic |
| Razorpay Order Creation | `api/store/checkout/create-order/route.ts` | INR → paise, receipt ID |
| Payment Signature Verification | `api/store/checkout/verify-payment/route.ts` | HMAC-SHA256 validated |
| Checkout Completion Workflow | `api/store/checkout/complete/route.ts` | Address → shipping → payment → order |
| Product + Category Seeding | `scripts/seed.ts` | 9 products, 4 categories, 2 shipping options |
| Medusa Core (products, orders, regions, inventory) | Medusa v2 internals | Standard Medusa behavior |

---

## 6. INCOMPLETE MODULES

| Module | Status | Blocker |
|--------|--------|---------|
| Password-based auth | Not started | No bcrypt/argon2 installed; no password field |
| Email OTP delivery | Stubbed | Resend SDK not installed |
| Forgot password / reset flow | Not started | Depends on email OTP + password |
| Admin dashboard customizations | Empty stubs | Low priority; design not defined |
| Custom Medusa modules | README only | Not scoped |
| Event subscribers | README only | Not scoped |
| Scheduled jobs | README only | Not scoped |
| Module links | README only | Not scoped |
| Workflows | README only | Not scoped |

---

## 7. MISSING FEATURES (Summary)

> Full detail in MISSING_FEATURES.md

- **Frontend**: Entire Next.js application missing
- **Password Auth**: Signup form, login, forgot-password, reset-password
- **Email OTP**: Resend-based delivery
- **Email Verification**: Verification flow after signup
- **Brute-Force Protection**: Login attempt limits, account lockout
- **Order Management**: Order history, returns, cancellations
- **User Profile**: Address book, saved payment methods
- **Search**: Product search and filters
- **Wishlist**: Not started
- **Reviews**: Not started
- **Admin Workflows**: Inventory management, order fulfillment, analytics
- **Webhooks**: Razorpay payment confirmation webhooks
- **Notifications**: Order confirmation emails / SMS
- **API Documentation**: No Swagger / OpenAPI spec

---

## 8. WHERE DEVELOPMENT STOPPED

Development appears to have stopped at the **end of Phase 1 backend**:

1. Razorpay payment integration was completed and tested.
2. OTP authentication was implemented (phone-only, MSG91).
3. Checkout workflow was wired together with Medusa core workflows.
4. The **auth rebuild** (adding passwords, email OTP, forgot-password) was identified as the next priority in `ai-brain/PROJECT_STATUS.md` but **no code was written**.
5. The frontend was **deleted** (commit `3a28675`), resetting frontend to zero.
6. All Medusa extension points (modules, subscribers, jobs, workflows) remain as empty README stubs.

The last concrete engineering decision was to rebuild the auth system with password support, install Resend for email OTP, and replace or supplement MSG91 with Twilio. That work was not started.

---

## 9. SCALABILITY ISSUES

| Issue | Severity | Location |
|-------|----------|---------|
| Single Redis instance (no HA) | High | `lib/redis.ts` |
| No DB connection pool config | High | `medusa-config.ts` |
| No async job queue for order processing | Medium | `checkout/complete/route.ts` |
| Sequential workflow execution in checkout | Medium | `checkout/complete/route.ts` |
| No caching for product/customer queries | Medium | All store routes |
| No CDN for static assets | Low | (frontend missing anyway) |
| No API rate limiting gateway | High | All routes |
| MSG91 as single SMS provider | High | `send-otp/route.ts` |

---

## 10. OUTDATED PATTERNS

| Pattern | Issue | Recommendation |
|---------|-------|---------------|
| `console.log` for all logging | Not queryable, not structured | Replace with `pino` or `winston` |
| `process.env` inline reads | No validation at startup | Use `envalid` or `zod` for env schema |
| Manual fetch() to MSG91 | Fragile, no retries | Use Twilio Verify SDK or `got` with retries |
| Hardcoded `country_code: "in"` | Not extensible | Accept from request or resolve from region |
| Error messages returned raw in 500 responses | Information leakage | Centralize error handling middleware |
| No shared middleware layer | Code duplication | Extract auth/validation middleware |

---

## 11. MISSING PRODUCTION-LEVEL PRACTICES

- No structured logging (pino / winston)
- No distributed tracing (OpenTelemetry commented out)
- No metrics collection (Prometheus / Datadog)
- No error tracking (Sentry)
- No CI/CD pipeline (GitHub Actions, Vercel, Railway)
- No Docker / docker-compose for local dev
- No database migrations versioning system (beyond Medusa defaults)
- No secrets management (Vault, AWS Secrets Manager)
- No API versioning strategy
- No graceful shutdown handling
- No health check for database or Redis (only generic `/health`)
- No dependency vulnerability scanning (Snyk, Dependabot)
- No API documentation (Swagger / OpenAPI)
- No pre-commit hooks (Husky + lint-staged)
- No code formatting (Prettier)
- No linting (ESLint)

---

## 12. FOLDER STRUCTURE WEAKNESSES

```
Current (weak):
backend/src/
├── api/           ← route handlers only, no separation of concerns
├── lib/           ← utility only
├── scripts/       ← seeding only
└── [empty stubs]  ← jobs, modules, subscribers, workflows, links

Missing layers:
├── services/      ← business logic (should not live in route handlers)
├── validators/    ← request validation schemas (Zod)
├── middleware/    ← auth guards, rate limiters, CORS
├── types/         ← shared TypeScript interfaces
├── constants/     ← app-wide constants
├── utils/         ← helper functions
└── errors/        ← custom error classes
```

Business logic is currently embedded inside route handlers — making routes difficult to test, extend, or reuse. The checkout route (`complete/route.ts`) is 83 lines of orchestration logic that should be a workflow or service.

---

## 13. TECHNICAL DEBT SUMMARY

> Full detail in TECH_DEBT.md

- Auth route handlers contain business logic (violates SRP)
- No input validation library (manual type guards only)
- No error handling middleware (each route handles errors independently)
- MSG91 integration uses raw `fetch()` without retry or circuit-breaker
- OTP not encrypted at rest in Redis
- Hardcoded secrets in `.env.template`
- Empty admin/custom and store/custom stubs committed with no purpose
- `instrumentation.ts` committed but entirely commented out
- Test infrastructure set up but no tests written (technical confidence illusion)
- `ai-brain/` directory structure created but all subdirectories empty

---

## 14. SECURITY POSTURE

| Control | Status |
|---------|--------|
| HMAC payment signature verification | ✓ Implemented |
| Redis OTP with TTL | ✓ Implemented |
| OTP rate limiting (60s per identifier) | ✓ Implemented |
| CORS configuration | ⚠ Dev-only values in template |
| JWT/Cookie secrets | ✗ Hardcoded `supersecret` in template |
| Brute-force protection (auth) | ✗ Missing |
| Input validation / schema enforcement | ✗ Missing |
| CSRF protection | ✗ Missing |
| API-level rate limiting | ✗ Missing |
| Request size limits | ✗ Missing |
| Signature replay protection (Razorpay) | ✗ Missing |
| Password hashing | ✗ Not implemented (no library installed) |
| OTP encryption at rest (Redis) | ✗ Missing |
| Audit logging | ✗ Missing |
| Secrets management | ✗ Missing |

---

## 15. DEPENDENCY GAPS

| Required For | Dependency | Installed |
|-------------|-----------|---------|
| Email OTP | `resend` | ✗ |
| Password hashing | `bcrypt` or `argon2` | ✗ |
| Input validation | `zod` or `joi` | ✗ |
| Structured logging | `pino` | ✗ |
| Error tracking | `@sentry/node` | ✗ |
| SMS backup provider | `twilio` | ✗ |
| Env validation | `envalid` | ✗ |
| Rate limiting | `@fastify/rate-limit` or custom | ✗ |
| Idempotency keys | Custom implementation | ✗ |
| API documentation | `@medusajs/openapi` or Swagger | ✗ |
