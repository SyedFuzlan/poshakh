// ──────────────────────────────────────────────
//  routes/orders.js
//  GET   /api/orders          — all orders, newest first (owner only)
//  GET   /api/orders/stats    — today's stats (owner only)
//  PATCH /api/orders/:id/ship — mark as shipped (owner only)
// ──────────────────────────────────────────────
const express = require("express");
const db = require("../db").db;
const requireOwner = require("../middleware/requireOwner");

const router = express.Router();
const { generateOrderId, validateOrderData, saveOrder } = require("./payments");

// ── POST /api/orders ─────────────────────────────
// Public endpoint to place a COD order (Guest or Logged-in)
router.post("/", (req, res) => {
  try {
    const { order_data } = req.body;

    const validationError = validateOrderData(order_data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const orderId = generateOrderId();
    saveOrder({
      orderId,
      paymentMethod: "COD",
      razorpayPaymentId: null,
      razorpayOrderId: null,
      utr: null,
      orderData: order_data,
    });

    console.log(`🚚 COD order saved via /api/orders: ${orderId}`);
    res.json({ success: true, order_id: orderId });
  } catch (err) {
    console.error("POST /api/orders error:", err);
    res.status(500).json({ success: false, error: "Failed to place COD order" });
  }
});

// ── IST helpers ─────────────────────────────────
// Convert a UTC ISO string to IST display string
function toIST(utcIso) {
  if (!utcIso) return null;
  const date = new Date(utcIso);
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Format paise → ₹ Indian system
function formatINR(paise) {
  const rupees = Math.round(paise / 100);
  return `₹${rupees.toLocaleString("en-IN")}`;
}

// Format a raw DB row for API response
function formatOrder(row) {
  let items = [];
  try { items = JSON.parse(row.items_json); } catch { /* malformed */ }

  return {
    id: row.id,
    payment_method: row.payment_method,
    razorpay_payment_id: row.razorpay_payment_id,
    utr: row.utr,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    address: {
      line1: row.address_line1,
      line2: row.address_line2 || "",
      city: row.city,
      state: row.state,
      pin_code: row.pin_code,
      full: [
        row.address_line1,
        row.address_line2,
        row.city,
        row.state,
        row.pin_code,
        "India",
      ]
        .filter(Boolean)
        .join(", "),
    },
    items,
    subtotal_paise: row.subtotal_paise,
    shipping_cost_paise: row.shipping_cost_paise,
    total_paise: row.total_paise,
    subtotal_formatted: formatINR(row.subtotal_paise),
    shipping_cost_formatted:
      row.shipping_cost_paise === 0 ? "FREE" : formatINR(row.shipping_cost_paise),
    total_formatted: formatINR(row.total_paise),
    shipping_method: row.shipping_method,
    status: row.status,
    created_at_utc: row.created_at,
    created_at_ist: toIST(row.created_at),
    shipped_at_utc: row.shipped_at,
    shipped_at_ist: toIST(row.shipped_at),
  };
}

// ── GET /api/orders/stats ────────────────────────
// Must be before /:id to avoid route conflict
router.get("/stats", requireOwner, (req, res) => {
  try {
    // IST offset is +5:30. SQLite stores UTC; we adjust the date boundary.
    // "today in IST" starts at previous day 18:30 UTC (IST midnight = UTC 18:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5h30m in ms
    const istNow = new Date(now.getTime() + istOffset);
    const istMidnight = new Date(
      istNow.getFullYear(),
      istNow.getMonth(),
      istNow.getDate(),
      0,
      0,
      0
    );
    const utcStart = new Date(istMidnight.getTime() - istOffset).toISOString();

    const todayOrders = db
      .prepare(
        `SELECT COUNT(*) as count, SUM(total_paise) as revenue
         FROM orders
         WHERE created_at >= ? AND status != 'cancelled'`
      )
      .get(utcStart);

    const totalOrders = db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'")
      .get();

    const pendingShipment = db
      .prepare(
        "SELECT COUNT(*) as count FROM orders WHERE status = 'paid'"
      )
      .get();

    res.json({
      today_orders: todayOrders.count || 0,
      today_revenue_paise: todayOrders.revenue || 0,
      today_revenue_formatted: formatINR(todayOrders.revenue || 0),
      total_orders: totalOrders.count || 0,
      pending_shipment: pendingShipment.count || 0,
    });
  } catch (err) {
    console.error("GET /api/orders/stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── GET /api/orders ──────────────────────────────
router.get("/", requireOwner, (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;
    let rows;

    if (status) {
      rows = db
        .prepare(
          "SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .all(status, Number(limit), Number(offset));
    } else {
      rows = db
        .prepare(
          "SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .all(Number(limit), Number(offset));
    }

    res.json({ orders: rows.map(formatOrder) });
  } catch (err) {
    console.error("GET /api/orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ── PATCH /api/orders/:id/ship ───────────────────
router.patch("/:id/ship", requireOwner, (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Order not found" });

    if (row.status === "shipped") {
      return res.status(400).json({ error: "Order is already marked as shipped" });
    }

    db.prepare(
      `UPDATE orders
       SET status = 'shipped', shipped_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`
    ).run(id);

    const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    res.json({ order: formatOrder(updated) });
  } catch (err) {
    console.error("PATCH /api/orders/:id/ship error:", err);
    res.status(500).json({ error: "Failed to mark order as shipped" });
  }
});

module.exports = router;
