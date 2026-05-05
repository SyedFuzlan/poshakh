# ROADMAP — Poshakh

**Project:** Poshakh — Indian fashion e-commerce  
**Stack:** Next.js 15 · Express.js · SQLite (sql.js) · Razorpay · Tailwind  
**Source of truth:** `PROGRESS.md` (updated each session)  
**Last imported:** 2026-04-29

---

## Milestone: v1 Production Launch

Move from ~80% functional local app to fully deployed, customer-ready store.

---

## Phase 01 — Product Descriptions & Variants

**Goal:** Products have descriptions and size variants that are stored in the DB, served via API, and shown on the product detail page.

**Status:** complete (2026-04-29)  
**Plans:** 3/3 complete

**Wave 1**
- [x] 01-PLAN-01.md — DB migration: add description column + product_variants table

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-PLAN-02.md — API update: GET /:id with LEFT JOIN variants, POST / variant insert, dashboard form

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-PLAN-03.md — UI update: wire size selector to real variants, OOS states, remove dead Medusa code

**Cross-cutting constraints:**
- `db.prepare().run()/.get()/.all()` pattern required in all backend route tasks
- `product.variants` shape `{ id, size, stock }` produced by Plan 02 and consumed by Plan 03

---

## Phase 02 — Product Update Endpoint

**Goal:** Owner can edit product name, price, description, stock from the dashboard without deleting and re-adding.

**Status:** complete (2026-05-05)  
**Plans:** 2/2 complete

**Wave 1**
- [x] 02-PLAN-01.md — Add `PATCH /api/products/:id` backend endpoint to `backend/routes/products.js`

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-PLAN-02.md — Wire edit modal in owner dashboard (`backend/dashboard/index.html`)

---

## Phase 03 — End-to-End Test

**Goal:** Full verified purchase flow — signup → browse → cart → checkout → order in dashboard.

**Status:** not-started

### Plans

- [ ] 03-01: Sign up test customer, add ₹10 test product to cart, complete checkout (Razorpay test + UPI), verify order appears in `/dashboard`

---

## Phase 04 — Production Deploy

**Goal:** App live on the internet. Real customers can browse and buy.

**Status:** not-started

### Plans

- [ ] 04-01: Set `COOKIE_SECURE=true`, configure `NEXT_PUBLIC_BACKEND_URL` for live server
- [ ] 04-02: Choose hosting (Railway/Render backend, Vercel frontend), deploy both
- [ ] 04-03: Configure Razorpay webhook URL to production endpoint
- [ ] 04-04: Smoke test live URL — signup, cart, checkout

---

## Backlog

(Items deferred from prior phases go here as `999.x`)
