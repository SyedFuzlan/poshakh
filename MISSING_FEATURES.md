> ⚠️ **ARCHIVED — 2026-04-29**
> Medusa.js has been removed. This document listed missing features relative to the Medusa architecture and is now obsolete. Do not act on this document. Current gaps are tracked in **PROGRESS.md**.

---

# MISSING FEATURES — POSHAKH
> Priority-ordered by business and engineering impact  
> Date: 2026-04-25

---

## CATEGORY A — BLOCKING (cannot go to production without these)

### A1. Frontend Application
**What**: Entire Next.js frontend is missing. The `frontend/` directory is empty.  
**Impact**: Zero user-facing product. Nothing can be used, tested, or demoed.  
**Required**:
- Product listing page with category filters
- Product detail page with size selector + image gallery
- Cart (add, update quantity, remove)
- Checkout flow (address → shipping → Razorpay payment)
- Authentication pages (signup, login, forgot password, OTP verify)
- Order confirmation page
- User profile / order history
- Mobile-first responsive design (Indian mobile-heavy demographic)

---

### A2. Password-Based Authentication
**What**: Password field does not exist in customer model. No bcrypt/argon2 installed.  
**Impact**: Users cannot register with a password or log back in after sessions expire.  
**Required endpoints**:
- `POST /store/auth/signup` — Accept name, email, phone, password; hash password; send email OTP
- `POST /store/auth/login` — Accept phone or email + password; verify + return session
- `POST /store/auth/forgot-password` — Accept identifier; send OTP to email/phone
- `POST /store/auth/reset-password` — Accept OTP + new password; update hash
- `GET /store/auth/me` — Return current authenticated customer
- `POST /store/auth/logout` — Invalidate session

**Required packages**: `bcrypt` (or `argon2`), `zod` (validation)

---

### A3. Email OTP Delivery
**What**: Email OTP code path hits a `console.log` in dev and does nothing in production.  
**Impact**: Users with email identifiers cannot complete OTP verification.  
**Required**:
- Install `resend` SDK
- Implement transactional email template for OTP
- Handle delivery failures gracefully (retry + fallback)
- Store Resend API key in env config

---

### A4. Brute-Force Protection on Auth Endpoints
**What**: `/store/auth/verify-otp` has no attempt limit. Only a 60-second rate limit on `/send-otp`.  
**Impact**: An attacker can brute-force a 6-digit OTP (1,000,000 possibilities) with high-frequency requests from multiple IPs.  
**Required**:
- Max 5 verification attempts per OTP before it is invalidated
- Per-IP rate limiting on all auth endpoints
- Exponential backoff or account lockout after repeated failures
- CAPTCHA integration (hCaptcha or reCAPTCHA) for high-risk flows

---

### A5. Razorpay Webhook Handler
**What**: Payment confirmation is client-driven only (frontend calls `/verify-payment`). No server-side webhook from Razorpay.  
**Impact**: If a user closes the browser after payment is captured but before the frontend calls verify-payment, the order will not be created. Money is collected but order is lost.  
**Required**:
- `POST /webhooks/razorpay` — Verify webhook signature; trigger order completion
- Store idempotency records to prevent duplicate processing
- Mark payment as captured in Medusa order system
- Trigger order confirmation email on webhook receipt

---

## CATEGORY B — HIGH PRIORITY (required for v1 launch)

### B1. Order Confirmation Notifications
**What**: No email or SMS sent after a successful order.  
**Required**:
- Transactional email (Resend): order summary, items, shipping address, estimated delivery
- SMS (Twilio/MSG91): short confirmation with order number

---

### B2. Order History & Tracking
**What**: No endpoint or UI for customers to view past orders.  
**Required**:
- `GET /store/orders` — List orders for authenticated customer
- `GET /store/orders/:id` — Order details with items, tracking, status
- Order status states: pending → confirmed → shipped → delivered → cancelled

---

### B3. User Profile & Address Book
**What**: No profile management for customers.  
**Required**:
- `GET/PATCH /store/customers/me` — View and update name, email, phone
- `GET/POST/DELETE /store/customers/me/addresses` — Saved shipping addresses
- Default address selection

---

### B4. Product Search & Filters
**What**: No search or filtering capability.  
**Required**:
- Full-text product search (Medusa supports MeiliSearch integration)
- Filter by: category, price range, size, color, occasion
- Sort by: price (asc/desc), newest, popularity
- Pagination with cursor-based navigation

---

### B5. Inventory Management in Admin
**What**: Admin panel has no custom functionality beyond Medusa defaults.  
**Required**:
- Low-stock alerts
- Bulk product import (CSV)
- Product variant management (add/remove sizes, update prices)
- Order fulfillment workflow (mark shipped, add tracking number)

---

### B6. Email Verification Flow
**What**: Users can register with any email without verifying it belongs to them.  
**Required**:
- On signup: send verification link or OTP to email
- Block unverified users from placing orders (or add warning)
- Resend verification email endpoint

---

## CATEGORY C — IMPORTANT (v1.1 or early post-launch)

### C1. Wishlist
- `POST/DELETE /store/customers/me/wishlist` — Save and remove products
- Wishlist display on frontend
- "Move to cart" action

### C2. Product Reviews & Ratings
- `POST /store/products/:id/reviews` — Submit review (authenticated)
- `GET /store/products/:id/reviews` — Paginated reviews
- Admin moderation queue

### C3. Coupon / Discount System
- Medusa has promotion engine built in; needs configuration and frontend wiring
- Promo codes at checkout
- Percentage and fixed discounts

### C4. Return / Refund Flow
- `POST /store/orders/:id/return-request` — Customer initiates return
- Admin approval workflow
- Razorpay refund initiation

### C5. Multi-Language Support (Hindi)
- `ai-brain/PROJECT_STATUS.md` mentions i18n skeleton exists in admin
- Product descriptions in Hindi
- UI strings in Hindi (React-Intl or next-intl)

### C6. Social Login
- Google OAuth (high conversion for Indian users)
- Medusa supports custom auth strategies

### C7. COD (Cash on Delivery)
- Very common expectation in Indian e-commerce
- Medusa supports custom payment providers

### C8. SMS Order Updates
- Shipment dispatched, out for delivery, delivered
- Twilio Verify for reliability

---

## CATEGORY D — SCALING & INFRASTRUCTURE (v2)

### D1. CDN for Product Images
- Currently no image storage configured
- Implement Cloudflare R2 or AWS S3 + CloudFront
- Image optimization (WebP, responsive sizing)

### D2. Elasticsearch / MeiliSearch
- Medusa has first-class MeiliSearch support
- Required for fast full-text search at scale

### D3. Redis Cluster / Sentinel
- Current single Redis is a single point of failure
- Upgrade to Redis Sentinel for HA

### D4. Async Order Processing Queue
- Use BullMQ for background job processing
- Order confirmation, inventory deduction, fulfillment triggers

### D5. Analytics & Business Intelligence
- Sales dashboard in admin (revenue, orders, top products)
- Customer cohort analysis
- Conversion funnel tracking

### D6. PWA / Mobile App
- Indian users are mobile-first
- Progressive Web App or React Native app

---

## COMPLETE FEATURE CHECKLIST

| # | Feature | Priority | Status |
|---|---------|---------|--------|
| 1 | Frontend application | BLOCKING | Missing |
| 2 | Password auth (signup/login/reset) | BLOCKING | Not started |
| 3 | Email OTP delivery | BLOCKING | Stubbed |
| 4 | Brute-force protection | BLOCKING | Missing |
| 5 | Razorpay webhook handler | BLOCKING | Missing |
| 6 | Order confirmation notifications | HIGH | Missing |
| 7 | Order history & tracking | HIGH | Missing |
| 8 | User profile & address book | HIGH | Missing |
| 9 | Product search & filters | HIGH | Missing |
| 10 | Admin inventory management | HIGH | Missing |
| 11 | Email verification flow | HIGH | Missing |
| 12 | Wishlist | MEDIUM | Missing |
| 13 | Product reviews | MEDIUM | Missing |
| 14 | Coupons / discounts | MEDIUM | Unconfigured |
| 15 | Return / refund flow | MEDIUM | Missing |
| 16 | Multi-language (Hindi) | MEDIUM | Skeleton only |
| 17 | Social login (Google) | LOW | Missing |
| 18 | Cash on Delivery | LOW | Missing |
| 19 | SMS order updates | LOW | Missing |
| 20 | CDN for images | SCALE | Missing |
| 21 | MeiliSearch | SCALE | Missing |
| 22 | Redis HA (Sentinel/Cluster) | SCALE | Missing |
| 23 | Async job queue (BullMQ) | SCALE | Missing |
| 24 | Analytics dashboard | SCALE | Missing |
