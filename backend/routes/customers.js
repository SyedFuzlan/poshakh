// ──────────────────────────────────────────────
//  routes/customers.js
//  POST /api/customers/signup  — register
//  POST /api/customers/login   — authenticate
//  GET  /api/customers/me      — get own profile (requires customer JWT)
//  POST /api/customers/refresh — rotate refresh token
//  POST /api/customers/logout  — revoke refresh token
// ──────────────────────────────────────────────
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db").db;
const requireCustomer = require("../middleware/requireCustomer");
const logger = require('../utils/logger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();

const BCRYPT_ROUNDS = 12;

function generateCustomerId() {
  return "cust_" + crypto.randomBytes(10).toString("hex");
}

function formatCustomer(row) {
  return {
    id:        row.id,
    firstName: row.first_name,
    lastName:  row.last_name,
    phone:     row.phone  || null,
    email:     row.email  || null,
  };
}

function signAccessToken(id, phone) {
  return jwt.sign(
    { role: "customer", id, phone: phone || null },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Issues access + refresh token pair. Sets httpOnly cookie and returns accessToken.
function issueTokenPair(res, customerId, phone) {
  const accessToken = signAccessToken(customerId, phone);
  const rawRefresh = generateToken();
  const refreshHash = hashToken(rawRefresh);
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    "INSERT INTO refresh_tokens (customer_id, token_hash, expires_at) VALUES (?, ?, ?)"
  ).run(customerId, refreshHash, refreshExpiry);

  res.cookie('refreshToken', rawRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/customers',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return accessToken;
}

// ── POST /api/customers/signup ─────────────────
router.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, phone, email, password } = req.body || {};

    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!phone && !email) {
      return res.status(400).json({ error: "Phone or email is required" });
    }

    // Check for duplicate
    if (phone) {
      const existing = db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone.trim());
      if (existing) return res.status(409).json({ error: "An account with this phone number already exists" });
    }
    if (email) {
      const existing = db.prepare("SELECT id FROM customers WHERE email = ?").get(email.trim().toLowerCase());
      if (existing) return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = generateCustomerId();
    const now = new Date().toISOString();

    // Generate email verification token before transaction
    const rawVerifToken = generateToken();
    const verifHash = hashToken(rawVerifToken);
    const verifExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    // Atomic: insert customer + verification token together
    db.transaction(() => {
      db.prepare(`
        INSERT INTO customers (id, first_name, last_name, phone, email, password_hash, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        (firstName || "").trim(),
        (lastName  || "").trim(),
        phone ? phone.trim() : null,
        email ? email.trim().toLowerCase() : null,
        passwordHash,
        now
      );

      if (email) {
        db.prepare(
          "INSERT INTO email_verification_tokens (customer_id, token_hash, expires_at) VALUES (?, ?, ?)"
        ).run(id, verifHash, verifExpiry);
      }
    })();

    const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
    const accessToken = issueTokenPair(res, id, row.phone);

    // Send verification email outside transaction (non-blocking — failure does not roll back signup)
    if (email) {
      sendVerificationEmail(email.trim().toLowerCase(), rawVerifToken).catch((err) => {
        logger.error(err, 'Email verification send failed for customer ' + id);
      });
    }

    res.status(201).json({ success: true, accessToken, customer: formatCustomer(row) });
  } catch (err) {
    logger.error(err, 'POST /api/customers/signup error');
    res.status(500).json({ error: "Signup failed" });
  }
});

// ── POST /api/customers/login ──────────────────
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({ error: "Identifier and password are required" });
    }

    const isPhone = /^\+?\d{7,}$/.test(identifier.trim());
    const row = isPhone
      ? db.prepare("SELECT * FROM customers WHERE phone = ?").get(identifier.trim())
      : db.prepare("SELECT * FROM customers WHERE email = ?").get(identifier.trim().toLowerCase());

    // Constant-time path — no user enumeration
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE customers SET last_login = ? WHERE id = ?").run(now, row.id);

    const accessToken = issueTokenPair(res, row.id, row.phone);
    res.json({ success: true, accessToken, customer: formatCustomer(row) });
  } catch (err) {
    logger.error(err, 'POST /api/customers/login error');
    res.status(500).json({ error: "Login failed" });
  }
});

// ── GET /api/customers/me ──────────────────────
router.get("/me", requireCustomer, (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.customer.id);
    if (!row) return res.status(404).json({ error: "Customer not found" });
    res.json({ customer: formatCustomer(row) });
  } catch (err) {
    console.error("GET /api/customers/me error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// ── POST /api/customers/refresh ────────────────
router.post('/refresh', (req, res) => {
  try {
    const inbound = req.cookies?.refreshToken;
    if (!inbound) return res.status(401).json({ error: 'No refresh token' });

    const inboundHash = hashToken(inbound);
    const row = db.prepare(
      "SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')"
    ).get(inboundHash);

    if (!row) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    // Rotation: delete old token row first
    db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(row.id);

    // Issue new token pair (inserts new refresh_tokens row + sets cookie)
    const customer = db.prepare("SELECT id, phone FROM customers WHERE id = ?").get(row.customer_id);
    if (!customer) return res.status(401).json({ error: 'Customer not found' });

    const accessToken = issueTokenPair(res, customer.id, customer.phone);
    res.json({ accessToken });
  } catch (err) {
    logger.error(err, 'POST /api/customers/refresh error');
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ── POST /api/customers/logout ─────────────────
router.post('/logout', (req, res) => {
  try {
    const inbound = req.cookies?.refreshToken;
    if (inbound) {
      const hash = hashToken(inbound);
      db.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(hash);
    }
    res.clearCookie('refreshToken', { path: '/api/customers' });
    res.json({ success: true });
  } catch (err) {
    logger.error(err, 'POST /api/customers/logout error');
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ── GET /api/customers/verify-email ───────────
router.get('/verify-email', (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string' || token.length !== 64) {
      return res.status(400).json({ error: 'Invalid or missing token' });
    }

    const tokenHash = hashToken(token);
    const row = db.prepare(
      "SELECT * FROM email_verification_tokens WHERE token_hash = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')"
    ).get(tokenHash);

    if (!row) return res.status(400).json({ error: 'Invalid or expired verification token' });

    // Mark verified and delete token atomically
    db.transaction(() => {
      db.prepare("UPDATE customers SET email_verified = 1 WHERE id = ?").run(row.customer_id);
      db.prepare("DELETE FROM email_verification_tokens WHERE token_hash = ?").run(tokenHash);
    })();

    res.json({ verified: true });
  } catch (err) {
    logger.error(err, 'GET /api/customers/verify-email error');
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── POST /api/customers/forgot-password ────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};

    // Always return 200 to prevent user enumeration
    if (!email || typeof email !== 'string') {
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const customer = db.prepare(
      "SELECT id, email FROM customers WHERE email = ?"
    ).get(email.trim().toLowerCase());

    if (customer) {
      const rawToken = generateToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

      db.prepare(
        "INSERT INTO password_reset_tokens (customer_id, token_hash, expires_at) VALUES (?, ?, ?)"
      ).run(customer.id, tokenHash, expiresAt);

      // Non-blocking — email failure does not affect response
      sendPasswordResetEmail(customer.email, rawToken).catch((err) => {
        logger.error(err, 'Password reset email send failed for customer ' + customer.id);
      });
    }

    // Same response whether customer found or not — anti-enumeration
    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    logger.error(err, 'POST /api/customers/forgot-password error');
    res.status(500).json({ error: 'Request failed' });
  }
});

// ── POST /api/customers/reset-password ─────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || typeof token !== 'string' || token.length !== 64) {
      return res.status(400).json({ error: 'Invalid or missing token' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const tokenHash = hashToken(token);
    const row = db.prepare(
      "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')"
    ).get(tokenHash);

    if (!row) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Atomic: update password + delete token in single transaction
    db.transaction(() => {
      db.prepare(
        "UPDATE customers SET password_hash = ? WHERE id = ?"
      ).run(passwordHash, row.customer_id);
      db.prepare(
        "DELETE FROM password_reset_tokens WHERE token_hash = ?"
      ).run(tokenHash);
    })();

    res.json({ success: true });
  } catch (err) {
    logger.error(err, 'POST /api/customers/reset-password error');
    res.status(500).json({ error: 'Password reset failed' });
  }
});

module.exports = router;
