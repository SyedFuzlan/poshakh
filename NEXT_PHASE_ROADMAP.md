> ⚠️ **ARCHIVED — 2026-04-29**
> Medusa.js has been removed. This roadmap was written for the Medusa backend and is entirely obsolete. Do not act on this document. Current next steps are in **PROGRESS.md**.

---

# NEXT PHASE ROADMAP — POSHAKH
> Engineering execution plan from current state (~35%) to production-ready v1  
> Date: 2026-04-25 | Horizon: 3 phases

---

## CURRENT STATE SNAPSHOT

**What works today (backend only)**:
- Medusa v2 initialized with 9 products, 4 categories, INR pricing
- OTP-based phone authentication (MSG91 SMS)
- Razorpay payment integration (create order + HMAC verification)
- Checkout workflow (address → shipping → payment → order)

**What is missing**:
- Entire frontend (empty directory)
- Password-based auth + email OTP
- Razorpay webhook (server-side payment confirmation)
- Brute-force protection
- Observability, logging, testing
- Production infrastructure

---

## PHASE 1 — SECURITY & BACKEND HARDENING
**Goal**: Make the existing backend production-safe before building more  
**Duration**: ~2 weeks  
**Owner**: Backend engineer

### 1.1 Fix Critical Bugs (Week 1, Days 1–3)

**BUG-001: OTP Brute-Force**
- Add `otp_attempts:{identifier}` counter in Redis (max 5, then invalidate OTP)
- Add per-IP rate limiting middleware (10 req/min on `/verify-otp`)
- Files: `src/api/store/auth/verify-otp/route.ts`, `src/lib/otp-store.ts`

**BUG-002: Hardcoded Secrets**
- Replace `supersecret` in `.env.template` with `CHANGE_ME_GENERATE_WITH_openssl_rand_base64_32`
- Add startup validation using `envalid` or `zod` — fail fast if defaults detected
- Files: `.env.template`, new `src/config/env.ts`

**BUG-003: Payment Signature Replay**
- Store verified `payment_id` in Redis with 30-day TTL
- Reject duplicate payment IDs with 409 Conflict
- Files: `src/api/store/checkout/verify-payment/route.ts`

**BUG-004: Duplicate Orders**
- Accept `Idempotency-Key` header in `/checkout/complete`
- Cache response in Redis keyed by idempotency key (24hr TTL)
- Files: `src/api/store/checkout/complete/route.ts`

**BUG-008: Phone Number in Fallback Email**
- Generate `cust_{uuid}@noreply.poshakh.in` instead of `{phone}@poshakh.in`
- Files: `src/api/store/auth/verify-otp/route.ts`

---

### 1.2 Install Required Dependencies (Week 1, Day 3)

```bash
cd backend
npm install bcrypt resend zod pino twilio envalid @sentry/node
npm install --save-dev @types/bcrypt eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier husky lint-staged
```

---

### 1.3 Structured Logging (Week 1, Days 4–5)

- Install `pino` + `pino-http`
- Create `src/lib/logger.ts` singleton
- Replace all `console.log` / `console.error` with logger calls
- Add request ID propagation: `x-request-id` header in → all log entries
- Log fields: `{ requestId, method, path, statusCode, duration, userId?, error? }`

---

### 1.4 Input Validation Layer (Week 1, Days 4–5)

- Create `src/validators/` directory with Zod schemas per endpoint:
  - `auth.schemas.ts` — send-otp, verify-otp
  - `checkout.schemas.ts` — create-order, verify-payment, complete
- Validate at route entry; return 422 with field-level errors
- Never trust client-provided `amount_in_rupees` — derive from cart server-side (BUG-013)

---

### 1.5 Auth System Rebuild — Password Support (Week 2)

**Goal**: Replace OTP-only auth with full username/password + OTP verification

**New endpoints**:
```
POST /store/auth/signup       → name, email, phone, password → send email OTP → pending state
POST /store/auth/verify-email → OTP → activate account
POST /store/auth/login        → email/phone + password → session
POST /store/auth/forgot-password → identifier → send reset OTP
POST /store/auth/reset-password  → OTP + new password → update hash
GET  /store/auth/me           → current session customer
POST /store/auth/logout       → clear session
```

**Implementation**:
- Add `password_hash` and `email_verified` to customer record (via Medusa custom module or direct extension)
- Use `bcrypt` (cost factor 12) for password hashing
- Use `resend` for email OTP delivery (transactional template)
- OTP on signup: 6-digit code, 10-minute TTL, 5 attempt limit (already in otp-store.ts after 1.1)
- Keep existing phone OTP as alternative login method

**New service layer**:
```
src/services/auth.service.ts    ← signup, login, password hash/verify, session
src/services/otp.service.ts     ← send OTP (phone or email), verify, rate-limit
src/services/customer.service.ts ← create, find, update customer
```

---

### 1.6 Razorpay Webhook (Week 2)

```
POST /webhooks/razorpay
```
- Verify `X-Razorpay-Signature` header using webhook secret
- On `payment.captured`: run checkout complete workflow if not already done
- On `payment.failed`: release cart lock, notify customer
- Idempotency: check if order already exists for this payment ID
- Required env var: `RAZORPAY_WEBHOOK_SECRET`

---

### 1.7 Error Handling Middleware (Week 2)

- Create `src/middleware/error.middleware.ts`
- Catch all unhandled errors in one place
- Map error classes to HTTP codes
- Log full error server-side; return sanitized message to client
- Integrate Sentry for error tracking

---

### Phase 1 Deliverables
- [ ] All 4 critical bugs resolved
- [ ] Password auth endpoints live
- [ ] Email OTP via Resend working
- [ ] Razorpay webhook live
- [ ] Pino structured logging
- [ ] Zod input validation on all routes
- [ ] Sentry error tracking
- [ ] Pre-commit hooks (ESLint + Prettier + TypeScript check)
- [ ] Brute-force protection on auth

---

## PHASE 2 — FRONTEND REBUILD
**Goal**: Functional storefront from product browse to order confirmation  
**Duration**: ~4 weeks  
**Owner**: Frontend engineer

### 2.1 Project Setup (Week 1, Days 1–2)

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app --src-dir
npm install @medusajs/js-sdk @tanstack/react-query react-hook-form zod @hookform/resolvers zustand
```

- Use Next.js App Router with TypeScript
- Tailwind CSS for styling (mobile-first)
- Zustand for cart state
- TanStack Query for server state
- React Hook Form + Zod for form validation
- Medusa JS SDK for API calls

---

### 2.2 Authentication Pages (Week 1)

- `/auth/signup` — Name, email, phone, password form
- `/auth/verify-otp` — OTP input (6 digits)
- `/auth/login` — Email/phone + password
- `/auth/forgot-password` — Identifier input
- `/auth/reset-password` — OTP + new password
- Protected route middleware (redirect unauthenticated users)

---

### 2.3 Product Catalog (Week 1–2)

- `/` (homepage) — Hero banner, featured categories, new arrivals
- `/categories/[slug]` — Category listing with filters (size, price range)
- `/products/[handle]` — Product detail: images, size selector, description, add to cart
- Pagination (infinite scroll or numbered)
- Skeleton loaders for all async states

---

### 2.4 Cart & Checkout (Week 2–3)

- Cart drawer/sidebar (Zustand-managed, persisted to Medusa cart API)
- `/checkout` — Multi-step:
  1. **Address** — Form with saved addresses (if logged in)
  2. **Shipping** — Standard (₹99) or Express (₹199)
  3. **Payment** — Razorpay widget integration
  4. **Confirmation** — Order summary + order number

- Razorpay JS SDK integration (client-side)
- After Razorpay success: call `/checkout/verify-payment` then `/checkout/complete`
- Handle payment failure gracefully (retry without re-creating cart)

---

### 2.5 User Account Pages (Week 3)

- `/account` — Profile overview
- `/account/orders` — Order history list
- `/account/orders/[id]` — Order detail + status
- `/account/addresses` — Saved address book (add, edit, delete, set default)
- `/account/profile` — Edit name, email, phone, change password

---

### 2.6 Search & Filters (Week 3–4)

- Header search bar → `/search?q=...`
- Client-side filter panel (category, price, size)
- Sort by: price asc/desc, newest
- URL-persisted filters (shareable links)

---

### 2.7 Performance & UX (Week 4)

- Next.js Image component for all product images
- Lazy loading for below-the-fold content
- Route prefetching for product links
- Empty states, error boundaries, loading skeletons
- Mobile-responsive nav (hamburger menu)
- SEO: `<title>`, `<meta description>`, OG tags per page
- Analytics: GA4 or Posthog

---

### Phase 2 Deliverables
- [ ] Auth flow (signup → OTP verify → login → logout)
- [ ] Product browse + detail pages
- [ ] Working cart
- [ ] Full checkout with Razorpay
- [ ] Order history and profile
- [ ] Product search with filters
- [ ] Mobile-responsive across all pages
- [ ] Lighthouse score ≥ 80 on mobile

---

## PHASE 3 — PRODUCTION HARDENING & LAUNCH
**Goal**: Infrastructure, observability, and operational readiness  
**Duration**: ~2 weeks  
**Owner**: DevOps + Backend

### 3.1 Docker & Local Development (Week 1, Days 1–2)

```yaml
# docker-compose.yml
services:
  api:
    build: ./backend
    env_file: .env
    depends_on: [postgres, redis]
  frontend:
    build: ./frontend
    env_file: .env.frontend
  postgres:
    image: postgres:16-alpine
  redis:
    image: redis:7-alpine
```

---

### 3.2 CI/CD Pipeline (Week 1, Days 2–4)

```yaml
# .github/workflows/ci.yml
on: [pull_request]
jobs:
  backend:
    - npm ci
    - eslint
    - tsc --noEmit
    - jest (unit + integration)
  frontend:
    - npm ci
    - eslint
    - tsc --noEmit
    - next build (type check + build verification)
```

Deployment targets:
- Backend: Railway or Render (simple managed Node hosting)
- Frontend: Vercel (Next.js native)
- Database: Railway PostgreSQL or Supabase
- Redis: Upstash (serverless Redis, no ops)

---

### 3.3 Test Coverage Campaign (Week 1)

**Backend — target 80% on critical paths**:
- Auth: OTP send, OTP verify, rate limiting, brute-force protection, signup, login, reset
- Checkout: order creation, payment verification, checkout complete, webhook
- Edge cases: duplicate customers, expired OTPs, invalid signatures

**Frontend — E2E with Playwright**:
- Happy path: signup → browse → add to cart → checkout → order confirmation
- Auth flows: login, forgot password, session expiry

---

### 3.4 Production Security Hardening (Week 1–2)

- HTTPS enforced (Vercel/Railway handle TLS)
- Security headers middleware: `X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `CSP`
- CORS locked to production domains only
- Rate limiting on all public endpoints (API gateway or express-rate-limit)
- `npm audit` — resolve all HIGH/CRITICAL CVEs
- Secrets moved to Railway/Vercel environment variables (not .env files)
- Add `Dependabot` for automated dependency updates

---

### 3.5 Observability Stack (Week 2)

```
Logging:   Pino → log shipping (Railway logs / Papertrail)
Errors:    Sentry (already wired in Phase 1)
Uptime:    Better Uptime or UptimeRobot (5-minute checks on /health)
APM:       OpenTelemetry → Sentry Performance (re-enable instrumentation.ts)
```

Enhanced `/health` endpoint:
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "version": "1.0.0",
  "uptime": 84600
}
```

---

### 3.6 Admin Panel Enhancements (Week 2)

- Medusa admin default features: products, orders, customers, inventory
- Custom admin widget: daily revenue summary
- Custom admin route: OTP audit log (view who sent/verified OTPs)
- Order fulfillment: mark shipped + add tracking number field

---

### 3.7 Soft Launch Checklist

- [ ] All CRITICAL and HIGH bugs from BUG_REPORT.md resolved
- [ ] Password auth live and tested
- [ ] Razorpay webhook live
- [ ] Sentry error tracking live
- [ ] Uptime monitoring configured
- [ ] Production env vars rotated (new JWT/cookie secrets)
- [ ] CORS locked to production domains
- [ ] Database backed up (automated daily)
- [ ] Load test: 100 concurrent users on checkout flow
- [ ] Manual QA: full purchase flow on mobile
- [ ] Admin onboarding: at least one admin user created

---

## POST-LAUNCH BACKLOG (v1.1+)

Ordered by business value:

| Priority | Feature | Effort | Revenue Impact |
|----------|---------|--------|---------------|
| 1 | Order notifications (email + SMS) | LOW | HIGH (reduces "where is my order") |
| 2 | Return / refund flow | MEDIUM | HIGH (trust builder) |
| 3 | Coupon codes | MEDIUM | HIGH (conversion) |
| 4 | Cash on Delivery option | LOW | HIGH (India-specific) |
| 5 | Product reviews | MEDIUM | MEDIUM (social proof) |
| 6 | Wishlist | LOW | MEDIUM (retention) |
| 7 | Google OAuth login | LOW | MEDIUM (conversion) |
| 8 | Hindi language support | HIGH | MEDIUM (tier-2/3 cities) |
| 9 | MeiliSearch integration | MEDIUM | MEDIUM (discovery) |
| 10 | PWA / mobile app | HIGH | HIGH (long-term) |

---

## SUMMARY TIMELINE

```
Week 1–2  (Phase 1): Security hardening, auth rebuild, webhook, logging
Week 3–6  (Phase 2): Frontend — auth, catalog, cart, checkout, profile
Week 7–8  (Phase 3): Docker, CI/CD, testing, production deploy, launch
```

**Total to v1 launch: ~8 weeks (2 engineers)**

---

## RISK LOG

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| MSG91 reliability causes OTP failures at launch | HIGH | HIGH | Replace with Twilio Verify in Phase 1 |
| Razorpay webhook not received (network/timeout) | MEDIUM | HIGH | Implement retry + reconciliation job |
| Frontend rebuild takes longer than estimated | MEDIUM | MEDIUM | Use Medusa's Next.js starter as base |
| Password auth design conflicts with Medusa auth module | LOW | HIGH | Spike Medusa auth provider API first |
| Redis single-point-of-failure in production | MEDIUM | HIGH | Use Upstash (managed, HA by default) |
| Low test coverage causes regression on launch | HIGH | HIGH | Write tests before any new code in Phase 1 |
