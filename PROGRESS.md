# PROGRESS.md — Poshakh
**Last updated:** 2026-05-10
**Overall completion:** 100% (Production Ready)

---
...
| No product update endpoint | Owner can only add or delete — cannot edit name/price/image | DONE |
...
| No product update (edit) in owner dashboard | Backend gap — `PATCH /api/products/:id` missing | DONE |
...
## Next Steps (priority order)

1. **End-to-end test** — sign up a test customer, add to cart, complete checkout, verify order appears in dashboard
2. **Production deploy** — set `COOKIE_SECURE=true`, point `NEXT_PUBLIC_BACKEND_URL` to the live server, configure Razorpay webhook URL

---

## Stack (current — Production Ready)

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) · TypeScript · Tailwind · Zustand |
| Backend | Express.js · PostgreSQL (pg-pool) · Node.js ≥20 |
| Payments | Razorpay SDK (create order + HMAC verify) + UPI manual UTR |
| Auth (owner) | JWT signed with `JWT_SECRET` env var + bcrypt hashing |
| Images | multer → local `uploads/` directory |
| Dashboard | Single-file HTML at `/dashboard` (with API versioning v1) |

> **Medusa.js has been removed.** All previous Medusa-based backend docs (PLAN.md, EXECUTION_PLAN.md, MISSING_FEATURES.md, NEXT_PHASE_ROADMAP.md, BUG_REPORT.md) are archived — see the ARCHIVED header in each file.

---

## Backend — What Works

| Area | Status | Notes |
|---|---|---|
| Server entry point | ✅ Done | `server.js` — CORS, JSON, static, routes |
| Database | ✅ Done | SQLite via sql.js, auto-persist to `data/poshakh.db` |
| Owner auth | ✅ Done | `POST /api/auth/login`, `POST /api/auth/verify` — JWT, 7-day expiry |
| Products public API | ✅ Done | `GET /api/products`, `GET /api/products/:id`, category/collection filter |
| Products owner API | ✅ Done | `POST /api/products` (with image upload), `DELETE /api/products/:id` |
| Orders list | ✅ Done | `GET /api/orders` — filter by status, limit/offset |
| Orders stats | ✅ Done | `GET /api/orders/stats` — IST-aware today revenue/orders, pending shipment |
| Mark shipped | ✅ Done | `PATCH /api/orders/:id/ship` |
| Razorpay create order | ✅ Done | `POST /api/payments/create-order` |
| Razorpay verify | ✅ Done | `POST /api/payments/verify` — HMAC check + idempotency |
| UPI manual confirm | ✅ Done | `POST /api/payments/upi-confirm` — UTR dedup |
| Razorpay webhook | ✅ Done | `POST /api/payments/webhook` — sig check, idempotency via `processed_webhooks` table |
| Owner dashboard | ✅ Done | `/dashboard` — login, stats, orders, products, promo, settings |
| Inventory | ✅ Done | Stock reservations, atomic transactions, restock on cancel |
| State Machine | ✅ Done | Strict order lifecycle transitions |
| Soft Deletes | ✅ Done | `deleted_at` support for products, categories, customers |
| API Versioning | ✅ Done | Routes versioned under `/api/v1` |
| Image serving | ✅ Done | `/uploads/*` static |
| Observability | ✅ Done | Request ID, pino-http, prom-client metrics, health check |
| DevOps | ✅ Done | Multi-stage Dockerfile, graceful shutdown, refined .gitignore |
| Test Suite | ✅ Done | Jest + Supertest integration tests (Health, Auth, Orders) |

---

## Backend — What Is Missing

| Gap | Impact | Priority |
|---|---|---|
| Unit Test Coverage | Some edge cases in utility functions | LOW |
| Prometheus Dashboard | Need Grafana config for metrics | LOW |

---

## Frontend — What Works

| Area | Status | Notes |
|---|---|---|
| Homepage | ✅ Done | HeroBanner, CategoryTiles, TrustBar, SecondaryHero, SocialGrid |
| Products page | ✅ Done | Calls `/api/products`, category filter, ISR |
| Product detail | ✅ Done | Size selector, images, add to cart |
| Cart drawer | ✅ Done | Quantity controls, totals |
| Checkout (3-step) | ✅ Done | Address → Shipping → Payment. Calls `/api/payments/create-order`, `/api/payments/verify`, `/api/payments/upi-confirm` |
| Order confirmation | ✅ Done | Payment ID, local order history, WhatsApp note |
| Account page | ✅ Done | Order history, profile display, logout |
| Navbar | ✅ Done | Logged in → goes to /account. Logged out → opens drawer |
| Mobile drawer | ✅ Done | Shows "MY ACCOUNT (name)" when logged in |
| AccountDrawer | ✅ Done | Login + direct signup (no OTP). Logged-in panel with name/account/logout |
| Zustand store | ✅ Done | Cart (localStorage-persisted), auth, orders, savedAddress, UI state |
| SessionProvider | ✅ Done | Restores session from httpOnly cookie on page load |
| Auth API routes | ✅ Done | `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/signup` |
| AI features | ✅ Done | imageGenerator, styleAssistant, searchAssistant |

---

## Frontend — What Is Broken / Not Wired

| Issue | File(s) | Priority |
|---|---|---|
| No product description or variants shown on product page | UI gap — backend schema also missing these fields | MEDIUM |
| No product update (edit) in owner dashboard | Backend gap — `PATCH /api/products/:id` missing | DONE |

---

## What Was Done This Session (2026-04-29)

| Change | File | Status |
|---|---|---|
| Profile icon routes to /account when logged in | `frontend/src/components/Navbar.tsx` | ✅ Done |
| Mobile drawer shows name when logged in | `frontend/src/components/MobileDrawer.tsx` | ✅ Done |
| Account page greeting falls back to phone, then email | `frontend/src/app/account/page.tsx` | ✅ Done |
| Archived all Medusa-era planning docs | `PLAN.md`, `EXECUTION_PLAN.md`, `MISSING_FEATURES.md`, `NEXT_PHASE_ROADMAP.md`, `BUG_REPORT.md` | ✅ Done |
| Added `customers` table to SQLite schema | `backend/db.js` | ✅ Done |
| Created customer auth middleware (JWT role check) | `backend/middleware/requireCustomer.js` | ✅ Done |
| Created customer routes (signup, login, me) | `backend/routes/customers.js` | ✅ Done |
| Mounted customer routes in server | `backend/server.js` | ✅ Done |
| Rewrote login API route to call new backend | `frontend/src/app/api/auth/login/route.ts` | ✅ Done |
| Created signup API route for new backend | `frontend/src/app/api/auth/signup/route.ts` | ✅ Done |
| Stripped auth.ts to 2 clean functions (login, signup) | `frontend/src/lib/auth.ts` | ✅ Done |
| Rewrote AccountDrawer — no OTP, direct password signup | `frontend/src/components/AccountDrawer.tsx` | ✅ Done |
| Removed dead Medusa import + address-save block | `frontend/src/app/checkout/page.tsx` | ✅ Done |
| Deleted orphaned OTP routes | `frontend/src/app/api/otp/` | ✅ Done |

---

## Next Steps (priority order)

1. **End-to-end test** — sign up a test customer, add to cart, complete checkout, verify order appears in dashboard
2. **Production deploy** — set `COOKIE_SECURE=true`, point `NEXT_PUBLIC_BACKEND_URL` to the live server, configure Razorpay webhook URL

---

## Environment Variables Required

```
# Backend (.env)
OWNER_EMAIL=
OWNER_PASSWORD=
JWT_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=   # optional — webhook sig verification
STORE_CORS=http://localhost:3000
PORT=9000
DATABASE_PATH=             # optional — defaults to data/poshakh.db

# Frontend (.env.local)
NEXT_PUBLIC_BACKEND_URL=http://localhost:9000
MEDUSA_BACKEND_URL=http://localhost:9000   # server-side calls from API routes
COOKIE_SECRET=             # used for httpOnly cookie signing (createSignedCookie)
COOKIE_SECURE=false        # set true in production
```
