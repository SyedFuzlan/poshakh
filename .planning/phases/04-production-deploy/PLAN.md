# Phase 04: Production Deploy — Implementation Plan

**Goal:** App live on the internet. Real customers can browse and buy.

## Strategy
We are deploying a decoupled architecture with Next.js on Vercel and Express on Railway. Persistence is handled by Railway Volumes for the SQLite file.

## Plans

| Plan | Objective | Status |
|---|---|---|
| [04-PLAN-01.md](04-PLAN-01.md) | Backend Production Prep | ready |
| [04-PLAN-02.md](04-PLAN-02.md) | Frontend Production Prep | ready |
| [04-PLAN-03.md](04-PLAN-03.md) | Live Deployment & Smoke Test | ready |

## Branch Invariants
- `main` branch must always reflect the production-ready state.
- `NODE_ENV=production` must be set in all production environments.
- API endpoints must not be hardcoded to `localhost`.

## Verification Gates
1. **Local Build Check:** Both frontend and backend must build locally without errors.
2. **Infrastructure Verification:** Railway volumes must be verified as mounted.
3. **Smoke Test Pass:** A complete checkout flow must succeed on the live environment.

---
*Phase: 04-production-deploy*
*Updated: 2026-05-05*
