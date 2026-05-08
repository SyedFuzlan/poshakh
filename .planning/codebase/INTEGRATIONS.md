# Integrations

## Payments
- **Razorpay**: Used for processing payments. Integration involves:
  - `backend/routes/payments.js`: Order creation and webhook handling.
  - Razorpay Webhooks: Verified via secret to update order status to `paid`.

## Analytics
- **PostHog**: Frontend integration for user behavior tracking.

## Storage
- **Local Disk**: `backend/data/uploads` stores product images uploaded via the admin dashboard using Multer.
