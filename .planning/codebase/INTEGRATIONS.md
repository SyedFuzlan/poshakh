# External Integrations

**Analysis Date:** 2026-04-22

---

## Payment Processing

**Razorpay (Active)**
- Purpose: Payment order creation and signature verification for INR checkout
- SDK: `razorpay` npm package v2.9.6 (backend dependency)
- Frontend also loads Razorpay JS SDK dynamically via `<script src="https://checkout.razorpay.com/v1/checkout.js">` in `frontend/src/app/checkout/page.tsx`
- Currency: INR (Indian Rupees — amounts in paise)
- Env vars required (backend):
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
- Implementation files:
  - Order creation: `backend/src/api/store/checkout/create-order/route.ts`
  - Signature verification: `backend/src/api/store/checkout/verify-payment/route.ts`
- Auth method: HMAC-SHA256 signature on `order_id|payment_id`
- Note: Integrated as direct API calls — NOT using a Medusa payment provider plugin. Medusa's payment collection uses `pp_system_default` as a placeholder; Razorpay operates as a parallel flow outside Medusa's payment module.

---

## SMS / OTP

**MSG91 (Active — Flagged as Problematic)**
- Purpose: SMS OTP delivery for phone-based login/signup
- Integration: Direct REST API call (no SDK) at `https://api.msg91.com/api/v5/otp`
- Env vars required (backend):
  - `MSG91_AUTH_KEY`
  - `MSG91_TEMPLATE_ID`
- Implementation: `backend/src/api/store/auth/send-otp/route.ts`
- Status concern: MSG91 has documented reliability issues in certain Indian regions; no SDK — raw HTTP only; no retry logic; no fallback
- Email OTP: Not implemented. A comment in `send-otp/route.ts` notes "Email OTP delivery can be added here (Resend SDK)" — it currently only logs OTP to terminal in non-production environments

---

## OTP State Storage

**Redis via ioredis (Active)**
- Purpose: Temporary OTP storage (10-minute TTL) and rate limiting (60-second window)
- Client: `ioredis` 5.10.1
- Env var (backend): `REDIS_URL` (defaults to `redis://localhost:6379`)
- Implementation files:
  - Client singleton: `backend/src/lib/redis.ts`
  - OTP operations (set, get, delete, rate-limit check): `backend/src/lib/otp-store.ts`
- Key patterns:
  - OTP data: `otp:<identifier>` (TTL: 600 seconds)
  - Rate limit: `otp_sent:<identifier>` (TTL: 60 seconds)

---

## Databases

**PostgreSQL (Active)**
- Purpose: Primary Medusa data store — products, orders, customers, inventory, regions, carts
- Connection: `DATABASE_URL` env var (backend)
- ORM / Client: Medusa's built-in MikroORM layer (abstracted via `@medusajs/framework`)
- Migrations: Managed by Medusa CLI — `medusa build` handles migration generation
- Seed script: `backend/src/scripts/seed.ts` — seeds products, regions, shipping options, API keys, categories
- Config: `backend/medusa-config.ts`
- Region configured: India (`country_code: "in"`, `currency_code: "inr"`)

---

## Authentication & Session

**Custom OTP Auth (No third-party auth provider)**
- Flow: Phone number → MSG91 SMS OTP → Redis verification → Medusa Customer lookup/create → signed HMAC cookie
- Cookie name: `poshakh_token` — HMAC-SHA256 signed, HttpOnly, `sameSite: lax`, 7-day expiry
- Session secret: `MEDUSA_CUSTOMER_SECRET` env var (frontend)
- Session implementation: `frontend/src/lib/session.ts`
- Auth lib: `frontend/src/lib/auth.ts`
- Auth API routes (Next.js):
  - `frontend/src/app/api/otp/send/route.ts` — proxies to Medusa backend
  - `frontend/src/app/api/otp/verify/route.ts` — proxies to Medusa backend, sets cookie
  - `frontend/src/app/api/auth/logout/route.ts` — clears cookie
  - `frontend/src/app/api/auth/me/route.ts` — reads current session
- Auth API routes (Medusa backend):
  - `backend/src/api/store/auth/send-otp/route.ts` — generates OTP, stores in Redis, calls MSG91
  - `backend/src/api/store/auth/verify-otp/route.ts` — verifies OTP, creates/looks up Medusa customer
- Dev bypass: `DEV_TEST_PHONE` + `DEV_TEST_OTP` env vars in frontend skip MSG91 entirely for local testing

---

## Medusa Headless Commerce API

**Medusa JS SDK (Active)**
- Purpose: Frontend → Medusa backend communication for products, cart, regions, shipping options
- Client: `@medusajs/js-sdk` 2.13.6
- Instantiated at: `frontend/src/lib/medusa.ts`
- Base URL env var (frontend): `NEXT_PUBLIC_MEDUSA_BACKEND_URL` (defaults to `http://localhost:9000`)
- Publishable key env vars (frontend):
  - `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (client-side)
  - `MEDUSA_BACKEND_URL` + `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (server-side routes)
- Related lib files:
  - `frontend/src/lib/products.ts` — product fetching via raw fetch to Medusa REST
  - `frontend/src/lib/cart.ts` — cart CRUD via raw fetch to Medusa REST

---

## File Storage

**Not configured**
- Medusa's file module is not configured in `backend/medusa-config.ts`
- No Cloudinary, Supabase Storage, or S3 dependency detected
- Product images served from `localhost:9000` in development (allowed via `frontend/next.config.ts` image remote patterns)
- Wildcard HTTPS (`**`) is also allowed, suggesting future CDN/storage URLs are anticipated

---

## Email

**Not implemented**
- No email provider SDK installed (no Resend, SendGrid, Nodemailer, etc.)
- A comment in `backend/src/api/store/auth/send-otp/route.ts` explicitly notes Resend SDK as the intended solution for email OTP
- Transactional emails (order confirmation, shipping) are not present

---

## Admin UI

**Medusa Admin (Built-in)**
- Package: `@medusajs/admin-sdk` 2.13.6 + `@medusajs/ui` 4.1.6
- Hosted by Medusa server at `/app` route (default Medusa behaviour)
- Custom admin route stub: `backend/src/api/admin/custom/route.ts`
- i18n stub: `backend/src/admin/i18n/index.ts`

---

## CORS Configuration

**Backend CORS** (all set via env vars in `backend/medusa-config.ts`):
- `STORE_CORS` — allowed origins for store API
- `ADMIN_CORS` — allowed origins for admin API
- `AUTH_CORS` — allowed origins for auth endpoints
- `JWT_SECRET` — JWT signing secret
- `COOKIE_SECRET` — cookie signing secret

---

## Webhooks

**Incoming:** None detected
**Outgoing:** None detected

---

## Monitoring & Observability

**Error Tracking:** None installed — no Sentry, Datadog, or similar
**Logging:** `console.log` / `console.error` throughout — Medusa's built-in logger used in seed script
**Analytics:** Not configured

---

## CI/CD

**No CI/CD pipeline detected** — no `.github/workflows/`, `railway.json`, `vercel.json`, or `Dockerfile` found in repository root.

---

## Environment Variable Summary

### Backend (`backend/.env`)
| Variable | Used By | Purpose |
|---|---|---|
| `DATABASE_URL` | Medusa core | PostgreSQL connection string |
| `REDIS_URL` | `src/lib/redis.ts` | Redis connection for OTP store |
| `JWT_SECRET` | Medusa core | JWT token signing |
| `COOKIE_SECRET` | Medusa core | Cookie signing |
| `STORE_CORS` | Medusa core | Allowed origins for store API |
| `ADMIN_CORS` | Medusa core | Allowed origins for admin API |
| `AUTH_CORS` | Medusa core | Allowed origins for auth API |
| `MSG91_AUTH_KEY` | `send-otp/route.ts` | MSG91 API authentication |
| `MSG91_TEMPLATE_ID` | `send-otp/route.ts` | MSG91 OTP SMS template |
| `RAZORPAY_KEY_ID` | `create-order/route.ts` | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | `create-order/route.ts`, `verify-payment/route.ts` | Razorpay private key |

### Frontend (`frontend/.env.local`)
| Variable | Used By | Purpose |
|---|---|---|
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | `src/lib/medusa.ts`, `src/lib/cart.ts`, `src/app/checkout/page.tsx` | Public Medusa base URL |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | `src/lib/medusa.ts`, `src/lib/cart.ts`, `src/lib/products.ts` | Medusa publishable API key |
| `MEDUSA_BACKEND_URL` | Server-side API routes (`/api/otp/*`, `/api/auth/*`, `src/lib/products.ts`) | Server-side Medusa base URL |
| `MEDUSA_CUSTOMER_SECRET` | `src/lib/session.ts` | HMAC secret for signed session cookie |
| `DEV_TEST_PHONE` | `src/app/api/otp/send/route.ts`, `src/app/api/otp/verify/route.ts` | Dev bypass phone number |
| `DEV_TEST_OTP` | `src/app/api/otp/verify/route.ts` | Dev bypass OTP code |

---

*Integration audit: 2026-04-22*
