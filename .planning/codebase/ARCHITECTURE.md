# Architecture

## System Pattern
- **Decoupled Client-Server**: The project consists of a separate Node.js backend and a Next.js frontend.
- **RESTful API**: Communication between frontend and backend is via HTTP REST endpoints.

## Backend Architecture
- **Monolithic API**: Single Express server (`backend/server.js`).
- **Synchronous Database**: `sql.js` wrapper provides a synchronous API for SQLite operations, simplified for rapid development but potentially a bottleneck for high concurrency.
- **Schema Management**: Automated migrations handled in `backend/db.js` on startup.
- **Legacy Admin**: A standalone HTML/JS dashboard resides in `backend/dashboard/`.

## Frontend Architecture
- **App Router**: Modern Next.js routing structure.
- **Server Components**: Leveraged for data fetching where appropriate.
- **Client State**: Zustand stores manage global UI state and cart.
