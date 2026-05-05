// ──────────────────────────────────────────────
//  routes/auth.js
//  POST /api/auth/login  — owner login
//  POST /api/auth/verify — check if token valid
// ──────────────────────────────────────────────
const express = require("express");
const jwt = require("jsonwebtoken");
const requireOwner = require("../middleware/requireOwner");

const router = express.Router();

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerPassword = process.env.OWNER_PASSWORD;

  if (
    email.toLowerCase().trim() !== ownerEmail.toLowerCase().trim() ||
    password !== ownerPassword
  ) {
    // Same error message regardless of which field is wrong (prevents enumeration)
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { role: "owner", email: ownerEmail },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, email: ownerEmail });
});

// POST /api/auth/verify — dashboard uses this on page load to check session
router.post("/verify", requireOwner, (req, res) => {
  res.json({ valid: true, email: req.owner.email });
});

module.exports = router;
