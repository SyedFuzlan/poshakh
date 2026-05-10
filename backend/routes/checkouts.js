const express = require('express');
const db = require('../db').db;
const { sendSMS } = require('../utils/sms');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Save checkout intent (Abandoned Cart Tracking)
 */
router.post('/', async (req, res) => {
  try {
    const { id, customer_name, customer_phone, customer_email, items_json, total_paise, promo_code } = req.body;

    if (!id || !customer_phone) {
      return res.status(400).json({ error: 'Checkout ID and phone are required' });
    }

    const items = JSON.parse(items_json || '[]');
    if (!items.length) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    await db.transaction(async (client) => {
      // 1. Save/Update checkout intent
      await client.query(`
        INSERT INTO checkouts (id, customer_name, customer_phone, customer_email, items_json, total_paise, promo_code, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
        ON CONFLICT(id) DO UPDATE SET
          customer_name = EXCLUDED.customer_name,
          customer_phone = EXCLUDED.customer_phone,
          customer_email = EXCLUDED.customer_email,
          items_json = EXCLUDED.items_json,
          total_paise = EXCLUDED.total_paise,
          promo_code = EXCLUDED.promo_code,
          updated_at = NOW()
      `, [id, customer_name, customer_phone, customer_email, items_json, total_paise, promo_code ? promo_code.toUpperCase() : null]);

      // 2. Clear any existing reservations for this checkout (if it's a retry/update)
      const existingRes = await client.query('SELECT variant_id, quantity FROM inventory_reservations WHERE checkout_id = $1', [id]);
      for (const r of existingRes.rows) {
        await client.query('UPDATE product_variants SET reserved_stock = reserved_stock - $1 WHERE id = $2', [r.quantity, r.variant_id]);
      }
      await client.query('DELETE FROM inventory_reservations WHERE checkout_id = $1', [id]);

      // 3. Create new reservations
      for (const item of items) {
        if (!item.product_id || !item.size) continue;
        
        // Find variant and check available stock
        // Available = (stock - reserved_stock)
        const vRes = await client.query(`
          SELECT id, stock, reserved_stock 
          FROM product_variants 
          WHERE product_id = $1 AND size = $2
        `, [item.product_id, item.size]);
        
        const variant = vRes.rows[0];
        if (!variant) throw new Error(`Product ${item.name} (${item.size}) is no longer available`);
        
        const qty = parseInt(item.quantity || 1, 10);
        const available = variant.stock - variant.reserved_stock;
        
        if (available < qty) {
          throw new Error(`Insufficient stock for ${item.name} (${item.size})`);
        }

        // Reserve
        await client.query('UPDATE product_variants SET reserved_stock = reserved_stock + $1 WHERE id = $2', [qty, variant.id]);
        await client.query(`
          INSERT INTO inventory_reservations (checkout_id, variant_id, quantity, expires_at)
          VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')
        `, [id, variant.id, qty]);
      }
    });

    res.status(201).json({ success: true });
  } catch (err) {
    if (err.message.includes('Insufficient stock') || err.message.includes('no longer available')) {
      return res.status(409).json({ error: err.message });
    }
    logger.error(err, 'POST /api/checkouts error');
    res.status(500).json({ error: 'Failed to save checkout' });
  }
});

/**
 * Internal helper to release expired reservations
 */
async function releaseExpiredReservations() {
  await db.transaction(async (client) => {
    // 1. Find expired reservations
    const expired = await client.query(`
      SELECT * FROM inventory_reservations 
      WHERE expires_at < NOW()
    `);

    for (const r of expired.rows) {
      // 2. Decrement reserved_stock
      await client.query('UPDATE product_variants SET reserved_stock = reserved_stock - $1 WHERE id = $2', [r.quantity, r.variant_id]);
      
      // 3. Log it (optional but good for debugging)
      logger.info({ checkoutId: r.checkout_id, variantId: r.variant_id }, 'Released expired inventory reservation');
    }

    // 4. Delete rows
    if (expired.rows.length > 0) {
      await client.query('DELETE FROM inventory_reservations WHERE expires_at < NOW()');
    }
  });
}

/**
 * Background Task: Recovery Service
 * This is called internally or by a cron endpoint
 */
async function runRecoveryTask() {
  // 1. Release expired inventory reservations
  try {
    await releaseExpiredReservations();
  } catch (err) {
    console.error('Inventory Reservation Release Error:', err);
    logger.error(err, 'Inventory Reservation Release Error');
  }

  // 2. Abandoned cart recovery
  try {
    const pendingCheckouts = await db.prepare(`
      SELECT * FROM checkouts
      WHERE status = 'pending'
      AND updated_at < NOW() - INTERVAL '1 hour'
      AND (last_notified_at IS NULL OR last_notified_at < NOW() - INTERVAL '24 hours')
      LIMIT 10
    `).all();

    for (const checkout of pendingCheckouts) {
      const items = JSON.parse(checkout.items_json || '[]');
      if (items.length === 0) continue;

      const rawName = (checkout.customer_name || '').replace(/[^a-zA-Z\s'-]/g, '').trim();
      const firstName = (rawName.split(' ')[0] || 'there').slice(0, 30);
      const msg = `Hi ${firstName}, you left something beautiful in your cart at MadeByZohra! Complete your order now: https://madebyzohra.in/checkout?id=${checkout.id}. Team Zohra`;

      await sendSMS(checkout.customer_phone, msg);

      await db.prepare(`UPDATE checkouts SET last_notified_at = NOW() WHERE id = $1`)
        .run(checkout.id);

      logger.info({ checkoutId: checkout.id, phone: checkout.customer_phone }, 'Abandoned cart recovery SMS sent');
    }
  } catch (err) {
    console.error('Abandoned Cart Recovery Task Error:', err);
    logger.error(err, 'Abandoned Cart Recovery Task Error');
  }

  // 3. Token cleanup
  try {
    await db.prepare("DELETE FROM refresh_tokens WHERE expires_at < NOW()").run();
    await db.prepare("DELETE FROM email_verification_tokens WHERE expires_at < NOW()").run();
    await db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < NOW()").run();
  } catch (err) {
    console.error('Token cleanup task error:', err);
    logger.error(err, 'Token cleanup task error');
  }
}

module.exports = { router, runRecoveryTask };
