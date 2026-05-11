// ──────────────────────────────────────────────
//  routes/auth.js
//  POST /api/auth/login  — owner login
//  POST /api/auth/verify — check if token valid
// ──────────────────────────────────────────────
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const requireOwner = require("../middleware/requireOwner");
const logger = require("../utils/logger");

const rateLimit = require("express-rate-limit");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later." }
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerHash  = process.env.OWNER_PASSWORD_HASH;

    // Startup guard — if the env var is missing, fail loudly
    if (!ownerHash || !ownerEmail) {
      console.error("CRITICAL: OWNER_PASSWORD_HASH or OWNER_EMAIL not set");
      logger.error("OWNER_PASSWORD_HASH or OWNER_EMAIL not set in environment");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const emailOk = email.toLowerCase().trim() === ownerEmail.toLowerCase().trim();

    let passOk = false;
    try {
      passOk = await bcrypt.compare(password, ownerHash);
    } catch (bcryptErr) {
      logger.error(bcryptErr, 'Bcrypt comparison failed');
      throw new Error('Bcrypt comparison failed: ' + bcryptErr.message);
    }

    if (!emailOk || !passOk) {
      logger.warn({ email }, 'Owner login failed — invalid credentials');
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = jwt.sign(
      { role: "owner", email: ownerEmail },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    logger.info({ email: ownerEmail }, 'Owner login successful');
    res.json({ token, email: ownerEmail });
  } catch (err) {
    logger.error(err, "POST /api/auth/login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/verify — dashboard uses this on page load to check session
router.post("/verify", requireOwner, (req, res) => {
  res.json({ valid: true, email: req.owner.email });
});

module.exports = router;
