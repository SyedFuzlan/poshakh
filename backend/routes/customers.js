// ──────────────────────────────────────────────
//  routes/customers.js
//  POST /api/customers/signup  — register
//  POST /api/customers/login   — authenticate
//  GET  /api/customers/me      — get own profile (requires customer JWT)
// ──────────────────────────────────────────────
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db").db;
const requireCustomer = require("../middleware/requireCustomer");

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

function signCustomerToken(id, phone) {
  return jwt.sign(
    { role: "customer", id, phone: phone || null },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
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

    const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
    const token = signCustomerToken(id, row.phone);

    res.status(201).json({ success: true, token, customer: formatCustomer(row) });
  } catch (err) {
    console.error("POST /api/customers/signup error:", err);
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

    const token = signCustomerToken(row.id, row.phone);
    res.json({ success: true, token, customer: formatCustomer(row) });
  } catch (err) {
    console.error("POST /api/customers/login error:", err);
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

module.exports = router;
