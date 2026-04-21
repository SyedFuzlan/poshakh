# Codebase Structure

**Analysis Date:** 2026-04-22

## Directory Layout

```
poshakh2/                          # Monorepo root (no shared packages)
├── frontend/                      # Next.js 16 / React 19 customer storefront
│   ├── src/
│   │   ├── app/                   # Next.js App Router pages and API routes
│   │   │   ├── layout.tsx         # Root layout — wraps all pages
│   │   │   ├── page.tsx           # Home page (server component)
│   │   │   ├── globals.css        # Global CSS + Tailwind base
│   │   │   ├── favicon.ico
│   │   │   ├── account/
│   │   │   │   └── page.tsx       # Account page (client, auth-gated)
│   │   │   ├── checkout/
│   │   │   │   └── page.tsx       # 3-step checkout (client, Razorpay)
│   │   │   ├── order-confirmation/
│   │   │   │   └── page.tsx       # Post-payment confirmation (client)
│   │   │   ├── products/
│   │   │   │   ├── page.tsx       # Products listing (server component)
│   │   │   │   ├── ProductClient.tsx  # Client: filter/display products
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx           # Product detail (server component)
│   │   │   │       └── ProductDetailClient.tsx  # Client: add to cart UI
│   │   │   └── api/               # Next.js BFF routes (auth only)
│   │   │       ├── auth/
│   │   │       │   ├── me/route.ts      # GET — read session cookie
│   │   │       │   └── logout/route.ts  # POST — clear session cookie
│   │   │       └── otp/
│   │   │           ├── send/route.ts    # POST — proxy OTP send to Medusa
│   │   │           └── verify/route.ts  # POST — proxy verify; set cookie
│   │   ├── components/            # Shared React components
│   │   │   ├── Navbar.tsx         # Sticky nav with scroll behaviour
│   │   │   ├── AnnouncementBar.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── MegaMenu.tsx       # Desktop category mega-menu
│   │   │   ├── MobileDrawer.tsx   # Mobile slide-out nav
│   │   │   ├── AccountDrawer.tsx  # OTP login + account side-drawer
│   │   │   ├── CartDrawer.tsx     # Cart side-drawer
│   │   │   ├── SessionProvider.tsx # Hydrates Zustand auth on mount
│   │   │   ├── HeroBanner.tsx     # Home hero section
│   │   │   ├── SecondaryHero.tsx
│   │   │   ├── CategoryTiles.tsx  # Category grid on home page
│   │   │   ├── CollectionCards.tsx
│   │   │   ├── FeaturedProducts.tsx
│   │   │   ├── ProductCard.tsx    # Reusable product card
│   │   │   ├── FullWidthBanner.tsx
│   │   │   ├── SocialGrid.tsx
│   │   │   └── SocialModal.tsx
│   │   ├── lib/                   # Service functions — all data access lives here
│   │   │   ├── medusa.ts          # Medusa JS SDK singleton
│   │   │   ├── products.ts        # getProducts(), getProductById(), static fallback
│   │   │   ├── cart.ts            # getOrCreateCart(), add/remove/update line items
│   │   │   ├── auth.ts            # sendPhoneOTP(), verifyPhoneOTP() — calls BFF
│   │   │   ├── session.ts         # HMAC cookie sign/verify (server-only)
│   │   │   └── ai/                # AI feature stubs (not yet implemented)
│   │   │       ├── imageGenerator.ts
│   │   │       ├── searchAssistant.ts
│   │   │       └── styleAssistant.ts
│   │   ├── store/
│   │   │   └── index.ts           # Zustand global store (cart, auth, orders, UI)
│   │   └── types/
│   │       └── index.ts           # Shared TypeScript interfaces: Product, CartItem, Order, etc.
│   ├── public/
│   │   └── images/
│   │       ├── categories/        # Category tile images
│   │       ├── hero/              # Hero banner images
│   │       └── products/          # Product fallback images (saree1.png, etc.)
│   ├── package.json
│   ├── tsconfig.json
│   └── AGENTS.md                  # Warning: Next.js 16 has breaking API changes
│
├── backend/                       # Medusa.js v2 commerce backend
│   ├── src/
│   │   ├── api/                   # Custom HTTP route handlers
│   │   │   ├── store/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── send-otp/route.ts    # POST /store/auth/send-otp
│   │   │   │   │   └── verify-otp/route.ts  # POST /store/auth/verify-otp
│   │   │   │   ├── checkout/
│   │   │   │   │   ├── create-order/route.ts   # POST /store/checkout/create-order (Razorpay)
│   │   │   │   │   ├── verify-payment/route.ts # POST /store/checkout/verify-payment
│   │   │   │   │   └── complete/route.ts       # POST /store/checkout/complete (Medusa order)
│   │   │   │   └── custom/route.ts             # Placeholder GET stub
│   │   │   └── admin/
│   │   │       └── custom/route.ts             # Placeholder GET stub
│   │   ├── lib/                   # Backend shared utilities
│   │   │   ├── redis.ts           # ioredis singleton (REDIS_URL)
│   │   │   └── otp-store.ts       # Redis OTP CRUD with TTL + rate limiting
│   │   ├── admin/                 # Medusa Admin UI extensions
│   │   │   ├── i18n/index.ts      # i18n setup for admin
│   │   │   ├── README.md
│   │   │   ├── tsconfig.json
│   │   │   └── vite-env.d.ts
│   │   ├── modules/               # Custom Medusa modules (empty — README only)
│   │   ├── workflows/             # Custom Medusa workflows (empty — README only)
│   │   ├── subscribers/           # Event subscribers (empty — README only)
│   │   ├── jobs/                  # Scheduled jobs (empty — README only)
│   │   ├── links/                 # Module links (empty — README only)
│   │   └── scripts/
│   │       └── seed.ts            # Database seed script (products, categories, shipping, regions)
│   ├── integration-tests/
│   │   └── http/                  # HTTP integration test stubs
│   ├── medusa-config.ts           # Medusa configuration (DB, CORS, JWT, Cookie secrets)
│   ├── package.json
│   └── tsconfig.json
│
├── .planning/
│   └── codebase/                  # Codebase map documents (this file's location)
├── .claude/                       # Claude agent skills/config
├── CLAUDE.md                      # Project intelligence file
└── PRD.md                         # Product requirements document
```

## Directory Purposes

**`frontend/src/app/`:**
- Purpose: All Next.js App Router routes — pages and API handlers
- Key rule: Server components fetch data from `lib/`; client components consume Zustand store
- Key files: `layout.tsx` (root shell), `page.tsx` (home), `api/` (BFF auth routes)

**`frontend/src/components/`:**
- Purpose: All reusable React components; flat structure (no feature subdirectories yet)
- Contains: Layout components, marketing sections, drawers, product display
- Key files: `SessionProvider.tsx` (auth hydration), `AccountDrawer.tsx` (OTP flow), `CartDrawer.tsx`

**`frontend/src/lib/`:**
- Purpose: All data access and utility functions — the service layer; no fetch calls should exist outside this directory
- Key files: `medusa.ts` (SDK), `products.ts` (product fetching), `cart.ts` (cart sync), `auth.ts` (OTP), `session.ts` (cookie crypto)

**`frontend/src/store/`:**
- Purpose: Single Zustand store file for all client-side global state
- Key file: `index.ts` — exports `useStore` hook

**`frontend/src/types/`:**
- Purpose: All shared TypeScript type definitions
- Key file: `index.ts` — `Product`, `CartItem`, `Category`, `ShippingAddress`, `Order`

**`frontend/public/images/`:**
- Purpose: Static product and UI images served directly; used as fallbacks when Medusa has no product images
- Subdirs: `categories/`, `hero/`, `products/`

**`backend/src/api/store/`:**
- Purpose: Custom Medusa store API endpoints — extends built-in Medusa Store API
- Convention: Each route in its own subdirectory with a single `route.ts` file
- Exposed at: `http://localhost:9000/store/{path}`

**`backend/src/api/admin/`:**
- Purpose: Custom Medusa admin API endpoints
- Exposed at: `http://localhost:9000/admin/{path}`

**`backend/src/lib/`:**
- Purpose: Backend-only shared utilities; not accessible from frontend
- Key files: `redis.ts` (ioredis singleton), `otp-store.ts` (OTP persistence)

**`backend/src/modules/`:**
- Purpose: Custom Medusa v2 modules (isolated domain services)
- Current state: Empty (README placeholder only)

**`backend/src/workflows/`:**
- Purpose: Medusa v2 workflow definitions (durable, compensatable multi-step operations)
- Current state: Empty (README placeholder only); checkout complete route uses built-in Medusa core-flows

**`backend/src/subscribers/`:**
- Purpose: Event-driven handlers triggered by Medusa internal events (e.g., order.placed)
- Current state: Empty

**`backend/src/scripts/`:**
- Purpose: One-off scripts run via `medusa exec`
- Key file: `seed.ts` — seeds regions, sales channels, categories, products, shipping, API key

## Key File Locations

**Entry Points:**
- `frontend/src/app/layout.tsx`: Root Next.js layout; all pages inherit from here
- `backend/medusa-config.ts`: Medusa server configuration

**Configuration:**
- `frontend/package.json`: Next.js 16.2.4, React 19.2.4, Zustand 5, `@medusajs/js-sdk`
- `backend/package.json`: Medusa 2.13.6, ioredis 5, Razorpay SDK 2
- `.env` files: Not committed; required vars listed in Architecture doc

**Core Logic:**
- `frontend/src/lib/products.ts`: Product fetching with static fallback — critical for storefront
- `frontend/src/lib/cart.ts`: Medusa cart sync — cart ID managed in localStorage
- `frontend/src/store/index.ts`: Single source of truth for all client state
- `backend/src/lib/otp-store.ts`: OTP Redis storage — core of auth system
- `backend/src/api/store/checkout/complete/route.ts`: Full checkout orchestration

**Auth:**
- `frontend/src/lib/session.ts`: Cookie signing (HMAC-SHA256) — server-only
- `frontend/src/app/api/otp/verify/route.ts`: Sets `poshakh_token` HttpOnly cookie
- `frontend/src/components/SessionProvider.tsx`: Hydrates Zustand customer on app load
- `backend/src/api/store/auth/verify-otp/route.ts`: OTP validation + customer upsert

**Types:**
- `frontend/src/types/index.ts`: All shared frontend types

**Testing:**
- `backend/integration-tests/http/`: HTTP integration test directory (stubs only)
- No frontend test files detected

## Naming Conventions

**Frontend Files:**
- Pages: `page.tsx` (Next.js convention, lowercase)
- API routes: `route.ts` (Next.js convention, lowercase)
- Components: `PascalCase.tsx` (e.g., `CartDrawer.tsx`, `ProductCard.tsx`)
- Client components co-located with page: `[PageName]Client.tsx` (e.g., `ProductClient.tsx`, `ProductDetailClient.tsx`)
- Lib/service files: `camelCase.ts` (e.g., `medusa.ts`, `otp-store.ts`)

**Backend Files:**
- Route handlers: `route.ts` (Medusa convention, lowercase)
- Route directories: `kebab-case/` (e.g., `send-otp/`, `verify-payment/`, `create-order/`)
- Lib files: `kebab-case.ts` (e.g., `otp-store.ts`, `redis.ts`)

**Variables / Functions:**
- Functions: `camelCase` (e.g., `getProducts`, `sendPhoneOTP`, `mapMedusaProduct`)
- Types/Interfaces: `PascalCase` (e.g., `Product`, `CartItem`, `OtpEntry`)
- Constants: `SCREAMING_SNAKE_CASE` for env-derived values (e.g., `BACKEND`, `PK`, `CART_KEY`)

**CSS:**
- Tailwind utility classes used in components
- Custom design tokens prefixed with `poshakh-` (e.g., `bg-poshakh-cream`, `text-poshakh-maroon`, `text-poshakh-gold`)
- Inline `style` objects used extensively in checkout page and account page — inconsistency with Tailwind approach elsewhere

## Where to Add New Code

**New Page:**
- Server component page: `frontend/src/app/[route-name]/page.tsx`
- If the page needs client interactivity: create `frontend/src/app/[route-name]/[PageName]Client.tsx` alongside it
- Tests: `frontend/src/app/[route-name]/[PageName].test.tsx` (pattern not yet established)

**New UI Component:**
- Implementation: `frontend/src/components/ComponentName.tsx`
- Mark with `"use client"` only if it needs browser APIs or Zustand store access
- Export: named export (e.g., `export default function ComponentName`)

**New Data Access Function:**
- Place in `frontend/src/lib/` — choose existing file if it fits a domain, or create a new `domain.ts`
- All Medusa Store API calls: use `NEXT_PUBLIC_MEDUSA_BACKEND_URL` + `x-publishable-api-key` header
- All internal auth calls: call Next.js BFF routes (`/api/otp/...`, `/api/auth/...`), never call Medusa auth routes directly from the browser

**New Global State Slice:**
- Add interface fields and actions directly to `GlobalState` in `frontend/src/store/index.ts`
- Add implementation inside the `create<GlobalState>()` call body

**New Type:**
- Add to `frontend/src/types/index.ts`

**New Backend Route:**
- Store-facing: create `backend/src/api/store/[route-name]/route.ts`
- Admin-facing: create `backend/src/api/admin/[route-name]/route.ts`
- Export named HTTP method functions: `export async function GET(...)`, `POST(...)`, etc.
- Use `MedusaRequest` / `MedusaResponse` from `@medusajs/framework/http`

**New Backend Utility:**
- Add to `backend/src/lib/[utility-name].ts`

**New Medusa Custom Module:**
- Create `backend/src/modules/[module-name]/` with `index.ts` per Medusa v2 module spec

**New Medusa Workflow:**
- Create `backend/src/workflows/[workflow-name].ts` using `createWorkflow` from `@medusajs/framework/workflows-sdk`

**New Medusa Subscriber:**
- Create `backend/src/subscribers/[event-name].ts` per Medusa v2 subscriber spec

## Special Directories

**`backend/.medusa/`:**
- Purpose: Auto-generated Medusa client types and query entry points
- Generated: Yes — by `medusa build`
- Committed: Unknown (not in `.gitignore` check scope); treat as generated

**`frontend/.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes
- Committed: No

**`backend/node_modules/` and `frontend/node_modules/`:**
- Purpose: Separate dependency trees for each sub-project
- Generated: Yes
- Committed: No

**`.planning/codebase/`:**
- Purpose: GSD agent codebase map documents consumed by planning and execution agents
- Generated: Yes (by gsd-map-codebase agent)
- Committed: Recommended yes — serves as living architecture documentation

---

*Structure analysis: 2026-04-22*
