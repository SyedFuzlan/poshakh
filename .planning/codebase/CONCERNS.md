# Concerns

## Technical Concerns
- **Synchronous Database**: `sql.js` in synchronous mode blocks the Node.js event loop. This is risky for high-traffic production environments.
- **Local Storage**: Images are stored in `backend/data/uploads`. This makes horizontal scaling difficult (e.g., if deploying multiple instances).
- **Legacy Admin**: The dashboard in `backend/dashboard/` is a legacy single-file HTML/JS app. It is harder to maintain and test compared to the modern Next.js frontend.

## Operational Concerns
- **Manual Backups**: Backups depend on a script (`backup.js`) and local disk persistence.
- **Deployment**: Synchronizing schema changes between environments requires the server to run migrations on startup correctly.
