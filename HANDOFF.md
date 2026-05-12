# Session Handoff — 2026-05-12

## Production Status

**Payment flow is working end-to-end.**
- Razorpay test mode: orders complete, appear in Railway dashboard at https://poshakh-production.up.railway.app/dashboard/
- Deployed: Railway (backend) + Vercel (frontend), both from `master`

---

## Completed This Session

### Bugs fixed (all merged to `master`)

| Commit | Fix |
|--------|-----|
| `3ef0ac3` | `ReferenceError: razorpay_payment_id is not defined` in `backend/routes/payments.js:342` |
| `4559b27` | Frontend used baked `NEXT_PUBLIC_RAZORPAY_KEY_ID` instead of `data.key_id` from backend |
| `550a548` | `column "price" does not exist` — `saveOrder` queried `price`, table only has `price_paise` |
| `23a1fd6` | Removed debug `Details:` leak from payment error alert (`frontend/src/app/checkout/page.tsx:258`) |

### Env cleanup
- PostHog key fixed: was `phx_...` (personal key → 401), now `phc_pM8EDJDs4xZdyonE2yY4DzNRA69F5u7pLJXvMFryZTY6` in `frontend/.env.local`, `.env`, and Vercel
- `NEXT_PUBLIC_POSTHOG_HOST` added to Vercel (was missing)
- Vercel stripped of 24 Railway/backend-only vars that leaked in — only frontend vars remain
- Razorpay: live keys go in **Railway only** (frontend gets `key_id` from backend API response)

---

## What Already Exists (do not rebuild)

| Feature | Status | Location |
|---------|--------|----------|
| SMS on ship | Working — Fast2SMS | `backend/utils/sms.js` — `notifyShipped()` |
| SMS on deliver | Working — Fast2SMS | `backend/utils/sms.js` — `notifyDelivered()` |
| SMS on order confirm | Working — Fast2SMS | `backend/utils/sms.js` — `notifyOrderConfirmed()` |
| Email verification | Working — Resend | `backend/utils/email.js` — `sendVerificationEmail()` |
| Email password reset | Working — Resend | `backend/utils/email.js` — `sendPasswordResetEmail()` |
| Email order confirm | Working — Resend | `backend/utils/email.js` — `sendOrderConfirmationEmail()` |
| Dashboard SHIP button | Exists — manual courier + tracking entry | `backend/dashboard/dashboard.js:331` |
| Order status machine | paid → processing → shipped → delivered | `backend/routes/orders.js:255` |

---

## Next Session — Priority Order

### 1. Delhivery integration (main next feature)

**Workflow to build:**
```
Admin clicks SHIP
  → backend calls Delhivery API → creates shipment → gets AWB (tracking number)
  → saves AWB, courier = "Delhivery", status → shipped
  → existing notifyShipped() SMS fires automatically
  → [async] Delhivery delivers → POSTs webhook to /api/webhooks/delhivery
  → backend marks order → delivered, existing notifyDelivered() SMS fires
  → dashboard shows ✅ Delivered
```

**What to build:**
1. `backend/utils/delhivery.js` — `createShipment(order)` → returns `{ awb, label_url }`
   - Delhivery sandbox: `https://staging-express.delhivery.com`
   - Prod: `https://express.delhivery.com`
   - Auth: `Authorization: Token <DELHIVERY_TOKEN>`
   - Env vars needed: `DELHIVERY_TOKEN`, `DELHIVERY_PICKUP_NAME`
2. `POST /api/orders/:id/create-shipment` — owner-auth, calls Delhivery, saves AWB, triggers SMS
3. Dashboard SHIP button → call new endpoint (keep manual fallback if Delhivery is down)
4. `POST /api/webhooks/delhivery` — receive delivery status, update order → delivered
5. DB migration: add `delhivery_awb VARCHAR(100)`, `delhivery_label_url TEXT` to orders table

**Decision: SMS only (no WhatsApp for now)**
- Fast2SMS already works, ~₹0.15–0.25/msg
- WhatsApp (MSG91) = 2–3× more expensive, extra setup — post-launch

### 2. Swap Razorpay test → live keys in Railway

### 3. Test COD and UPI payment flows

### 4. Resend sender domain
- Resend needs a verified domain (`poshakh.in`) in Resend dashboard for production emails to deliver

---

## Env Vars Reference

### Railway (backend)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — swap to live before launch
- `RAZORPAY_WEBHOOK_SECRET` — already set
- `FAST2SMS_API_KEY` — SMS, already set
- `RESEND_API_KEY` — email, already set
- `DELHIVERY_TOKEN` — **add when integrating Delhivery**
- `DELHIVERY_PICKUP_NAME` — **add when integrating Delhivery**

### Vercel (frontend only)
- `NEXT_PUBLIC_API_URL`, `API_URL`, `COOKIE_SECRET`, `COOKIE_SECURE`, `NODE_ENV`
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
