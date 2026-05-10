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

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerHash  = process.env.OWNER_PASSWORD_HASH;

    // Startup guard — if the env var is missing, fail loudly (not silently)
    if (!ownerHash || !ownerEmail) {
      logger.error("OWNER_PASSWORD_HASH or OWNER_EMAIL not set in environment");
      return res.status(500).json({ error: "Something went wrong" });
    }

    // Evaluate both checks — prevents timing-based user enumeration
    const emailOk = email.toLowerCase().trim() === ownerEmail.toLowerCase().trim();
    const passOk  = await bcrypt.compare(password, ownerHash);  // async — never use compareSync

    if (!emailOk || !passOk) {
      // Same error message regardless of which field is wrong
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { role: "owner", email: ownerEmail },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, email: ownerEmail });
  } catch (err) {
    logger.error(err, "POST /api/auth/login error");
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/verify — dashboard uses this on page load to check session
router.post("/verify", requireOwner, (req, res) => {
  res.json({ valid: true, email: req.owner.email });
});

module.exports = router;
