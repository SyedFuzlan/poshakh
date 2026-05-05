# Phase 04: Production Deploy - Discussion Log

**Date:** 2026-05-05
**Participants:** USER, Antigravity

## Gray Areas & Decisions

### Hosting & Infrastructure
- **Options presented:** Vercel/Railway/Render/VPS.
- **User selection:** Vercel for Frontend, Railway for Backend.
- **Notes:** Railway was selected for the backend because it supports persistent volumes for SQLite and offers a good free/low-cost tier.

### Database Strategy
- **Options presented:** Persistent Volumes vs. Managed Postgres (Neon) vs. Litestream.
- **User selection:** Railway Persistent Volumes (SQLite).
- **Notes:** The user preferred sticking with Railway for the backend and using their choice of persistence. SQLite + Volumes was confirmed as the best fit for the project's current maturity.

### Payment Methods
- **Options presented:** Razorpay vs. Manual UPI vs. COD.
- **User selection:** Disable Razorpay; Keep Manual UPI and COD.
- **Rationale:** Razorpay test mode was not correctly showing UPI options, which is a priority for the user. Manual UPI with UTR verification is a reliable fallback for the v1 launch.

### Domain Strategy
- **Options presented:** Custom Domain vs. Provider Subdomains.
- **User selection:** Provider subdomains for now.
- **Notes:** Subdomains (`vercel.app`, `up.railway.app`) will be used to expedite the launch. Custom domain is noted for a future phase.

## Deferred Ideas
- Custom domain integration.
- Razorpay reactivation/reconfiguration.
- Migration to managed PostgreSQL.

## Action Items
- [ ] Create deployment plan (Phase 04).
- [ ] Research Railway Volume mounting syntax.
- [ ] Research Vercel environment variable propagation for Next.js 15.
