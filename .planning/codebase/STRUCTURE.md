# Structure

## Root
- `backend/`: Core business logic and API.
- `frontend/`: Storefront application.
- `.planning/`: GSD workflow state and codebase mapping.

## Backend Detail
- `server.js`: Entry point.
- `db.js`: Database wrapper and migrations.
- `routes/`: Endpoint definitions (auth, products, orders, etc.).
- `dashboard/`: Admin panel UI.
- `data/`: SQLite database file and file uploads.
- `utils/`: Shared helpers (logger, middleware).

## Frontend Detail
- `src/app/`: Next.js pages and layouts.
- `src/components/`: Reusable UI components.
- `src/hooks/`: Custom React hooks.
- `src/store/`: Zustand state definitions.
- `public/`: Static assets.
