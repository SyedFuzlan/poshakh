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
const { notifyShipped, notifyDelivered } = require("../utils/sms");
const { generateInvoiceHTML } = require("../utils/invoice");

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
    courier_name: row.courier_name || "",
    tracking_number: row.tracking_number || "",
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
      
    const lowStockCount = db
      .prepare("SELECT COUNT(*) as count FROM product_variants WHERE stock > 0 AND stock <= 3")
      .get();

    const pendingProcessing = db
      .prepare(
        "SELECT COUNT(*) as count FROM orders WHERE status = 'paid' OR (status = 'pending' AND payment_method = 'COD')"
      )
      .get();

    const pendingShipment = db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'shipped'") // Should this be 'shipped'? Usually 'pending_shipment' means ready but not yet shipped.
      // Actually, let's follow the existing logic:
      // status = 'paid' or 'COD pending' -> pending processing
      // status = 'shipped' -> out for delivery? 
      // Let's just define it to avoid crashes.
      .get();

    res.json({
      today_orders: todayOrders.count || 0,
      today_revenue_paise: todayOrders.revenue || 0,
      today_revenue_formatted: formatINR(todayOrders.revenue || 0),
      total_orders: totalOrders.count || 0,
      pending_shipment: pendingProcessing.count || 0, // Using processing count as 'pending shipment' for now
      pending_processing: pendingProcessing.count || 0,
      low_stock_count: lowStockCount.count || 0
    });
  } catch (err) {
    console.error("GET /api/orders/stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── GET /api/orders/export/csv ──────────────────
router.get("/export/csv", requireOwner, (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
    
    let csv = "Order ID,Date (IST),Customer,Phone,Status,Method,Total (INR),Items\n";
    
    rows.forEach(row => {
      const date = toIST(row.created_at).replace(/,/g, "");
      const items = JSON.parse(row.items_json).map(i => `${i.name}(${i.size})x${i.quantity}`).join("; ");
      const line = [
        row.id,
        date,
        row.customer_name,
        row.customer_phone,
        row.status,
        row.payment_method,
        Math.round(row.total_paise / 100),
        `"${items}"`
      ].join(",");
      csv += line + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=orders_${new Date().toISOString().slice(0,10)}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: "Failed to export CSV" });
  }
});

// ── GET /api/orders ──────────────────────────────
router.get("/", requireOwner, (req, res) => {
  try {
    const { status, q, limit = 100, offset = 0 } = req.query;
    let rows;

    let sql = "SELECT * FROM orders";
    let params = [];
    let where = [];

    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    
    if (q) {
      where.push("(customer_name LIKE ? OR customer_phone LIKE ? OR id LIKE ?)");
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    if (where.length > 0) {
      sql += " WHERE " + where.join(" AND ");
    }

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    rows = db.prepare(sql).all(...params);

    res.json({ orders: rows.map(formatOrder) });
  } catch (err) {
    console.error("GET /api/orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ── PATCH /api/orders/:id ───────────────────────
// General purpose update (Admin only)
router.patch("/:id", requireOwner, (req, res) => {
  try {
    const { id } = req.params;
    const { status, courier_name, tracking_number } = req.body;
    
    const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Order not found" });

    const updates = [];
    const params = [];

    if (status) {
      updates.push("status = ?");
      params.push(status);
      
      // Auto-set shipped_at if status becomes 'shipped'
      if (status === 'shipped' && !row.shipped_at) {
        updates.push("shipped_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
      }
    }
    
    if (courier_name !== undefined) {
      updates.push("courier_name = ?");
      params.push(courier_name);
    }
    
    if (tracking_number !== undefined) {
      updates.push("tracking_number = ?");
      params.push(tracking_number);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(id);
    
    // Use transaction for status changes that involve inventory (Cancellations)
    db.transaction(() => {
      db.prepare(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?`).run(...params);

      // Record status history
      if (status) {
        db.prepare(`INSERT INTO order_status_history (order_id, status, admin_id) VALUES (?, ?, ?)`).run(
          id, status, req.owner?.id || req.owner?.email
        );
      }

      // Handle Restocking on Cancellation
      if (status === 'cancelled' && row.status !== 'cancelled') {
        const items = JSON.parse(row.items_json || '[]');
        items.forEach(item => {
          if (item.product_id && item.size) {
            const qty = parseInt(item.quantity || 1, 10);
            db.prepare(`UPDATE product_variants SET stock = stock + ? WHERE product_id = ? AND size = ?`)
              .run(qty, item.product_id, item.size);

            // Log inventory restock
            const variant = db.prepare(`SELECT id FROM product_variants WHERE product_id = ? AND size = ?`).get(item.product_id, item.size);
            if (variant) {
              db.prepare(`INSERT INTO inventory_logs (variant_id, change, reason, order_id, admin_id) VALUES (?, ?, ?, ?, ?)`).run(
                variant.id, qty, 'cancellation_restock', id, req.owner?.id || req.owner?.email
              );
            }
          }
        });
      }
    })();

    // Post-update actions (Notifications)
    if (status === 'shipped') {
      notifyShipped(row.customer_phone, row.customer_name, id, courier_name || row.courier_name, tracking_number || row.tracking_number);
    } else if (status === 'delivered') {
      notifyDelivered(row.customer_phone, row.customer_name, id);
    }

    db.logAudit({
      adminId: req.owner.email,
      action: 'ORDER_UPDATE',
      details: `Updated order ID: ${id} to status: ${status || row.status}`,
      oldValue: { status: row.status, courier: row.courier_name, tracking: row.tracking_number },
      newValue: req.body
    });

    const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    res.json({ order: formatOrder(updated) });
  } catch (err) {
    console.error("PATCH /api/orders error:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// ── GET /api/orders/:id/invoice (owner only) ────
router.get("/:id/invoice", requireOwner, (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).send("Order not found");
    
    const order = formatOrder(row);
    const html = generateInvoiceHTML(order);
    res.send(html);
  } catch (err) {
    res.status(500).send("Failed to generate invoice");
  }
});

// ── GET /api/orders/:id/history (owner only) ────
router.get("/:id/history", requireOwner, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM order_status_history 
      WHERE order_id = ? 
      ORDER BY created_at DESC
    `).all(req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch order history" });
  }
});

// ── GET /api/orders/reports (owner only) ────────
router.get("/reports", requireOwner, (req, res) => {
  try {
    const dailyRevenue = db.prepare(`
      SELECT date(created_at) as date, SUM(total_paise) as revenue 
      FROM orders 
      WHERE status != 'cancelled'
      GROUP BY date(created_at) 
      ORDER BY date ASC 
      LIMIT 30
    `).all();

    const categorySales = db.prepare(`
      SELECT c.name as category, SUM(oi.quantity) as count, SUM(oi.price_paise * oi.quantity) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
      GROUP BY c.id
    `).all();

    const topProducts = db.prepare(`
      SELECT name, SUM(quantity) as sold
      FROM order_items
      GROUP BY product_id
      ORDER BY sold DESC
      LIMIT 10
    `).all();

    res.json({
      dailyRevenue,
      categorySales,
      topProducts
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate report" });
  }
});

module.exports = router;
