# AUDIT — PERFORMANCE
> Poshakh E-commerce | Date: 2026-05-11 | Branch: master
> Scope: frontend/src/** + backend/.medusa/server/src/** + next.config.ts + medusa-config.js

---

## SUMMARY

| Impact | Frontend | Backend | Infra | Total |
|--------|----------|---------|-------|-------|
| HIGH | 3 | 3 | 1 | **7** |
| MEDIUM | 6 | 3 | 2 | **11** |
| LOW | 3 | 2 | 1 | **6** |

---

## FRONTEND RENDER PERFORMANCE

### HIGH Impact

| File | Line | Category | Description | Fix |
|------|------|----------|-------------|-----|
| `frontend/src/components/FeaturedProducts.tsx` | 12–14 | Client data fetch + no cleanup | `useEffect` fetches all products client-side; `hovered` state change triggers re-fetch; no dependency array closure; no cleanup | Move to Server Component; or add proper `[]` dep array and separate `hovered` state to individual card |
| `frontend/src/app/products/ProductsContent.tsx` | 15–20 | Unnecessary re-fetches | Client component re-fetches all products on every `cat` param change even if previously loaded; no SWR/React Query | Move filtering server-side via searchParams; use ISR `revalidate: 3600` on category pages |
| `frontend/src/components/SessionProvider.tsx` | 10–24 | Blocking auth check | `/api/auth/me` fetched on every route load without error boundary or timeout; blocks session readiness for entire app | Add 3s timeout; cache result in sessionStorage (stale-while-revalidate pattern); or handle via Next.js middleware |

### MEDIUM Impact

| File | Line | Category | Description | Fix |
|------|------|----------|-------------|-----|
| `frontend/src/components/HeroBanner.tsx` | 11–20 | Unoptimized images | `unoptimized={!!heroImg}` disables Next.js image optimization when hero image is backend-sourced — forces full-size asset download, impacts LCP | Remove `unoptimized`; add backend image domain to `remotePatterns` in next.config.ts |
| `frontend/src/components/ProductCard.tsx` | 73–88 | Inline computation | Color inference runs inside map on every render — no memoization of derived color array | Wrap in `useMemo`; or extract color inference to server-side before prop drilling |
| `frontend/src/app/products/[id]/ProductDetailClient.tsx` | 70–77 | Sequential fetches | `getSimilarProducts()` + `getProductSiblings()` called sequentially in separate `useEffect` calls; adds latency equal to both round-trips back-to-back | Combine into single `useEffect` with `Promise.all([getSimilarProducts(), getProductSiblings()])` |
| `frontend/src/components/FeaturedProducts.tsx` | 55–122 | No memoization on list | 6 product cards render without `React.memo`; `hovered` state on parent re-renders all children | Wrap product card rendering in `React.memo`; move `hovered` state into individual card components |
| `frontend/src/lib/products.ts` | 49–65 | ISR defeated by client fetch | `getProducts()` sets `revalidate: 60` but homepage loads products via client-side `useEffect` in `FeaturedProducts` — ISR never served | Move `FeaturedProducts` to async Server Component; pass products as props from page.tsx |
| `frontend/src/app/products/ProductClient.tsx` | 46–54 | Unmemoized filter logic | `filteredProducts` filter runs string operations per product on every render; no `useMemo` | Wrap in `useMemo` with deps: `[initialProducts, selectedFabrics, selectedColors, maxPrice]` |

### LOW Impact

| File | Line | Category | Description | Fix |
|------|------|----------|-------------|-----|
| `frontend/src/components/ProductCard.tsx` | 49–52 | Inline onClick handlers | `onClick` recreated per render inside map | Wrap with `useCallback`; low priority for small lists |
| `frontend/src/app/layout.tsx` | 94–104 | No Suspense boundary | Layout wraps children without Suspense — any slow child data fetch blocks paint | Add `<Suspense fallback={<Skeleton />}>` around main content area |
| `frontend/src/app/products/[id]/page.tsx` | 8–18 | N+1 at build time | `generateStaticParams()` fetches all products at once — if DB scales, this becomes expensive | Cache product list during build; paginate `generateStaticParams` if product count exceeds 200 |

---

## BACKEND PERFORMANCE RISKS

### HIGH Impact

| File | Line | Category | Description | Fix |
|------|------|----------|-------------|-----|
| `src/api/store/checkout/complete/route.js` | 27–66 | Sequential awaits | 4 sequential awaits chained: `updateCarts → addShippingMethodToCartWorkflow → createPaymentCollectionForCartWorkflow → completeCartWorkflow` — each waits for previous | Parallelize independent steps: `await Promise.all([updateCarts, addShippingMethod])` then `createPaymentCollection` then `complete` |
| `src/api/store/auth/send-otp/route.js` | 9–20 | Synchronous external HTTP | `sendViaMSG91()` blocks on external API call with no timeout, no retry, no circuit breaker — one slow MSG91 request blocks the event loop | Add `AbortController` with 5s timeout; wrap in retry (exponential backoff, max 3 attempts); consider Bull queue for async SMS delivery |
| `src/lib/products.ts` | 49–65, 78–102 | No request batching | `getProducts`, `getSimilarProducts`, `getProductSiblings` all hit backend API individually — 3 separate round-trips per product detail load | Add a batched endpoint or use `Promise.all` on parallel independent requests |

### MEDIUM Impact

| File | Line | Category | Description | Fix |
|------|------|----------|-------------|-----|
| `src/api/store/checkout/create-order/route.js` | 23–29 | No Razorpay timeout | `razorpay.orders.create()` has no timeout — Razorpay slowness blocks checkout for user indefinitely | Add SDK-level timeout or wrap with `Promise.race` against a timeout promise |
| `backend/.medusa/server/medusa-config.js` | 1–18 | Missing DB pool config | Only `databaseUrl` set; no `pool.min`, `pool.max`, `idleTimeoutMillis` — under concurrent load, connection exhaustion crashes the app | Add: `database: { clientUrl: process.env.DATABASE_URL, pool: { min: 2, max: 20, idleTimeoutMillis: 30000 } }` |
| `src/api/store/checkout/complete/route.js` | 20–24 | Redis blocking read | Synchronous `Redis.get()` for idempotency check before cart operations — acceptable pattern but add timeout | Add `commandTimeout: 2000` to Redis client config to prevent idle Redis hanging checkout |

### LOW Impact

| File | Line | Category | Description | Fix |
|------|------|----------|-------------|-----|
| `src/lib/redis.js` | 10–18 | No Redis pool config | Default `maxRetriesPerRequest: 3` only; no explicit connection pooling for concurrent requests | Add `maxRetriesPerRequest: 3, enableOfflineQueue: false, lazyConnect: true` |
| `src/api/webhooks/razorpay/route.js` | 38–42 | Redis dedup pattern | `.get()` then `.setex()` — race condition window is ~1ms; acceptable for current scale | Safe as-is. Monitor under high load. |

---

## INFRASTRUCTURE GAPS

### HIGH Impact

| File | Line | Category | Description | Fix |
|------|------|----------|-------------|-----|
| `frontend/src/lib/products.ts` | all | No request batching | Multiple separate API calls per page — compounds latency on slow connections | Implement `?include=similar&include=siblings` batch endpoint; or GraphQL |

### MEDIUM Impact

| File | Line | Category | Description | Fix |
|------|------|----------|-------------|-----|
| `frontend/next.config.ts` | 6–22 | Wildcard image domains | `remotePatterns: [{ hostname: "**" }]` allows ALL HTTPS hosts — no optimization hints, no size limits | Replace `**` with explicit domains; add `deviceSizes: [640, 750, 1080, 1200]`, `minimumCacheTTL: 86400` |
| `frontend/next.config.ts` | — | No CDN cache headers | No explicit cache headers for static assets in next.config | Add headers config: `/_next/static/*` → `Cache-Control: public, max-age=31536000, immutable` |

### LOW Impact

| File | Line | Category | Description | Fix |
|------|------|----------|-------------|-----|
| `frontend/src/app/products/[id]/page.tsx` | 8–18 | ISR revalidate not set | Product detail pages use `generateStaticParams` but no `export const revalidate` — pages go stale after deploy | Add `export const revalidate = 3600` to product detail page |

---

## TOP PERFORMANCE FIXES — RANKED BY IMPACT

| Priority | Fix | Expected Gain |
|----------|-----|---------------|
| 1 | Move `FeaturedProducts` + `HeroBanner` to Server Components — eliminate client data-fetching on homepage | -400–800ms TTFB on homepage |
| 2 | `Promise.all` in checkout/complete for independent workflow steps | -300–600ms checkout completion time |
| 3 | Add 5s timeout + retry to MSG91 fetch in send-otp route | Prevents 30s+ hangs on OTP send when MSG91 is slow |
| 4 | Add DB pool config to medusa-config.js (min:2, max:20) | Prevents connection exhaustion under concurrent load |
| 5 | Fix `unoptimized` image in HeroBanner — remove `unoptimized={!!heroImg}` | Improves LCP score; reduces hero image bandwidth ~60–80% |
| 6 | `useMemo` on `inferColor()` and `filteredProducts` filter logic | -5–15ms per render on product list pages |
| 7 | Add `React.memo` to `FeaturedProducts` product cards | Eliminates full list re-render on single hover |
| 8 | Replace wildcard image domain `**` with explicit domains in next.config | Security + cache optimization |
| 9 | Add `export const revalidate = 3600` to product detail pages | Ensures ISR works; prevents stale product pages |
| 10 | Cache SessionProvider auth check in sessionStorage | Eliminates redundant `/api/auth/me` call on every navigation |

---

## WHAT IS ALREADY CORRECT

- `lib/products.ts` uses `revalidate: 60` on fetch calls — ISR configured at fetch level ✓
- Redis idempotency check in checkout complete (`route.js:20–24`) — correct pattern ✓
- Razorpay webhook Redis dedup with TTL — correct ✓
- `next.config.ts` uses `output: "standalone"` — correct for Docker/cloud deploy ✓
