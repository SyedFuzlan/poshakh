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
const rateLimit = require("express-rate-limit");
const db = require("../db").db;
const requireCustomer = require("../middleware/requireCustomer");
const logger = require('../utils/logger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();

// Strict limiter applied only to brute-force targets: signup, login, forgot/reset-password.
// /refresh, /logout and /me are NOT subject to this limit — they use the generous
// refreshLimiter mounted on the router prefix in server.js.
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

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
async function issueTokenPair(res, customerId, phone) {
  const accessToken = signAccessToken(customerId, phone);
  const rawRefresh = generateToken();
  const refreshHash = hashToken(rawRefresh);
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.prepare(
    "INSERT INTO refresh_tokens (customer_id, token_hash, expires_at) VALUES ($1, $2, $3)"
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
router.post("/signup", authLimiter, async (req, res) => {
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
      const existing = await db.prepare("SELECT id FROM customers WHERE phone = $1 AND deleted_at IS NULL").get(phone.trim());
      if (existing) return res.status(409).json({ error: "An account with this phone number already exists" });
    }
    if (email) {
      const existing = await db.prepare("SELECT id FROM customers WHERE email = $1 AND deleted_at IS NULL").get(email.trim().toLowerCase());
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
    await db.transaction(async (client) => {
      await client.query(`
        INSERT INTO customers (id, first_name, last_name, phone, email, password_hash, last_login)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        id,
        (firstName || "").trim(),
        (lastName  || "").trim(),
        phone ? phone.trim() : null,
        email ? email.trim().toLowerCase() : null,
        passwordHash,
        now
      ]);

      if (email) {
        await client.query(
          "INSERT INTO email_verification_tokens (customer_id, token_hash, expires_at) VALUES ($1, $2, $3)",
          [id, verifHash, verifExpiry]
        );
      }
    });

    const row = await db.prepare("SELECT * FROM customers WHERE id = $1").get(id);
    const accessToken = await issueTokenPair(res, id, row.phone);

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
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({ error: "Identifier and password are required" });
    }

    const isPhone = /^\+?\d{7,}$/.test(identifier.trim());
    const row = isPhone
      ? await db.prepare("SELECT * FROM customers WHERE phone = $1 AND deleted_at IS NULL").get(identifier.trim())
      : await db.prepare("SELECT * FROM customers WHERE email = $1 AND deleted_at IS NULL").get(identifier.trim().toLowerCase());

    // Constant-time path — no user enumeration
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const now = new Date().toISOString();
    await db.prepare("UPDATE customers SET last_login = $1 WHERE id = $2").run(now, row.id);

    const accessToken = await issueTokenPair(res, row.id, row.phone);
    res.json({ success: true, accessToken, customer: formatCustomer(row) });
  } catch (err) {
    logger.error(err, 'POST /api/customers/login error');
    res.status(500).json({ error: "Login failed" });
  }
});

// ── GET /api/customers/me ──────────────────────
router.get("/me", requireCustomer, async (req, res) => {
  try {
    const row = await db.prepare("SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL").get(req.customer.id);
    if (!row) return res.status(404).json({ error: "Customer not found" });
    res.json({ customer: formatCustomer(row) });
  } catch (err) {
    logger.error(err, 'GET /api/customers/me error');
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// ── POST /api/customers/refresh ────────────────
router.post('/refresh', async (req, res) => {
  try {
    const inbound = req.cookies?.refreshToken;
    if (!inbound) return res.status(401).json({ error: 'No refresh token' });

    const inboundHash = hashToken(inbound);
    const row = await db.prepare(
      "SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()"
    ).get(inboundHash);

    if (!row) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const customer = await db.prepare("SELECT id, phone FROM customers WHERE id = $1").get(row.customer_id);
    if (!customer) return res.status(401).json({ error: 'Customer not found' });

    // Atomic rotation: DELETE old token + INSERT new one in a single transaction
    // so that a crash between the two writes cannot silently log out the user.
    const rawRefresh = generateToken();
    const refreshHash = hashToken(rawRefresh);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.transaction(async (client) => {
      await client.query("DELETE FROM refresh_tokens WHERE id = $1", [row.id]);
      await client.query(
        "INSERT INTO refresh_tokens (customer_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        [customer.id, refreshHash, refreshExpiry]
      );
    });

    res.cookie('refreshToken', rawRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/customers',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const accessToken = signAccessToken(customer.id, customer.phone);
    res.json({ accessToken });
  } catch (err) {
    logger.error(err, 'POST /api/customers/refresh error');
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ── POST /api/customers/logout ─────────────────
router.post('/logout', async (req, res) => {
  try {
    const inbound = req.cookies?.refreshToken;
    if (inbound) {
      const hash = hashToken(inbound);
      await db.prepare("DELETE FROM refresh_tokens WHERE token_hash = $1").run(hash);
    }
    res.clearCookie('refreshToken', { path: '/api/customers' });
    res.json({ success: true });
  } catch (err) {
    logger.error(err, 'POST /api/customers/logout error');
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ── GET /api/customers/verify-email ───────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string' || token.length !== 64) {
      return res.status(400).json({ error: 'Invalid or missing token' });
    }

    const tokenHash = hashToken(token);
    const row = await db.prepare(
      "SELECT * FROM email_verification_tokens WHERE token_hash = $1 AND expires_at > NOW()"
    ).get(tokenHash);

    if (!row) return res.status(400).json({ error: 'Invalid or expired verification token' });

    // Mark verified and delete token atomically
    await db.transaction(async (client) => {
      await client.query("UPDATE customers SET email_verified = true WHERE id = $1", [row.customer_id]);
      await client.query("DELETE FROM email_verification_tokens WHERE token_hash = $1", [tokenHash]);
    });

    res.json({ verified: true });
  } catch (err) {
    logger.error(err, 'GET /api/customers/verify-email error');
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── POST /api/customers/forgot-password ────────
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};

    // Always return 200 to prevent user enumeration
    if (!email || typeof email !== 'string') {
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const customer = await db.prepare(
      "SELECT id, email FROM customers WHERE email = $1"
    ).get(email.trim().toLowerCase());

    if (customer) {
      const rawToken = generateToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

      // Invalidate any existing reset tokens before issuing a new one so that
      // a prior intercepted link cannot be used alongside the new one.
      await db.prepare(
        "DELETE FROM password_reset_tokens WHERE customer_id = $1"
      ).run(customer.id);

      await db.prepare(
        "INSERT INTO password_reset_tokens (customer_id, token_hash, expires_at) VALUES ($1, $2, $3)"
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
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || typeof token !== 'string' || token.length !== 64) {
      return res.status(400).json({ error: 'Invalid or missing token' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const tokenHash = hashToken(token);
    const row = await db.prepare(
      "SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW()"
    ).get(tokenHash);

    if (!row) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Atomic: update password + delete token in single transaction
    await db.transaction(async (client) => {
      await client.query(
        "UPDATE customers SET password_hash = $1 WHERE id = $2",
        [passwordHash, row.customer_id]
      );
      await client.query(
        "DELETE FROM password_reset_tokens WHERE token_hash = $1",
        [tokenHash]
      );
    });

    res.json({ success: true });
  } catch (err) {
    logger.error(err, 'POST /api/customers/reset-password error');
    res.status(500).json({ error: 'Password reset failed' });
  }
});

module.exports = router;
