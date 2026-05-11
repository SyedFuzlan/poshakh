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
// ── POST /api/orders ─────────────────────────────
// Public endpoint to place a COD order (Guest or Logged-in)
router.post("/", async (req, res) => {
  try {
    const { order_data } = req.body;

    const validationError = validateOrderData(order_data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const orderId = generateOrderId();
    await saveOrder({
      orderId,
      checkoutId: order_data.id,
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
// ── GET /api/orders/stats ────────────────────────
// Must be before /:id to avoid route conflict
router.get("/stats", requireOwner, async (req, res) => {
  try {
    // IST offset is +5:30.
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

    const todayOrders = await db
      .prepare(
        `SELECT COUNT(*) as count, SUM(total_paise) as revenue
         FROM orders
         WHERE created_at >= $1 AND status != 'cancelled'`
      )
      .get(utcStart);

    const totalOrders = await db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'")
      .get();
      
    const lowStockCount = await db
      .prepare("SELECT COUNT(*) as count FROM product_variants WHERE stock > 0 AND stock <= 3")
      .get();

    const pendingProcessing = await db
      .prepare(
        "SELECT COUNT(*) as count FROM orders WHERE status = 'paid' OR (status = 'pending' AND payment_method = 'COD')"
      )
      .get();

    res.json({
      today_orders: parseInt(todayOrders.count || 0, 10),
      today_revenue_paise: parseInt(todayOrders.revenue || 0, 10),
      today_revenue_formatted: formatINR(todayOrders.revenue || 0),
      total_orders: parseInt(totalOrders.count || 0, 10),
      pending_shipment: parseInt(pendingProcessing.count || 0, 10),
      pending_processing: parseInt(pendingProcessing.count || 0, 10),
      low_stock_count: parseInt(lowStockCount.count || 0, 10)
    });
  } catch (err) {
    console.error("GET /api/orders/stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Prefix cells starting with formula characters to prevent CSV injection in Excel/Sheets
function csvCell(val) {
  const s = String(val == null ? '' : val).replace(/"/g, '""');
  return /^[=+\-@\t\r]/.test(s) ? `"'${s}"` : `"${s}"`;
}

// ── GET /api/orders/export/csv ──────────────────
router.get("/export/csv", requireOwner, async (req, res) => {
  try {
    const rows = await db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();

    let csv = "Order ID,Date (IST),Customer,Phone,Status,Method,Total (INR),Items\n";

    rows.forEach(row => {
      const date = (toIST(row.created_at) || "").replace(/,/g, "");
      const items = JSON.parse(row.items_json).map(i => `${i.name}(${i.size})x${i.quantity}`).join("; ");
      const line = [
        csvCell(row.id),
        csvCell(date),
        csvCell(row.customer_name),
        csvCell(row.customer_phone),
        csvCell(row.status),
        csvCell(row.payment_method),
        csvCell(Math.round(row.total_paise / 100)),
        csvCell(items),
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
router.get("/", requireOwner, async (req, res) => {
  try {
    const { status, q, limit = 100, offset = 0 } = req.query;
    let rows;

    let sql = "SELECT * FROM orders";
    let params = [];
    let where = [];

    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    
    if (q) {
      const term = `%${q}%`;
      params.push(term, term, term);
      where.push(`(customer_name LIKE $${params.length - 2} OR customer_phone LIKE $${params.length - 1} OR id LIKE $${params.length})`);
    }

    if (where.length > 0) {
      sql += " WHERE " + where.join(" AND ");
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));

    rows = await db.prepare(sql).all(...params);

    res.json({ orders: rows.map(formatOrder) });
  } catch (err) {
    console.error("GET /api/orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

const VALID_TRANSITIONS = {
  'pending': ['paid', 'confirmed', 'cancelled', 'failed', 'processing'],
  'pending_verification': ['paid', 'cancelled', 'failed'],
  'paid': ['processing', 'cancelled'],
  'confirmed': ['processing', 'cancelled'],
  'processing': ['shipped', 'cancelled'],
  'shipped': ['delivered', 'cancelled'],
  'delivered': ['return_requested', 'cancelled'],
  'return_requested': ['returned', 'processing', 'cancelled'],
  'returned': [],
  'cancelled': [],
  'failed': ['pending']
};

// ── PATCH /api/orders/:id ───────────────────────
// General purpose update (Admin only)
router.patch("/:id", requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, courier_name, tracking_number } = req.body;
    
    const row = await db.prepare("SELECT * FROM orders WHERE id = $1").get(id);
    if (!row) return res.status(404).json({ error: "Order not found" });

    // Validate transition
    if (status && status !== row.status) {
      const allowed = VALID_TRANSITIONS[row.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ 
          error: `Invalid status transition from '${row.status}' to '${status}'`,
          allowed_transitions: allowed
        });
      }
    }

    const updates = [];
    const params = [];

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
      
      // Auto-set shipped_at if status becomes 'shipped'
      if (status === 'shipped' && !row.shipped_at) {
        updates.push("shipped_at = NOW()");
      }
    }
    
    if (courier_name !== undefined) {
      params.push(courier_name);
      updates.push(`courier_name = $${params.length}`);
    }
    
    if (tracking_number !== undefined) {
      params.push(tracking_number);
      updates.push(`tracking_number = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(id);
    const updateSql = `UPDATE orders SET ${updates.join(", ")} WHERE id = $${params.length}`;
    
    // Use transaction for status changes that involve inventory (Cancellations)
    await db.transaction(async (client) => {
      await client.query(updateSql, params);

      // Record status history
      if (status) {
        await client.query(
          `INSERT INTO order_status_history (order_id, status, admin_id) VALUES ($1, $2, $3)`,
          [id, status, req.owner?.id || req.owner?.email]
        );
      }

      // 3. Restock if cancelled/failed/returned
      if (status === 'cancelled' || status === 'failed' || status === 'returned') {
        const items = await client.query("SELECT product_id, size, quantity FROM order_items WHERE order_id = $1", [id]);
        for (const item of items.rows) {
          await client.query("UPDATE product_variants SET stock = stock + $1 WHERE product_id = $2 AND size = $3", [item.quantity, item.product_id, item.size]);
          
          const vRes = await client.query("SELECT id FROM product_variants WHERE product_id = $1 AND size = $2", [item.product_id, item.size]);
          if (vRes.rows[0]) {
            await client.query("INSERT INTO inventory_logs (variant_id, change, reason, order_id) VALUES ($1, $2, $3, $4)", [
              vRes.rows[0].id, item.quantity, status === 'returned' ? 'restock_return' : 'restock_cancel', id
            ]);
          }
        }
      }

      // 4. Trigger Refund if 'returned' and was Online payment
      if (status === 'returned' && (row.payment_method === 'razorpay' || row.payment_method === 'card')) {
        if (row.razorpay_payment_id) {
          try {
            const { getRazorpay } = require("./payments");
            const rzp = getRazorpay();
            await rzp.payments.refund(row.razorpay_payment_id, {
              amount: row.total_paise, // Full refund
              notes: { reason: "Customer return processed by admin" }
            });
            logger.info({ orderId: id, paymentId: row.razorpay_payment_id }, "Razorpay refund triggered successfully");
          } catch (refundErr) {
            logger.error({ refundErr, orderId: id }, "Failed to trigger Razorpay refund");
            // We don't throw here to avoid rolling back the status update, 
            // but we should probably log it prominently or return a warning.
          }
        }
      }
    });

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

    const updated = await db.prepare("SELECT * FROM orders WHERE id = $1").get(id);
    res.json({ order: formatOrder(updated) });
  } catch (err) {
    console.error("PATCH /api/orders error:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// ── POST /api/orders/:id/return ─────────────────
// Customer requests a return
const requireCustomer = require("../middleware/requireCustomer");
router.post("/:id/return", requireCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const row = await db.prepare("SELECT * FROM orders WHERE id = $1 AND (customer_id = $2 OR customer_phone = $3)").get(id, req.customer.id, req.customer.phone);
    if (!row) return res.status(404).json({ error: "Order not found" });

    if (row.status !== 'delivered') {
      return res.status(400).json({ error: "Only delivered orders can be returned" });
    }

    await db.transaction(async (client) => {
      await client.query("UPDATE orders SET status = 'return_requested' WHERE id = $1", [id]);
      await client.query(
        "INSERT INTO order_status_history (order_id, status, comment) VALUES ($1, $2, $3)",
        [id, 'return_requested', `Return requested by customer. Reason: ${reason || 'Not provided'}`]
      );
    });

    res.json({ success: true, status: 'return_requested' });
  } catch (err) {
    logger.error(err, "POST /api/orders/:id/return error");
    res.status(500).json({ error: "Failed to request return" });
  }
});

// ── GET /api/orders/:id/invoice (owner only) ────
router.get("/:id/invoice", requireOwner, async (req, res) => {
  try {
    const row = await db.prepare("SELECT * FROM orders WHERE id = $1").get(req.params.id);
    if (!row) return res.status(404).send("Order not found");
    
    const order = formatOrder(row);
    const html = generateInvoiceHTML(order);
    res.send(html);
  } catch (err) {
    res.status(500).send("Failed to generate invoice");
  }
});

// ── GET /api/orders/:id/history (owner only) ────
router.get("/:id/history", requireOwner, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT * FROM order_status_history 
      WHERE order_id = $1 
      ORDER BY created_at DESC
    `).all(req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch order history" });
  }
});

// ── GET /api/orders/reports (owner only) ────────
router.get("/reports", requireOwner, async (req, res) => {
  try {
    const dailyRevenue = await db.prepare(`
      SELECT DATE(created_at) as date, SUM(total_paise) as revenue 
      FROM orders 
      WHERE status != 'cancelled'
      GROUP BY DATE(created_at) 
      ORDER BY date ASC 
      LIMIT 30
    `).all();

    const categorySales = await db.prepare(`
      SELECT c.name as category, SUM(oi.quantity) as count, SUM(oi.price_paise * oi.quantity) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
      GROUP BY c.id, c.name
    `).all();

    const topProducts = await db.prepare(`
      SELECT name, SUM(quantity) as sold
      FROM order_items
      GROUP BY name
      ORDER BY sold DESC
      LIMIT 10
    `).all();

    res.json({
      dailyRevenue,
      categorySales,
      topProducts
    });
  } catch (err) {
    console.error("GET /api/orders/reports error:", err);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

module.exports = router;
