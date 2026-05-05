# Phase 04: Production Deploy - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the Poshakh e-commerce platform (Frontend + Backend) to production environments so that it is accessible to real customers.

This includes infrastructure setup, environment configuration, database persistence strategy, and payment method refinement.

</domain>

<decisions>
## Implementation Decisions

### Hosting Strategy
- **D-01:** Frontend will be deployed on **Vercel** (Next.js 15 App Router).
- **D-02:** Backend will be deployed on **Railway** (Express.js + Node.js).
- **D-03:** Use **Provider Subdomains** for the initial launch (e.g., `*.vercel.app` and `*.up.railway.app`). Custom domain is deferred.

### Database Persistence
- **D-04:** Continue using **SQLite (sql.js)** as the production database.
- **D-05:** Configure **Railway Persistent Volumes** to mount the `data/` directory. This ensures the `poshakh.db` file is preserved across deployments and container restarts.

### Payment Method Refinement
- **D-06:** **Disable Razorpay** for the initial launch. The frontend Razorpay button and logic should be commented out or removed from the checkout flow.
- **D-07:** **Primary Payment:** Manual UPI. Keep the existing flow where customers pay to a static UPI ID and provide a UTR for manual verification.
- **D-08:** **Secondary Payment:** Cash on Delivery (COD). Keep the existing COD flow.

### Environment & Security
- **D-09:** Set `COOKIE_SECURE=true` in the frontend production environment to enforce HTTPS-only cookies.
- **D-10:** Update `NEXT_PUBLIC_BACKEND_URL` in the frontend to point to the live Railway backend URL.
- **D-11:** Generate and set a strong `JWT_SECRET` and `COOKIE_SECRET` for the production environment.
- **D-12:** Set production `OWNER_EMAIL` and `OWNER_PASSWORD` in the Railway environment variables.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Progress
- `PROGRESS.md` — Current stack info (Express + SQLite) and next steps.
- `.planning/ROADMAP.md` — Phase 04 high-level plan.

### Deployment Config
- `docker-compose.yml` — Local orchestration (reference for Railway setup).
- `backend/server.js` — Server entry point and environment variable usage.
- `frontend/src/app/checkout/page.tsx` — Checkout flow (where Razorpay needs to be disabled).

### Prior Context
- `.planning/phases/01-product-descriptions-variants/01-CONTEXT.md`
- `.planning/phases/02-product-update-endpoint/02-CONTEXT.md`

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<specifics>
## Specific Ideas

- Ensure Railway volume is mounted at `/app/data` to match the expected database path.
- Check that the `uploads/` directory is also included in the persistent volume if we want to persist product images uploaded via the dashboard.

</specifics>

<deferred>
## Deferred Ideas

- Custom Domain Setup (`poshakh.in` or similar) — deferred to a post-launch phase.
- Razorpay UPI/Payment Gateway reactivation — deferred until test mode UPI issues are resolved or live keys are acquired.
- Migration to managed PostgreSQL (Neon) — deferred; SQLite + Volumes is sufficient for v1.

</deferred>

---

*Phase: 04-production-deploy*
*Context gathered: 2026-05-05*
