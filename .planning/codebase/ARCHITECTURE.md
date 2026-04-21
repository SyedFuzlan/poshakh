# Architecture

**Analysis Date:** 2026-04-22

## Pattern Overview

**Overall:** Headless E-commerce — decoupled frontend + backend communicating over HTTP

**Key Characteristics:**
- Next.js 16 frontend (React 19) is the customer-facing layer; it owns UI, session management, and client state
- Medusa.js v2 backend is the commerce engine — it owns products, carts, orders, and customer records
- Frontend Next.js API routes act as a Backend-for-Frontend (BFF) layer for auth only; all commerce calls bypass BFF and go directly to Medusa
- No shared codebase — `frontend/` and `backend/` are independent Node projects with their own `package.json` and `node_modules`
- Communication is via REST (Medusa Store API + custom routes); no GraphQL, no tRPC, no shared types package

## Layers

**Frontend — Pages (Next.js App Router):**
- Purpose: Server-side data fetching + page shell; passes data to client components
- Location: `frontend/src/app/`
- Contains: `page.tsx` files that are async server components (products, product detail), plus client-only pages (checkout, account, order-confirmation)
- Depends on: `frontend/src/lib/` service functions
- Used by: Browser / end users

**Frontend — Client Components:**
- Purpose: Interactive UI with access to browser APIs and Zustand store
- Location: `frontend/src/components/` and sibling `*Client.tsx` files in `frontend/src/app/`
- Contains: `Navbar.tsx`, `CartDrawer.tsx`, `AccountDrawer.tsx`, `ProductClient.tsx`, `ProductDetailClient.tsx`, etc.
- Depends on: `frontend/src/store/index.ts` (Zustand), `frontend/src/lib/` utilities
- Used by: Page server components (passed as children or rendered directly)

**Frontend — BFF API Routes (Auth only):**
- Purpose: Session cookie management; shields `MEDUSA_CUSTOMER_SECRET` from the browser
- Location: `frontend/src/app/api/`
- Contains:
  - `api/otp/send/route.ts` — proxies OTP send to Medusa backend
  - `api/otp/verify/route.ts` — proxies OTP verify to Medusa, then sets signed HttpOnly cookie
  - `api/auth/me/route.ts` — reads and validates the signed session cookie
  - `api/auth/logout/route.ts` — clears the session cookie
- Depends on: `frontend/src/lib/session.ts` (HMAC cookie signing)
- Used by: Browser (fetch calls from `frontend/src/lib/auth.ts` and `SessionProvider`)

**Frontend — Service Library:**
- Purpose: Centralised data access — no raw `fetch` calls inside components
- Location: `frontend/src/lib/`
- Contains:
  - `medusa.ts` — Medusa JS SDK singleton (`@medusajs/js-sdk`)
  - `products.ts` — `getProducts()` / `getProductById()` with static fallback when publishable key absent
  - `cart.ts` — `getOrCreateCart()`, `addMedusaLineItem()`, `removeMedusaLineItem()`, `updateMedusaLineItem()`
  - `auth.ts` — `sendPhoneOTP()` / `verifyPhoneOTP()` calling Next.js BFF routes
  - `session.ts` — HMAC-SHA256 cookie signing/verification (server-only, uses `crypto`)
  - `ai/imageGenerator.ts`, `ai/searchAssistant.ts`, `ai/styleAssistant.ts` — stub AI hooks (not yet implemented)

**Frontend — Global State:**
- Purpose: Client-side state shared across components; not persisted to DB
- Location: `frontend/src/store/index.ts`
- Contains: Single Zustand store with slices for cart, auth (customer), orders, pending order, saved address, UI toggles
- Depends on: `localStorage` for `poshakh_cart_id`
- Used by: All client components

**Backend — Custom Store API Routes:**
- Purpose: Commerce logic not covered by Medusa core; exposed under `/store/`
- Location: `backend/src/api/store/`
- Contains:
  - `auth/send-otp/route.ts` — generates OTP, stores in Redis via otp-store, sends via MSG91 (SMS) or logs to console (email dev)
  - `auth/verify-otp/route.ts` — validates OTP from Redis, upserts Medusa customer record
  - `checkout/create-order/route.ts` — creates Razorpay order (returns `razorpay_order_id`)
  - `checkout/verify-payment/route.ts` — verifies Razorpay HMAC signature
  - `checkout/complete/route.ts` — attaches address to Medusa cart → adds shipping method → creates payment collection → completes cart → creates Medusa order
  - `custom/route.ts` — placeholder GET 200 stub

**Backend — Custom Admin Routes:**
- Location: `backend/src/api/admin/`
- Contains: `custom/route.ts` — placeholder GET 200 stub; admin extensions not yet built

**Backend — Lib (Shared Backend Utilities):**
- Purpose: Infrastructure helpers used across backend routes
- Location: `backend/src/lib/`
- Contains:
  - `redis.ts` — ioredis singleton factory (`REDIS_URL` env var, lazy-connects)
  - `otp-store.ts` — Redis-backed OTP storage with 10-minute TTL and 60-second rate limit

**Backend — Medusa Modules (Empty Stubs):**
- Location: `backend/src/modules/`, `backend/src/workflows/`, `backend/src/subscribers/`, `backend/src/jobs/`, `backend/src/links/`
- Contains: README files only — no custom modules implemented yet

## Data Flow

**Product Listing (Server-side fetch):**

1. Browser requests `/products?cat=sarees`
2. Next.js server component `frontend/src/app/products/page.tsx` calls `getProducts("sarees")` from `frontend/src/lib/products.ts`
3. `getProducts` fetches `GET /store/products` on the Medusa backend with publishable API key header
4. Medusa returns product list; `mapMedusaProduct()` normalises shape to `Product` type
5. Mapped products passed as `initialProducts` prop to `ProductClient` client component
6. Page renders; `ProductClient` handles filtering/UI client-side

**OTP Authentication Flow:**

1. User enters phone number in `AccountDrawer`
2. Component calls `sendPhoneOTP(phone)` from `frontend/src/lib/auth.ts`
3. `auth.ts` POSTs to Next.js BFF: `POST /api/otp/send`
4. BFF route (`frontend/src/app/api/otp/send/route.ts`) forwards to `POST /store/auth/send-otp` on Medusa backend
5. Medusa route generates 6-digit OTP → stores in Redis (`otp:{identifier}` key) → sends via MSG91 SMS
6. User enters OTP → `verifyPhoneOTP(phone, otp)` POSTs to `POST /api/otp/verify` (BFF)
7. BFF forwards to `POST /store/auth/verify-otp` on Medusa
8. Medusa validates OTP from Redis → upserts customer → returns customer object
9. BFF receives customer → signs it into HMAC cookie `poshakh_token` (HttpOnly, 7 days) → returns customer to browser
10. `AccountDrawer` calls `setCustomer()` on Zustand store

**Session Hydration on Page Load:**

1. `SessionProvider` (wraps entire app in `layout.tsx`) fires `GET /api/auth/me` on mount
2. BFF reads `poshakh_token` cookie → verifies HMAC → returns customer JSON
3. `SessionProvider` calls `setCustomer()` on Zustand store → sets `isSessionReady: true`
4. Components gated on `isSessionReady` render correctly

**Checkout & Payment Flow:**

1. User adds items → `addToCart()` in Zustand + `addMedusaLineItem()` in `frontend/src/lib/cart.ts` (syncs to Medusa cart via publishable key)
2. Checkout page (`frontend/src/app/checkout/page.tsx`) reads cart + customer from Zustand
3. Step 1: User fills shipping address → saved to Zustand + best-effort synced to Medusa customer addresses
4. Step 2: User selects shipping method → fetched from Medusa `/store/shipping-options?cart_id=`
5. Step 3: `handleRazorpay()` calls `POST /store/checkout/create-order` (Medusa) → receives `razorpay_order_id`
6. Razorpay modal opens → user pays
7. On success: Razorpay callback POSTs to `POST /store/checkout/verify-payment` (Medusa) → HMAC verified
8. On verified: calls `POST /store/checkout/complete` (Medusa) → full Medusa cart completion workflow runs
9. Frontend clears cart from Zustand + localStorage → navigates to `/order-confirmation`

**State Management:**

- Server state (products, shipping options): fetched directly, not cached in Zustand — each page load re-fetches
- Client state (cart, customer, orders, UI drawers): Zustand single store (`frontend/src/store/index.ts`)
- Cart persistence: `poshakh_cart_id` stored in `localStorage`; Zustand cart items are in-memory only (not persisted across page reloads — risk)
- Session persistence: HttpOnly cookie `poshakh_token` (HMAC-signed JSON, 7 days)
- No TanStack Query used despite CLAUDE.md convention — raw `fetch` used throughout

## Key Abstractions

**`Product` type:**
- Purpose: Normalised product shape used by all frontend code
- Definition: `frontend/src/types/index.ts`
- Produced by: `mapMedusaProduct()` in `frontend/src/lib/products.ts`

**`CartItem` type:**
- Purpose: Local cart representation; has both `id` (local composite key) and optional `lineItemId` (Medusa line item ID)
- Definition: `frontend/src/types/index.ts`
- Used by: Zustand store + checkout page

**`OtpEntry` interface:**
- Purpose: Redis-stored OTP record with TTL and rate limit metadata
- Definition: `backend/src/lib/otp-store.ts`

**Medusa JS SDK singleton:**
- Purpose: Typed client for Medusa Store API
- Location: `frontend/src/lib/medusa.ts`
- Note: Only instantiated; actual calls in the codebase mostly use raw `fetch` instead of SDK methods — inconsistency

## Entry Points

**Frontend — App Shell:**
- Location: `frontend/src/app/layout.tsx`
- Triggers: All browser requests
- Responsibilities: Wraps app in `SessionProvider`, renders `Navbar`, `AnnouncementBar`, `Footer`, `AccountDrawer`, `CartDrawer`

**Frontend — Home Page:**
- Location: `frontend/src/app/page.tsx`
- Responsibilities: Renders marketing sections (HeroBanner, CategoryTiles, SecondaryHero, SocialGrid)

**Backend — Medusa Server:**
- Location: `backend/medusa-config.ts` configures the Medusa framework; entry is `medusa start`
- Exposes: `http://localhost:9000` with `/store/`, `/admin/`, `/auth/` prefixes
- Responsibilities: All commerce operations, custom OTP routes, custom checkout routes

## Error Handling

**Strategy:** Defensive try/catch with graceful fallbacks in the frontend; bare throws in backend routes

**Frontend Patterns:**
- `getProducts()` catches Medusa fetch errors and falls back to `staticProducts` array
- `getProductById()` returns `null` on any error; page calls `notFound()`
- Cart lib functions silently swallow errors (`return null` on non-ok responses)
- Checkout page shows `alert()` to user on payment failures — not a polished UX
- Session fetch in `SessionProvider` has empty `.catch(() => {})` — silent failure

**Backend Patterns:**
- OTP routes return structured `{ error: "..." }` JSON with appropriate HTTP status codes
- Checkout complete route catches errors and returns 500 with error message
- No global error handler registered; Medusa framework handles unhandled throws

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.error` only — no structured logging library
**Validation:** Manual checks in route handlers (`if (!field) return 400`) — no schema validation library (Zod absent)
**Authentication:** Custom HMAC cookie (not Medusa's built-in JWT auth system) — customer identity verified only on BFF routes; Medusa backend routes have no auth guard
**CORS:** Configured in `medusa-config.ts` via `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` env vars
**Currency:** INR only; prices stored in paise in Medusa, converted to rupees in `frontend/src/lib/products.ts`

---

*Architecture analysis: 2026-04-22*
