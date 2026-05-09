const express = require('express');
const router = express.Router();
const { db } = require('../db');
const requireOwner = require('../middleware/requireOwner');
const logger = require('../utils/logger');

// Get all settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM site_settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    logger.error(err, 'GET /api/site-settings error');
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Update a setting
router.post('/', requireOwner, (req, res) => {
  const { key, value } = req.body;
  
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Key and value are required' });
  }

  try {
    db.prepare(`
      INSERT INTO site_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);

    db.logAudit({
      adminId: req.owner.email,
      action: 'UPDATE_SETTING',
      details: `Updated setting ${key}`,
      newValue: value
    });

    res.json({ success: true });
  } catch (err) {
    logger.error(err, 'POST /api/site-settings error');
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
