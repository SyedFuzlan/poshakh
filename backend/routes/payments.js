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
const { sendOrderConfirmationEmail } = require("../utils/email");

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
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars
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
async function saveOrder({ orderId, checkoutId, paymentMethod, razorpayPaymentId, razorpayOrderId, utr, orderData }) {
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
  return db.transaction(async (client) => {
    let calculatedSubtotalPaise = 0;
    
    // 1. Verify stock and Recalculate Price for all items
    if (Array.isArray(items)) {
      for (const item of items) {
        if (!item.product_id || !item.size) continue;
        
        // Fetch product and variant details from DB
        const productRes = await client.query(`SELECT price, price_paise FROM products WHERE id = $1`, [item.product_id]);
        const product = productRes.rows[0];

        const variantRes = await client.query(`
          SELECT id, stock, reserved_stock FROM product_variants 
          WHERE product_id = $1 AND size = $2
        `, [item.product_id, item.size]);
        const variant = variantRes.rows[0];

        if (!product || !variant) {
          logger.warn({ orderId, product_id: item.product_id, size: item.size }, "Product or variant not found");
          throw new Error(`Product variant ${item.name} (${item.size}) not found.`);
        }
        
        const qty = item.quantity || 1;

        // Check if we have a reservation for this checkout
        const resCheck = await client.query(`
          SELECT quantity FROM inventory_reservations 
          WHERE checkout_id = $1 AND variant_id = $2
        `, [checkoutId, variant.id]);
        
        const reservedByMe = resCheck.rows[0]?.quantity || 0;
        const available = variant.stock - (variant.reserved_stock - reservedByMe);

        if (available < qty) {
          logger.warn({ orderId, product_id: item.product_id, size: item.size, stock: variant.stock, reserved: variant.reserved_stock, reservedByMe }, "Insufficient stock");
          throw new Error(`Insufficient stock for ${item.name} (${item.size}). Available: ${available}`);
        }

        // Use price_paise if available, otherwise convert price to paise
        const itemPricePaise = (product.price_paise != null) ? product.price_paise : Math.round(product.price * 100);
        calculatedSubtotalPaise += itemPricePaise * qty;
      }
    }

    const shippingCostPaise = Math.round(shipping_cost * 100);
    const calculatedTotalPaise = calculatedSubtotalPaise + shippingCostPaise;
    const frontendTotalPaise = Math.round(orderData.total * 100);

    // Security Check: Price Mismatch
    if (Math.abs(calculatedTotalPaise - frontendTotalPaise) > (calculatedTotalPaise * 0.01)) {
      logger.error({ 
        orderId, 
        calculated: calculatedTotalPaise, 
        frontend: frontendTotalPaise 
      }, "Price mismatch detected! Potential tampering.");
      throw new Error("Order total mismatch. Please refresh your cart and try again.");
    }

    // 2. Insert the order
    await client.query(`
      INSERT INTO orders (
        id, razorpay_payment_id, razorpay_order_id, utr, payment_method,
        customer_name, customer_phone, customer_email,
        address_line1, address_line2, city, state, pin_code,
        items_json, subtotal_paise, shipping_method, shipping_cost_paise,
        total_paise, total_amount, status
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20
      )
    `, [
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
      shipping_cost,
      calculatedTotalPaise,
      calculatedTotalPaise / 100,
      status
    ]);

    // 3. Status History
    await client.query(`INSERT INTO order_status_history (order_id, status, comment) VALUES ($1, $2, $3)`, [
      orderId, status, `Order created via ${paymentMethod}`
    ]);

    // 4. Items & Stock
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.product_id && item.size) {
          const productRes = await client.query(`SELECT price_paise, price FROM products WHERE id = $1`, [item.product_id]);
          const product = productRes.rows[0];
          const pricePaise = (product?.price_paise != null) ? product.price_paise : Math.round((product?.price || 0) * 100);
          
          const qty = parseInt(item.quantity || 1, 10);

          await client.query(`
            INSERT INTO order_items (order_id, product_id, variant_id, name, quantity, price_paise, size, image)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [orderId, item.product_id, item.variant_id, item.name, qty, pricePaise, item.size, item.image]);

          // CONSUME RESERVATION
          const resDelete = await client.query(`
            DELETE FROM inventory_reservations 
            WHERE checkout_id = $1 AND variant_id = (SELECT id FROM product_variants WHERE product_id = $2 AND size = $3)
            RETURNING quantity
          `, [checkoutId, item.product_id, item.size]);

          if (resDelete.rows.length > 0) {
            const reservedQty = resDelete.rows[0].quantity;
            // Decrement both stock and reserved_stock
            await client.query(`
              UPDATE product_variants 
              SET stock = stock - $1, reserved_stock = reserved_stock - $2
              WHERE product_id = $3 AND size = $4
            `, [qty, reservedQty, item.product_id, item.size]);
          } else {
            // No reservation, decrement just stock
            await client.query(`
              UPDATE product_variants 
              SET stock = stock - $1 
              WHERE product_id = $2 AND size = $3
            `, [qty, item.product_id, item.size]);
          }

          // Log inventory movement
          const variantRes = await client.query(`SELECT id FROM product_variants WHERE product_id = $1 AND size = $2`, [item.product_id, item.size]);
          const variant = variantRes.rows[0];
          if (variant) {
            await client.query(`INSERT INTO inventory_logs (variant_id, change, reason, order_id) VALUES ($1, $2, $3, $4)`, [
              variant.id, -qty, 'sale', orderId
            ]);
          }
        }
      }
    }

    logger.info({ orderId, total: calculatedTotalPaise / 100, method: paymentMethod }, "Order saved successfully");
    
    // Async notifications — fire and forget, never block the transaction
    notifyOrderConfirmed(customer_phone, customer_name, orderId, calculatedTotalPaise / 100);
    sendOrderConfirmationEmail(customer_email || null, {
      orderId,
      items,
      total: calculatedTotalPaise / 100,
      customerName: customer_name,
    }).catch(err => logger.error(err, 'Order confirmation email error'));

    return orderId;
  });
}

// ── POST /api/payments/create-order ────────────
router.post("/create-order", async (req, res) => {
  try {
    const { amount, amount_in_rupees, currency = "INR" } = req.body;
    
    // Support both paise (amount) and rupees (amount_in_rupees)
    let amountPaise = amount;
    if (!amountPaise && amount_in_rupees) {
      amountPaise = Math.round(amount_in_rupees * 100);
    }

    if (!amountPaise || amountPaise < 100) {
      return res.status(400).json({ error: "Minimum amount is 100 paise (₹1)" });
    }

    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency,
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
    res.status(500).json({ 
      error: 'Failed to create payment order', 
      details: err.message,
      hint: err.message.includes("RAZORPAY_KEY") ? "Check if Razorpay API keys are correctly set in environment variables." : undefined
    });
  }
});

// ── POST /api/payments/verify-payment ───────────
router.post("/verify-payment", async (req, res) => {
  // Alias for /verify to match user requirements
  return module.exports.handleVerify(req, res);
});

// ── POST /api/payments/verify ───────────────────
router.post("/verify", async (req, res) => {
  return module.exports.handleVerify(req, res);
});

// Move verification logic to a shared function
async function handleVerify(req, res) {
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
      logger.warn({ razorpay_order_id, razorpay_payment_id }, 'Payment signature mismatch — possible tampering attempt');
      return res.status(400).json({ success: false, error: "Payment verification failed" });
    }

    const existing = await db
      .prepare("SELECT id FROM orders WHERE razorpay_payment_id = $1")
      .get(razorpay_payment_id);

    if (existing) {
      return res.json({ success: true, order_id: existing.id, duplicate: true });
    }

    const orderId = generateOrderId();
    await saveOrder({
      orderId,
      checkoutId: order_data.id,
      paymentMethod: "razorpay",
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      utr: null,
      orderData: order_data,
    });

    logger.info({ orderId, paymentId: razorpay_payment_id }, 'Order saved via Razorpay');
    res.json({ success: true, order_id: orderId });
  } catch (err) {
    logger.error({ 
      err: err.message, 
      stack: err.stack,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id
    }, "Payment verification error");
    res.status(500).json({ 
      success: false, 
      error: "Failed to verify payment",
      details: err.message 
    });
  }
}

// ── POST /api/payments/upi-confirm ─────────────
router.post("/upi-confirm", async (req, res) => {
  try {
    const { utr, order_data } = req.body;

    if (!utr?.trim()) {
      return res.status(400).json({ error: "UTR / Transaction ID is required" });
    }

    const validationError = validateOrderData(order_data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const existing = await db.prepare("SELECT id FROM orders WHERE utr = $1").get(utr.trim());
    if (existing) {
      return res.json({ success: true, order_id: existing.id, duplicate: true });
    }

    const orderId = generateOrderId();
    await saveOrder({
      orderId,
      checkoutId: order_data.id,
      paymentMethod: "upi",
      razorpayPaymentId: null,
      razorpayOrderId: null,
      utr: utr.trim(),
      orderData: order_data,
    });

    logger.info({ orderId, utr: utr.trim() }, 'UPI order saved');
    res.json({ success: true, order_id: orderId });
  } catch (err) {
    // UNIQUE constraint error = concurrent duplicate UTR attempt
    if (err && String(err.message).includes("UNIQUE constraint failed: orders.utr")) {
      return res.status(409).json({ success: false, error: "Duplicate UTR — order already exists" });
    }
    logger.error(err, 'POST /api/payments/upi-confirm error');
    res.status(500).json({ success: false, error: "Failed to save UPI order" });
  }
});

// ── POST /api/payments/webhook ──────────────────
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
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
      const eventId = event.id;

      if (!eventId) {
        return res.status(400).json({ error: "Missing event ID" });
      }

      // Check for idempotency
      const existingEvent = await db.prepare("SELECT id FROM processed_webhooks WHERE event_id = $1").get(eventId);
      if (existingEvent) {
        logger.info({ eventId }, "Webhook already processed, skipping.");
        return res.json({ status: "ok", duplicate: true });
      }

      if (event.event === "payment.captured") {
        const payment = event.payload?.payment?.entity;
        if (payment) {
          const existing = await db
            .prepare("SELECT id FROM orders WHERE razorpay_payment_id = $1")
            .get(payment.id);

          if (existing) {
            await db.prepare(
              "UPDATE orders SET status = 'paid' WHERE id = $1 AND status = 'pending_verification'"
            ).run(existing.id);
          } else {
            logger.error({ paymentId: payment.id }, "Orphaned payment — not in orders DB");
          }
        }
      }

      // Mark as processed
      await db.prepare("INSERT INTO processed_webhooks (event_id, provider) VALUES ($1, $2)").run(eventId, 'razorpay');

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
  saveOrder,
  getRazorpay,
  handleVerify
};
