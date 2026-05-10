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
    console.log('Login request for email:', email);

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

    console.log('Env vars present. Email check...');
    const emailOk = email.toLowerCase().trim() === ownerEmail.toLowerCase().trim();
    
    console.log('Bcrypt comparing...');
    let passOk = false;
    try {
      passOk = await bcrypt.compare(password, ownerHash);
    } catch (bcryptErr) {
      console.error('Bcrypt error:', bcryptErr);
      throw new Error('Bcrypt comparison failed: ' + bcryptErr.message);
    }

    if (!emailOk || !passOk) {
      console.log('Login failed: Invalid credentials');
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log('Login success. Signing JWT...');
    if (!process.env.JWT_SECRET) {
      console.error('CRITICAL: JWT_SECRET missing');
      throw new Error('JWT_SECRET not configured');
    }

    const token = jwt.sign(
      { role: "owner", email: ownerEmail },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log('Login completed successfully');
    res.json({ token, email: ownerEmail });
  } catch (err) {
    console.error('Login route catch block:', err);
    logger.error(err, "POST /api/auth/login error");
    res.status(500).json({ error: "Login failed: " + err.message });
  }
});

// POST /api/auth/verify — dashboard uses this on page load to check session
router.post("/verify", requireOwner, (req, res) => {
  res.json({ valid: true, email: req.owner.email });
});

module.exports = router;
