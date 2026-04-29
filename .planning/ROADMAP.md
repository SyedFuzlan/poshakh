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

**Status:** not-started  
**Plans:** 3 plans

Plans:
- [ ] 01-PLAN-01.md — DB migration: add description column + product_variants table
- [ ] 01-PLAN-02.md — API update: GET /:id with LEFT JOIN variants, POST / variant insert, dashboard form
- [ ] 01-PLAN-03.md — UI update: wire size selector to real variants, OOS states, remove dead Medusa code

---

## Phase 02 — Product Update Endpoint

**Goal:** Owner can edit product name, price, description, stock from the dashboard without deleting and re-adding.

**Status:** not-started

### Plans

- [ ] 02-01: Add `PATCH /api/products/:id` backend endpoint
- [ ] 02-02: Wire edit form in owner dashboard (`/dashboard` products tab)

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
