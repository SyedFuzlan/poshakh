# Production Environment Checklist — Poshakh Backend (Railway)

Ensure these variables are set in the Railway dashboard before deploying.

| Variable | Description | Example / Recommended |
|---|---|---|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Listening port | `9000` (Railway often provides this) |
| `OWNER_EMAIL` | Dashboard admin login | `admin@poshakh.in` |
| `OWNER_PASSWORD` | Dashboard admin password | [Strong Password] |
| `JWT_SECRET` | Secret for auth tokens | [Long Random String] |
| `STORE_CORS` | Allowed frontend origins | `https://poshakh.vercel.app` |
| `DATABASE_PATH` | Path to persistent SQLite file | `/app/data/poshakh.db` |
| `COOKIE_SECURE` | Enforce HTTPS for cookies | `true` |

## Infrastructure Notes
- **Railway Volume:** Mount a volume at `/app/data`.
- **Root Directory:** `./backend` (if deploying from a monorepo).
- **Health Check Path:** `/`
