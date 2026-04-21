# Technology Stack

**Analysis Date:** 2026-04-22

---

## Languages

**Primary:**
- TypeScript 5.x — used everywhere across frontend and backend; no plain `.js` files in `src/`

**Secondary:**
- TSX (React JSX) — all frontend UI components

---

## Runtime

**Environment:**
- Node.js >=20 (enforced in `backend/package.json` engines field)

**Package Manager:**
- npm 11.6.1 (enforced via `packageManager` field in `backend/package.json`)
- Lockfile: present — `frontend/package-lock.json` and `backend/package-lock.json`

---

## Frontend (`frontend/`)

**Framework:**
- Next.js 16.2.4 — App Router architecture (no Pages Router)
- React 19.2.4 / React DOM 19.2.4

**Styling:**
- Tailwind CSS 4.x — configured via `frontend/postcss.config.mjs` and `frontend/@tailwindcss/postcss` plugin
- Inline `React.CSSProperties` style objects also used in some components (e.g. `frontend/src/app/checkout/page.tsx`)

**State Management:**
- Zustand 5.0.12 — single global store at `frontend/src/store/index.ts` covering cart, auth, orders, UI state
- No TanStack Query in use; API calls made with raw `fetch` in lib files

**Medusa Client:**
- `@medusajs/js-sdk` 2.13.6 — instantiated at `frontend/src/lib/medusa.ts`

**TypeScript Config:**
- `frontend/tsconfig.json` — path alias `@/` maps to `frontend/src/`

**Key Frontend Scripts:**
```bash
npm run dev      # next dev
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
```

**Frontend Dev Dependencies:**
- ESLint 9 + `eslint-config-next` 16.2.4
- `@types/node` ^20, `@types/react` ^19, `@types/react-dom` ^19

---

## Backend (`backend/`)

**Framework:**
- Medusa.js v2.13.6 — headless e-commerce engine
  - `@medusajs/medusa` 2.13.6
  - `@medusajs/framework` 2.13.6
  - `@medusajs/admin-sdk` 2.13.6
  - `@medusajs/cli` 2.13.6
  - `@medusajs/ui` 4.1.6 (Admin UI components)

**Payment SDK:**
- `razorpay` 2.9.6 — direct REST client, NOT via a Medusa payment plugin

**Cache / Session Store:**
- `ioredis` 5.10.1 — used for OTP storage and rate limiting (`backend/src/lib/redis.ts`, `backend/src/lib/otp-store.ts`)

**Admin UI Extra:**
- `react-stately` 3.46.0 — used within Admin SDK widget context

**TypeScript Config:**
- `backend/tsconfig.json`

**Key Backend Scripts:**
```bash
npm run dev        # medusa develop (hot reload)
npm run build      # medusa build
npm run start      # medusa start
npm run seed       # medusa exec ./src/scripts/seed.ts
npm run test:unit  # Jest unit tests
npm run test:integration:http     # Jest HTTP integration tests
npm run test:integration:modules  # Jest module integration tests
```

**Backend Dev Dependencies:**
- Jest 29.7.0 + `@swc/jest` 0.2.36 (SWC transform for fast tests)
- `@medusajs/test-utils` 2.13.6
- `@types/jest` ^29.5.13
- `ts-node` 10.9.2
- Vite 5.4.14 (used by Admin SDK build)

---

## Testing

**Runner:** Jest 29.7.0 (backend only)
**Transform:** `@swc/jest` / `@swc/core`
**Config:** `backend/jest.config.js`
**Types:** Three test suites via `TEST_TYPE` env var: `unit`, `integration:http`, `integration:modules`
**Frontend:** No test framework installed — no Jest/Vitest/RTL in `frontend/package.json`

---

## Build & Configuration Files

| File | Purpose |
|---|---|
| `backend/medusa-config.ts` | Medusa project config — DB URL, CORS, JWT/cookie secrets |
| `frontend/next.config.ts` | Next.js config — image remote patterns for localhost:9000 and wildcard HTTPS |
| `frontend/postcss.config.mjs` | PostCSS config for Tailwind 4 |
| `frontend/eslint.config.mjs` | ESLint flat config |
| `frontend/tsconfig.json` | TypeScript config with `@/` alias |
| `backend/tsconfig.json` | TypeScript config for Medusa backend |
| `backend/jest.config.js` | Jest configuration for three test types |

---

## Environment Variable Files

| File | Exists | Purpose |
|---|---|---|
| `backend/.env` | Yes | DATABASE_URL, Redis, Razorpay, MSG91, CORS, secrets |
| `frontend/.env.local` | Yes | NEXT_PUBLIC_MEDUSA_BACKEND_URL, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY, MEDUSA_BACKEND_URL, MEDUSA_CUSTOMER_SECRET, DEV_TEST_PHONE, DEV_TEST_OTP |

---

## Platform & Deployment

**Development:**
- Frontend: `http://localhost:3000` (Next.js dev server)
- Backend: `http://localhost:9000` (Medusa server)
- Redis: `redis://localhost:6379` (default)
- PostgreSQL: via `DATABASE_URL`

**Production target:** Not yet configured — no Dockerfile, Vercel config, or Railway config detected in the repository root.

**Next.js Image Domains:** Configured to allow `localhost:9000` (HTTP) and any HTTPS host (`**`) via `frontend/next.config.ts`.

---

## AI Features (Placeholder — Not Production)

Three stub files exist in `frontend/src/lib/ai/`:
- `imageGenerator.ts` — placeholder; comment notes intent to call OpenAI DALL-E 3 or Midjourney via backend
- `searchAssistant.ts` — placeholder; comment notes intent to use Vector DB (Pinecone/MongoDB Atlas) + OpenAI `ada-002` embeddings
- `styleAssistant.ts` — not yet read but co-located with the above

No AI SDK packages are installed in `frontend/package.json`. These features are stubs only.

---

*Stack analysis: 2026-04-22*
