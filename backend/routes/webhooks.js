const express = require('express');
const db = require('../db').db;
const { notifyDelivered } = require('../utils/sms');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/webhooks/delhivery
router.post('/delhivery', async (req, res) => {
  // Always respond 200 fast to Delhivery — they retry on non-200
  res.sendStatus(200);

  try {
    // Delhivery sends an array of shipment status updates
    // Body can be { packages: [...] } or array directly
    const packages = Array.isArray(req.body) ? req.body
      : (req.body.packages || req.body.data || []);

    for (const pkg of packages) {
      const awb = pkg.waybill || pkg.AWB || pkg.Waybill;
      const status = pkg.status || pkg.Status || '';

      if (!awb) continue;

      // Only act on Delivered status
      if (!status.toLowerCase().includes('delivered')) continue;

      const row = await db.prepare(
        'SELECT * FROM orders WHERE tracking_number = $1 OR delhivery_awb = $2'
      ).get(awb, awb);

      if (!row) {
        logger.warn({ awb }, 'Delhivery webhook: no order found for AWB');
        continue;
      }

      if (row.status === 'delivered') continue; // already delivered, skip

      await db.prepare(
        "UPDATE orders SET status = 'delivered' WHERE id = $1"
      ).run(row.id);

      // Fire-and-forget SMS
      notifyDelivered(row.customer_phone, row.customer_name, row.id);

      logger.info({ orderId: row.id, awb }, 'Order marked delivered via Delhivery webhook');
    }
  } catch (err) {
    logger.error({ err }, 'Delhivery webhook processing error');
  }
});

module.exports = router;
