// ──────────────────────────────────────────────
//  routes/payments.js
//  POST /api/payments/create-order   — create Razorpay order
//  POST /api/payments/verify         — verify signature + save order to DB
//  POST /api/payments/upi-confirm    — save UPI order (manual UTR entry)
//  POST /api/payments/webhook        — Razorpay webhook (async fallback)
// ──────────────────────────────────────────────
const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const db = require("../db").db;

const router = express.Router();

// Lazily instantiate Razorpay so missing keys don't crash at startup
function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// ── Generate unique order ID ────────────────────
function generateOrderId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PSK-${ts}-${rand}`;
}

// ── Validate order_data shape ───────────────────
function validateOrderData(data) {
  if (!data) return "order_data is required";
  if (!data.customer_name?.trim()) return "customer_name is required";
  if (!data.customer_phone?.trim()) return "customer_phone is required";
  if (!data.address?.line1?.trim()) return "address.line1 is required";
  if (!data.address?.city?.trim()) return "address.city is required";
  if (!data.address?.state?.trim()) return "address.state is required";
  if (!data.address?.pin_code?.trim()) return "address.pin_code is required";
  if (!Array.isArray(data.items) || data.items.length === 0) return "items must be a non-empty array";
  if (!data.total || data.total <= 0) return "total must be a positive number";
  return null;
}

// ── Save order to DB ────────────────────────────
function saveOrder({ orderId, paymentMethod, razorpayPaymentId, razorpayOrderId, utr, orderData }) {
  const {
    customer_name,
    customer_phone,
    customer_email,
    address,
    items,
    subtotal = orderData.total,
    shipping_method = "free",
    shipping_cost = 0,
    total,
  } = orderData;

  db.prepare(`
    INSERT INTO orders (
      id, razorpay_payment_id, razorpay_order_id, utr, payment_method,
      customer_name, customer_phone, customer_email,
      address_line1, address_line2, city, state, pin_code,
      items_json, subtotal_paise, shipping_method, shipping_cost_paise,
      total_paise, status
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
  `).run(
    orderId,
    razorpayPaymentId || null,
    razorpayOrderId || null,
    utr || null,
    paymentMethod,
    customer_name.trim(),
    customer_phone.trim(),
    customer_email?.trim() || null,
    address.line1.trim(),
    (address.line2 || "").trim(),
    address.city.trim(),
    address.state.trim(),
    address.pin_code.trim(),
    JSON.stringify(items),
    Math.round(subtotal * 100),    // store in paise
    shipping_method,
    Math.round(shipping_cost * 100),
    Math.round(total * 100),
    paymentMethod === "upi" ? "pending_verification" : (paymentMethod.toUpperCase() === "COD" ? "pending" : "paid")
  );
}

// ── POST /api/payments/create-order ────────────
// Creates a Razorpay order. Does NOT save to DB yet (payment might fail).
router.post("/create-order", async (req, res) => {
  try {
    const { amount_in_rupees } = req.body;

    if (!amount_in_rupees || amount_in_rupees <= 0) {
      return res.status(400).json({ error: "amount_in_rupees must be a positive number" });
    }

    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(amount_in_rupees * 100), // paise
      currency: "INR",
      receipt: `psk_${Date.now()}`,
    });

    res.json({
      razorpay_order_id: rzpOrder.id,
      key_id: process.env.RAZORPAY_KEY_ID,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    });
  } catch (err) {
    console.error("POST /api/payments/create-order error:", err);
    res.status(500).json({ error: err.message || "Failed to create payment order" });
  }
});

// ── POST /api/payments/verify ───────────────────
// Verifies Razorpay signature, saves confirmed order to DB.
router.post("/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_data,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Razorpay fields are required" });
    }

    const validationError = validateOrderData(order_data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Verify signature — this is how we confirm Razorpay actually received payment
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      console.error("Payment signature mismatch!", { razorpay_order_id, razorpay_payment_id });
      return res.status(400).json({ success: false, error: "Payment verification failed" });
    }

    // Check for duplicate (idempotent — safe if frontend retries)
    const existing = db
      .prepare("SELECT id FROM orders WHERE razorpay_payment_id = ?")
      .get(razorpay_payment_id);

    if (existing) {
      return res.json({ success: true, order_id: existing.id, duplicate: true });
    }

    const orderId = generateOrderId();
    saveOrder({
      orderId,
      paymentMethod: "razorpay",
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      utr: null,
      orderData: order_data,
    });

    console.log(`✅ Order saved: ${orderId} | Payment: ${razorpay_payment_id}`);
    res.json({ success: true, order_id: orderId });
  } catch (err) {
    console.error("POST /api/payments/verify error:", err);
    res.status(500).json({ success: false, error: "Failed to verify payment" });
  }
});

// ── POST /api/payments/upi-confirm ─────────────
// Customer manually enters UTR after UPI transfer. Saved as pending_verification.
router.post("/upi-confirm", (req, res) => {
  try {
    const { utr, order_data } = req.body;

    if (!utr?.trim()) {
      return res.status(400).json({ error: "UTR / Transaction ID is required" });
    }

    const validationError = validateOrderData(order_data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Prevent duplicate UTR submissions
    const existing = db.prepare("SELECT id FROM orders WHERE utr = ?").get(utr.trim());
    if (existing) {
      return res.json({ success: true, order_id: existing.id, duplicate: true });
    }

    const orderId = generateOrderId();
    saveOrder({
      orderId,
      paymentMethod: "upi",
      razorpayPaymentId: null,
      razorpayOrderId: null,
      utr: utr.trim(),
      orderData: order_data,
    });

    console.log(`📱 UPI order saved: ${orderId} | UTR: ${utr.trim()}`);
    res.json({ success: true, order_id: orderId });
  } catch (err) {
    console.error("POST /api/payments/upi-confirm error:", err);
    res.status(500).json({ success: false, error: "Failed to save UPI order" });
  }
});

// ── POST /api/payments/webhook ──────────────────
// Razorpay calls this asynchronously. Used as a fallback to catch payments
// that may have slipped through (e.g. browser crash after payment).
router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // raw body for signature check
  (req, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.warn("RAZORPAY_WEBHOOK_SECRET not set — skipping webhook verification");
        return res.status(200).json({ status: "ignored" });
      }

      const signature = req.headers["x-razorpay-signature"];
      const expectedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(req.body)
        .digest("hex");

      if (signature !== expectedSig) {
        console.error("Webhook signature mismatch");
        return res.status(400).json({ error: "Invalid webhook signature" });
      }

      const event = JSON.parse(req.body.toString());
      console.log(`📨 Razorpay webhook: ${event.event}`);

      if (event.event === "payment.captured") {
        const payment = event.payload?.payment?.entity;
        if (payment) {
          const existing = db
            .prepare("SELECT id FROM orders WHERE razorpay_payment_id = ?")
            .get(payment.id);

          if (!existing) {
            // Payment captured but order not in DB (e.g. verify call failed)
            // Mark for manual review — we log but don't auto-create the order
            // because we don't have the shipping address from the webhook alone
            console.error(`⚠️  Orphaned payment ${payment.id} — not in orders DB. Manual review needed.`);
          } else {
            // Ensure status is 'paid'
            db.prepare(
              "UPDATE orders SET status = 'paid' WHERE id = ? AND status = 'pending_verification'"
            ).run(existing.id);
          }
        }
      }

      res.json({ status: "ok" });
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

module.exports = {
  router,
  generateOrderId,
  validateOrderData,
  saveOrder
};
