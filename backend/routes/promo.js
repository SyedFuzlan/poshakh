const express = require('express');
const router = express.Router();
const { db } = require('../db');
const requireOwner = require('../middleware/requireOwner');

// ── Admin Routes ────────────────────────────────────────────────────────────

// List all promo codes
router.get('/', requireOwner, (req, res) => {
  try {
    const codes = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new promo code
router.post('/', requireOwner, (req, res) => {
  const { code, type, value, min_purchase_paise, expiry_date, usage_limit } = req.body;
  
  if (!code || !type || value === undefined) {
    return res.status(400).json({ error: 'Code, type and value are required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO promo_codes (code, type, value, min_purchase_paise, expiry_date, usage_limit)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code.toUpperCase(), type, value, min_purchase_paise || 0, expiry_date || null, usage_limit || 0);

    db.logAudit({
      adminId: req.owner.email,
      action: 'CREATE_PROMO_CODE',
      details: `Created code ${code}`,
      newValue: req.body
    });

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Promo code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete promo code
router.delete('/:id', requireOwner, (req, res) => {
  try {
    db.prepare('DELETE FROM promo_codes WHERE id = ?').run(req.params.id);
    db.logAudit({
      adminId: req.owner.email,
      action: 'DELETE_PROMO_CODE',
      details: `Deleted code ID ${req.params.id}`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public Routes ───────────────────────────────────────────────────────────

// Validate a promo code
router.post('/validate', (req, res) => {
  const { code, cart_total_paise } = req.body;
  
  if (!code) return res.status(400).json({ error: 'Code is required' });

  try {
    const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND is_active = 1').get(code.toUpperCase());

    if (!promo) return res.status(404).json({ error: 'Invalid or inactive promo code' });

    // Check expiry
    if (promo.expiry_date && new Date(promo.expiry_date) < new Date()) {
      return res.status(400).json({ error: 'Promo code has expired' });
    }

    // Check usage limit
    if (promo.usage_limit > 0 && promo.times_used >= promo.usage_limit) {
      return res.status(400).json({ error: 'Promo code usage limit reached' });
    }

    // Check min purchase
    if (cart_total_paise < promo.min_purchase_paise) {
      return res.status(400).json({ 
        error: `Minimum purchase of ₹${(promo.min_purchase_paise / 100).toLocaleString()} required` 
      });
    }

    res.json({
      success: true,
      code: promo.code,
      type: promo.type,
      value: promo.value
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
