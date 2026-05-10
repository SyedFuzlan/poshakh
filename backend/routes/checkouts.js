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

    await db.prepare(`
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
    `).run(id, customer_name, customer_phone, customer_email, items_json, total_paise, promo_code ? promo_code.toUpperCase() : null);

    if (promo_code) {
      await db.prepare(
        'UPDATE promo_codes SET times_used = times_used + 1 WHERE code = $1 AND is_active = 1'
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

      // Sanitise before interpolation: strip non-alphabetic chars to prevent
      // SMS-injection payloads (newlines, fake "From:" fields, phishing URLs).
      const rawName = (checkout.customer_name || '').replace(/[^a-zA-Z\s'-]/g, '').trim();
      const firstName = (rawName.split(' ')[0] || 'there').slice(0, 30);
      const msg = `Hi ${firstName}, you left something beautiful in your cart at MadeByZohra! Complete your order now: https://madebyzohra.in/checkout?id=${checkout.id}. Team Zohra`;

      await sendSMS(checkout.customer_phone, msg);

      // Update last_notified_at
      await db.prepare(`UPDATE checkouts SET last_notified_at = NOW() WHERE id = $1`)
        .run(checkout.id);
      
      logger.info({ checkoutId: checkout.id, phone: checkout.customer_phone }, 'Abandoned cart recovery SMS sent');
    }

    // Clean up expired auth tokens to prevent table bloat
    await db.prepare("DELETE FROM refresh_tokens WHERE expires_at < NOW()").run();
    await db.prepare("DELETE FROM email_verification_tokens WHERE expires_at < NOW()").run();
    await db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < NOW()").run();
  } catch (err) {
    logger.error(err, 'Abandoned Cart Recovery Task Error');
  }
}

module.exports = { router, runRecoveryTask };
