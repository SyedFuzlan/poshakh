// ──────────────────────────────────────────────
//  middleware/requireOwner.js
//  Verifies the owner JWT on protected routes
// ──────────────────────────────────────────────
const jwt = require("jsonwebtoken");

function requireOwner(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.owner = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = requireOwner;
