# Poshakh Backend API

Simple Express.js + SQLite backend for the Poshakh e-commerce store.

## Folder Structure

```
backend/
  server.js              ← Entry point
  db.js                  ← SQLite database (sql.js, pure JS)
  routes/
    auth.js              ← POST /api/auth/login
    products.js          ← GET / POST / DELETE /api/products
    orders.js            ← GET /api/orders, PATCH /api/orders/:id/ship
    payments.js          ← Razorpay + UPI payment endpoints
  middleware/
    requireOwner.js      ← JWT guard for owner-only routes
  dashboard/
    index.html           ← Owner dashboard (open in browser)
  uploads/               ← Product images (created automatically)
  data/
    poshakh.db           ← SQLite database file (created automatically)
  .env                   ← Your secrets (never commit this)
  .env.example           ← Template — copy to .env and fill in
```

---

## Run Locally

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure your .env
```bash
# Edit backend/.env and set:
OWNER_EMAIL=your@email.com
OWNER_PASSWORD=YourPassword
JWT_SECRET=any-long-random-string
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

### 3. Start the server
```bash
npm start
# or for auto-reload during development:
npm run dev
```

### 4. Open the dashboard
Navigate to: **http://localhost:9000/dashboard**

---

## Razorpay Test Keys

1. Go to https://dashboard.razorpay.com
2. Sign up / Log in
3. Go to **Settings → API Keys**
4. Make sure you're in **Test Mode** (toggle at top)
5. Click **Generate Key** → copy Key ID and Key Secret
6. Paste into `backend/.env`

**Test card for Razorpay:**
- Card: `4111 1111 1111 1111`
- Expiry: any future date
- CVV: any 3 digits
- OTP: `1234` (in test mode)

**Test UPI:** Use `success@razorpay` as the UPI ID in test mode

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | Public | List all products |
| GET | `/api/products/:id` | Public | Single product |
| POST | `/api/products` | Owner | Add product (multipart/form-data) |
| DELETE | `/api/products/:id` | Owner | Delete product |
| POST | `/api/payments/create-order` | Public | Create Razorpay order |
| POST | `/api/payments/verify` | Public | Verify payment + save order |
| POST | `/api/payments/upi-confirm` | Public | Save UPI order with UTR |
| POST | `/api/payments/webhook` | Razorpay | Async payment confirmation |
| GET | `/api/orders` | Owner | List all orders |
| GET | `/api/orders/stats` | Owner | Today's stats |
| PATCH | `/api/orders/:id/ship` | Owner | Mark order as shipped |
| POST | `/api/auth/login` | — | Owner login |
| POST | `/api/auth/verify` | Owner | Verify token |

---

## Deploy to Railway

1. Go to https://railway.app and create a new project
2. Click **Deploy from GitHub repo** → connect your repo
3. Add a service for the **backend** folder:
   - Root directory: `backend`
   - Start command: `npm start`
4. Add the following environment variables in Railway dashboard:
   ```
   OWNER_EMAIL=your@email.com
   OWNER_PASSWORD=YourStrongPassword
   JWT_SECRET=generate-with-openssl-rand-base64-32
   STORE_CORS=https://your-frontend-domain.railway.app
   RAZORPAY_KEY_ID=rzp_live_...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=...
   ```
5. Add a **Volume** in Railway and mount it at `/app/data` to persist the database
6. Deploy the **frontend** as a separate Railway service:
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Start command: `npm start`
   - Environment: `NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://your-api.railway.app`

---

## Owner Dashboard Login

Default credentials (change these in `.env` before deploying!):
- **Email:** `admin@poshakh.in`
- **Password:** `ChangeMe123!`

**⚠️ Change `OWNER_PASSWORD` in `.env` before going live.**
