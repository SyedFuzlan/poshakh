const express = require('express');
const db = require('../db').db;
const { sendSMS } = require('../utils/sms');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Save checkout intent (Abandoned Cart Tracking)
 */
router.post('/', (req, res) => {
  try {
    const { id, customer_name, customer_phone, customer_email, items_json, total_paise, promo_code } = req.body;

    if (!id || !customer_phone) {
      return res.status(400).json({ error: 'Checkout ID and phone are required' });
    }

    db.prepare(`
      INSERT INTO checkouts (id, customer_name, customer_phone, customer_email, items_json, total_paise, promo_code, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', (strftime('%Y-%m-%dT%H:%M:%SZ','now')))
      ON CONFLICT(id) DO UPDATE SET
        customer_name = excluded.customer_name,
        customer_phone = excluded.customer_phone,
        customer_email = excluded.customer_email,
        items_json = excluded.items_json,
        total_paise = excluded.total_paise,
        promo_code = excluded.promo_code,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    `).run(id, customer_name, customer_phone, customer_email, items_json, total_paise, promo_code ? promo_code.toUpperCase() : null);

    if (promo_code) {
      db.prepare(
        'UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ? AND is_active = 1'
      ).run(promo_code.toUpperCase());
    }

    res.status(201).json({ success: true });
  } catch (err) {
    logger.error(err, 'POST /api/checkouts error');
    res.status(500).json({ error: 'Failed to save checkout' });
  }
});

/**
 * Background Task: Recovery Service
 * This is called internally or by a cron endpoint
 */
async function runRecoveryTask() {
  try {
    // Find checkouts updated more than 1 hour ago, still pending, and not notified in the last 24h
    const pendingCheckouts = db.prepare(`
      SELECT * FROM checkouts 
      WHERE status = 'pending' 
      AND updated_at < datetime('now', '-1 hour')
      AND (last_notified_at IS NULL OR last_notified_at < datetime('now', '-24 hour'))
      LIMIT 10
    `).all();

    for (const checkout of pendingCheckouts) {
      const items = JSON.parse(checkout.items_json || '[]');
      if (items.length === 0) continue;

      const firstName = checkout.customer_name?.split(' ')[0] || 'there';
      const msg = `Hi ${firstName}, you left something beautiful in your cart at MadeByZohra! Complete your order now: https://madebyzohra.in/checkout?id=${checkout.id}. Team Zohra`;

      await sendSMS(checkout.customer_phone, msg);

      // Update last_notified_at
      db.prepare(`UPDATE checkouts SET last_notified_at = (strftime('%Y-%m-%dT%H:%M:%SZ','now')) WHERE id = ?`)
        .run(checkout.id);
      
      logger.info({ checkoutId: checkout.id, phone: checkout.customer_phone }, 'Abandoned cart recovery SMS sent');
    }
  } catch (err) {
    logger.error(err, 'Abandoned Cart Recovery Task Error');
  }
}

module.exports = { router, runRecoveryTask };
