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
const { notifyOrderConfirmed } = require("../utils/sms");

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

const logger = require("../utils/logger");

// ── Save order to DB ────────────────────────────
// Uses a flat orders table that stores address fields inline + items as JSON.
function saveOrder({ orderId, paymentMethod, razorpayPaymentId, razorpayOrderId, utr, orderData }) {
  const {
    customer_name,
    customer_phone,
    customer_email,
    address,
    items,
    shipping_method = "free",
    shipping_cost = 0,
  } = orderData;

  const status = paymentMethod === "upi"
    ? "pending_verification"
    : paymentMethod.toUpperCase() === "COD"
      ? "pending"
      : "paid";

  // Using db.transaction to ensure atomicity
  return db.transaction(() => {
    let calculatedSubtotalPaise = 0;
    
    // 1. Verify stock and Recalculate Price for all items
    if (Array.isArray(items)) {
      for (const item of items) {
        if (!item.product_id || !item.size) continue;
        
        // Fetch product and variant details from DB
        const product = db.prepare(`SELECT price, price_paise FROM products WHERE id = ?`).get(item.product_id);
        const variant = db.prepare(`
          SELECT stock FROM product_variants 
          WHERE product_id = ? AND size = ?
        `).get(item.product_id, item.size);

        if (!product || !variant) {
          logger.warn({ orderId, product_id: item.product_id, size: item.size }, "Product or variant not found");
          throw new Error(`Product variant ${item.name} (${item.size}) not found.`);
        }
        
        if (variant.stock < (item.quantity || 1)) {
          logger.warn({ orderId, product_id: item.product_id, size: item.size, stock: variant.stock }, "Insufficient stock");
          throw new Error(`Insufficient stock for ${item.name} (${item.size}). Available: ${variant.stock}`);
        }

        // Use price_paise if available, otherwise convert price to paise
        const itemPricePaise = product.price_paise || Math.round(product.price * 100);
        calculatedSubtotalPaise += itemPricePaise * (item.quantity || 1);
      }
    }

    const shippingCostPaise = Math.round(shipping_cost * 100);
    const calculatedTotalPaise = calculatedSubtotalPaise + shippingCostPaise;
    const frontendTotalPaise = Math.round(orderData.total * 100);

    // Security Check: Price Mismatch
    // We allow a 1% variance for weird rounding issues, but anything else is suspicious
    if (Math.abs(calculatedTotalPaise - frontendTotalPaise) > (calculatedTotalPaise * 0.01)) {
      logger.error({ 
        orderId, 
        calculated: calculatedTotalPaise, 
        frontend: frontendTotalPaise 
      }, "Price mismatch detected! Potential tampering.");
      throw new Error("Order total mismatch. Please refresh your cart and try again.");
    }

    // 2. Insert the order
    db.prepare(`
      INSERT INTO orders (
        id, razorpay_payment_id, razorpay_order_id, utr, payment_method,
        customer_name, customer_phone, customer_email,
        address_line1, address_line2, city, state, pin_code,
        items_json, subtotal_paise, shipping_method, shipping_cost_paise,
        total_paise, total_amount, status
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
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
      calculatedSubtotalPaise,
      shipping_method,
      shipping_cost, // Keep legacy if needed, but we should use paise
      calculatedTotalPaise,
      calculatedTotalPaise / 100,
      status
    );

    // 3. Status History
    db.prepare(`INSERT INTO order_status_history (order_id, status, comment) VALUES (?, ?, ?)`).run(
      orderId, status, `Order created via ${paymentMethod}`
    );

    // 4. Items & Stock
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.product_id && item.size) {
          // Resolve price for item
          const product = db.prepare(`SELECT price_paise, price FROM products WHERE id = ?`).get(item.product_id);
          const pricePaise = product?.price_paise || Math.round((product?.price || 0) * 100);
          
          const qty = parseInt(item.quantity || 1, 10);

          // Insert into order_items table
          db.prepare(`
            INSERT INTO order_items (order_id, product_id, variant_id, name, quantity, price_paise, size, image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(orderId, item.product_id, item.variant_id, item.name, qty, pricePaise, item.size, item.image);

          // Decrement stock in product_variants
          db.prepare(`
            UPDATE product_variants 
            SET stock = stock - ? 
            WHERE product_id = ? AND size = ?
          `).run(qty, item.product_id, item.size);

          // Log inventory movement
          const variant = db.prepare(`SELECT id FROM product_variants WHERE product_id = ? AND size = ?`).get(item.product_id, item.size);
          if (variant) {
            db.prepare(`INSERT INTO inventory_logs (variant_id, change, reason, order_id) VALUES (?, ?, ?, ?)`).run(
              variant.id, -qty, 'sale', orderId
            );
          }
        }
      }
    }

    logger.info({ orderId, total: calculatedTotalPaise / 100, method: paymentMethod }, "Order saved successfully");
    
    // Async notification
    notifyOrderConfirmed(customer_phone, customer_name, orderId, calculatedTotalPaise / 100);

    return orderId;
  });
}

// ── POST /api/payments/create-order ────────────
router.post("/create-order", async (req, res) => {
  try {
    const { amount_in_rupees } = req.body;

    if (!amount_in_rupees || amount_in_rupees <= 0) {
      return res.status(400).json({ error: "amount_in_rupees must be a positive number" });
    }

    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(amount_in_rupees * 100),
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
    logger.error(err, 'POST /api/payments/create-order error');
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ── POST /api/payments/verify ───────────────────
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

    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, error: "Payment verification failed" });
    }

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
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.error("RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook");
        return res.status(500).json({ error: "Webhook not configured" });
      }

      const signature = req.headers["x-razorpay-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing signature header" });
      }

      const expectedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(req.body)
        .digest("hex");

      // Buffer.from MUST use 'hex' encoding — without it, Buffer.from(hexStr) creates
      // a UTF-8 buffer (wrong length), causing timingSafeEqual to throw or always fail.
      const sigBuf = Buffer.from(signature,   "hex");
      const expBuf = Buffer.from(expectedSig, "hex");

      // Length check MUST precede timingSafeEqual — the function throws
      // ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH if buffers have different lengths.
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(400).json({ error: "Invalid webhook signature" });
      }

      const event = JSON.parse(req.body.toString());

      if (event.event === "payment.captured") {
        const payment = event.payload?.payment?.entity;
        if (payment) {
          const existing = db
            .prepare("SELECT id FROM orders WHERE razorpay_payment_id = ?")
            .get(payment.id);

          if (existing) {
            db.prepare(
              "UPDATE orders SET status = 'paid' WHERE id = ? AND status = 'pending_verification'"
            ).run(existing.id);
          } else {
            logger.error({ paymentId: payment.id }, "Orphaned payment — not in orders DB");
          }
        }
      }

      res.json({ status: "ok" });
    } catch (err) {
      logger.error({ err }, "Webhook error");
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
