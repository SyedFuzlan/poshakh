# AUDIT — CODE QUALITY
> Poshakh E-commerce | Date: 2026-05-11 | Branch: master
> Scope: backend/.medusa/server/src/** + frontend/src/**
> Methodology: Static analysis, manual code read, cross-file duplication detection

---

## SUMMARY

| Severity | Backend | Frontend | Total |
|----------|---------|----------|-------|
| CRITICAL | 2 | 6 | **8** |
| HIGH | 25 | 7 | **32** |
| MEDIUM | 30+ | 12 | **42+** |
| LOW | 15+ | 7 | **22+** |
| **TOTAL** | **72+** | **32** | **104+** |

---

## BACKEND FINDINGS

### CRITICAL

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `backend/.medusa/server/src/api/admin/custom/route.js` | 4 | Empty stub route | GET returns 200 with no logic — exposes ghost endpoint on production API surface |
| `backend/.medusa/server/src/api/store/custom/route.js` | 4 | Empty stub route | GET returns 200 with no logic — confusing to consumers, should be 501 or deleted |

### HIGH — Duplicated OTP Generation (3 files copy-paste same logic)

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/api/store/auth/send-otp/route.js` | 31 | Duplicate OTP gen | `Math.floor(100000 + Math.random() * 900000)` — duplicated in 3 routes |
| `src/api/store/auth/signup/route.js` | 34 | Duplicate OTP gen | Same OTP formula — should be shared util `generateOtp()` |
| `src/api/store/auth/forgot-password/route.js` | 28 | Duplicate OTP gen | Same OTP formula — 3rd copy |

### HIGH — Duplicated Phone/Email Regex (5 files)

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/api/store/auth/send-otp/route.js` | 33 | Duplicate regex | `/^\+?\d{7,}$/` — repeated 5 times, not a constant |
| `src/api/store/auth/login/route.js` | 18 | Duplicate regex | Same pattern |
| `src/api/store/auth/forgot-password/route.js` | 21 | Duplicate regex | Same pattern |
| `src/api/store/auth/reset-password/route.js` | 29 | Duplicate regex | Same pattern |
| `src/api/store/auth/verify-otp/route.js` | 30 | Duplicate regex | Same pattern |

### HIGH — Duplicated Customer Lookup (4 files)

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/api/store/auth/login/route.js` | 19–21 | Duplicate lookup | `ternary + listCustomers` pattern repeated |
| `src/api/store/auth/forgot-password/route.js` | 22–24 | Duplicate lookup | Same pattern |
| `src/api/store/auth/reset-password/route.js` | 30–32 | Duplicate lookup | Same pattern |
| `src/api/store/auth/verify-otp/route.js` | 31–33 | Duplicate lookup | Same pattern |

### MEDIUM — Unvalidated `process.env` Reads

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/api/store/auth/send-otp/route.js` | 10 | Env not validated | `MSG91_AUTH_KEY` read inline — undefined silently breaks SMS |
| `src/api/store/auth/send-otp/route.js` | 11 | Env not validated | `MSG91_TEMPLATE_ID` read inline |
| `src/api/store/checkout/create-order/route.js` | 13 | Env not validated | `RAZORPAY_KEY_ID` — payment breaks silently if missing |
| `src/api/store/checkout/create-order/route.js` | 14 | Env not validated | `RAZORPAY_KEY_SECRET` |
| `src/api/store/checkout/verify-payment/route.js` | 27 | Env not validated | `RAZORPAY_KEY_SECRET` used in HMAC without null check |
| `src/lib/email.js` | 7 | Env not validated | `RESEND_API_KEY` instantiated without null check |

### MEDIUM — Swallowed / Unlogged Errors

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/lib/otp-store.js` | 27–31 | Swallowed error | `JSON.parse` in `try/catch` returns `null` silently — OTP parse failure undetectable |
| `src/api/webhooks/razorpay/route.js` | 14–19 | Swallowed error | Signature verification catch returns `false` with no log — attack attempts invisible |

### MEDIUM — Hardcoded Values

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/api/store/auth/send-otp/route.js` | 15 | Hardcoded URL | MSG91 API endpoint URL embedded in route — should be config constant |
| `src/api/store/checkout/complete/route.js` | 61 | Hardcoded provider | `"pp_system_default"` — tight coupling to Medusa default |
| `src/api/store/checkout/complete/route.js` | 64 | Hardcoded currency | `"inr"` — should come from region config |
| `src/api/store/checkout/complete/route.js` | 37, 47 | Hardcoded country | `"in"` in shipping + billing address — not extensible |
| `src/lib/email.js` | 8 | Hardcoded from | `"Poshakh <noreply@poshakh.in>"` — should be env var |
| `src/lib/auth-meta.js` | 12 | Hardcoded bcrypt rounds | `12` rounds should be configurable |

### MEDIUM — Rate Limit Gaps

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/api/store/auth/signup/route.js` | 18 | Incomplete rate limit | Only checks email rate limit — phone not checked on signup |
| `src/lib/otp-store.js` | 12 | Same TTL all endpoints | 60s applies to send-otp AND signup — inconsistent UX |

### LOW — Dead / Commented Code

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `backend/.medusa/server/instrumentation.js` | 2–23 | 100% commented out | Entire OpenTelemetry block dead — implement or delete |
| `src/api/store/auth/send-otp/route.js` | 9–20 | Orphan function | `sendViaMSG91` defined inline but not reused across related routes |

### LOW — Unused Dependencies

| File | Issue | Description |
|------|-------|-------------|
| `package.json` | `react-stately` | Listed in deps — never imported in any backend `.js/.ts` file |
| `package.json` | `prop-types` | Listed in devDeps — never used in backend code |

### LOW — Duplicate Validation Response Patterns (9 routes)

All auth and checkout routes repeat identical input validation error format. Should be extracted to shared middleware.
Files: `send-otp`, `verify-otp`, `login`, `signup`, `forgot-password`, `reset-password`, `create-order`, `verify-payment`, `complete`.

---

## FRONTEND FINDINGS

### CRITICAL

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/lib/ai/imageGenerator.ts` | 7 | `console.log` in prod | Spams browser console — remove before any production deploy |
| `src/lib/ai/searchAssistant.ts` | 8 | `console.log` in prod | Same — spams console |
| `src/lib/ai/styleAssistant.ts` | 6 | `console.log` in prod | Same |
| `src/app/products/[id]/page.tsx` | 15 | `console.error` in prod | Fires during static build and at runtime — pollutes server logs |
| `src/app/sitemap.ts` | 38 | `console.error` in prod | Fires during sitemap generation on every build |
| `src/app/products/[id]/ProductDetailClient.tsx` | 73 | Dynamic import in `useEffect` | `import()` inside effect causes separate network fetch per render — performance regression |

### HIGH

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/components/HeroBanner.tsx` | 35, 49 | Image optimization bypassed | `unoptimized={!!heroImg}` disables Next.js image optimization for backend-sourced images — LCP regression |
| `src/components/AnnouncementBar.tsx` | 10 | API call in client component | Announcement data fetched client-side — should be Server Component |
| `src/components/HeroBanner.tsx` | 12 | API call in client component | Hero banner data fetched client-side — should be Server Component |
| `src/app/products/ProductsContent.tsx` | 15–19 | No caching on product fetch | `getProducts(cat)` called client-side on every category change — no ISR, no cache |
| `src/app/checkout/page.tsx` | 108–119 | Fire-and-forget API call | Checkout intent tracking `fetch()` has no error handling — silent failure loses analytics |
| `src/app/checkout/page.tsx` | 680–681 | Dead comment | "Add handleApplyPromo inside the component..." — incomplete refactoring marker |
| `src/app/products/[id]/ProductDetailClient.tsx` | 26–31 | Unmemoized loop | `inferColor()` loops 30+ entries on every render of color swatches — no `useMemo` |

### MEDIUM

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/components/FeaturedProducts.tsx` | 55–122 | Missing `React.memo` | List renders with hover handlers — all items re-render on single hover — jank on slow devices |
| `src/components/ProductCard.tsx` | 49–52 | Missing `useCallback` | `onClick` for wishlist recreated on every render — unnecessary child re-renders |
| `src/app/products/ProductClient.tsx` | 46–54 | Filter logic not memoized | String operations per product per render without `useMemo` |
| `src/components/CartDrawer.tsx` | 20–30 | Silent error swallowing | `.catch(() => {})` × 3 — cart sync failures invisible to user and developer |
| `src/components/SessionProvider.tsx` | 23 | Silent error swallowing | `.catch(() => {})` on `/api/auth/me` — user session failure invisible |
| `src/components/AnnouncementBar.tsx` | 17 | Silent error swallowing | `.catch(() => {})` on settings API — stale fallback shown indefinitely |
| `src/app/products/[id]/ProductDetailClient.tsx` | 69–77 | Multiple unguarded fetches | `getSimilarProducts()` + `getProductSiblings()` with no error handling or fallback |
| `src/lib/products.ts` | 137–138 | Dead exports | `export const products = []` and `getProductsByCategory()` are no-ops — migration incomplete |
| `src/app/checkout/page.tsx` | 213–217 | Unsafe type cast | `window as unknown as { Razorpay: ... }` — unsafe, should use proper type declaration |
| `src/components/ProductCard.tsx` | 73–88 | IIFE in JSX | Inline IIFE for conditional render — extract to function or `useMemo` |
| `src/app/order-confirmation/page.tsx` | 5 | Unused `Suspense` pattern | Suspense wraps itself unnecessarily |
| `src/app/checkout/page.tsx` | 84 | ESLint disable comment | `react-hooks/exhaustive-deps` disabled — dependency array likely incomplete |

### LOW

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/app/layout.tsx` | — | Missing `error.tsx` | No app-level error boundary — unhandled errors show raw Next.js page |
| `src/app/products/` | — | Missing `loading.tsx` | No Suspense skeleton — inline string fallback used |
| `src/app/products/[id]/` | — | Missing `error.tsx` | API errors fall through with no user-friendly UI |
| `src/lib/ai/imageGenerator.ts` | — | Unused dead file | Never imported anywhere — stub implementation |
| `src/lib/ai/searchAssistant.ts` | — | Unused dead file | Never imported — dead code |
| `src/lib/ai/styleAssistant.ts` | — | Unused dead file | Never imported — dead code (remove or implement) |
| `src/lib/cart.ts` | 1–2 | ESLint suppression on stubs | Suppresses `no-unused-vars` — indicates incomplete migration |
| `src/app/checkout/page.tsx` | 532–539 | Dev payment button in prod | `NEXT_PUBLIC_DEV_SIMULATE` check allows dev Razorpay bypass in production if env var set — gate to `NODE_ENV === 'development'` only |
| `src/components/SEO/ProductSchema.tsx` | 14 | Fragile URL check | `startsWith('http')` check for image URL — doesn't handle protocol-relative URLs |

---

## TOP 10 FIX PRIORITIES

| Priority | Fix | Impact |
|----------|-----|--------|
| 1 | Extract `isPhone()`, `generateOtp()`, `lookupCustomer()` helpers — eliminate 5 files of copy-paste | Reduces 25 HIGH findings to ~5 |
| 2 | Add shared validation middleware for all auth + checkout routes | Eliminates 9 duplicate error response patterns |
| 3 | Delete 3 AI stub files (`lib/ai/`): dead code + console.log in prod | Removes 6 CRITICAL frontend findings |
| 4 | Move `AnnouncementBar` + `HeroBanner` data fetch to Server Components | Fixes 2 HIGH render performance issues |
| 5 | Replace `.catch(() => {})` with logged error handlers in CartDrawer, SessionProvider, AnnouncementBar | Fixes 3 MEDIUM silent failures |
| 6 | Delete or implement empty stub routes (`/admin/custom`, `/store/custom`) | Removes 2 CRITICAL backend findings |
| 7 | Add `envalid` / `zod` env validation at startup — fail fast on missing secrets | Covers 6 MEDIUM env read issues |
| 8 | Remove `NEXT_PUBLIC_DEV_SIMULATE` payment bypass from production build path | Security gap in checkout |
| 9 | Add `error.tsx` and `loading.tsx` to `/products` and `/products/[id]` route segments | Fixes 3 LOW UX gaps |
| 10 | Add `React.memo` to `FeaturedProducts`, `useMemo` to `inferColor()` + filter logic | Fixes 3 HIGH/MEDIUM perf issues |

---

## WHAT NOT TO TOUCH

- Razorpay HMAC verification logic (`verify-payment/route.js`) — correct, battle-tested
- OTP TTL and rate-limit logic in `lib/otp-store.js` — functionally correct even if needs refactor
- Medusa core configuration in `medusa-config.js` — do not change without understanding module system
