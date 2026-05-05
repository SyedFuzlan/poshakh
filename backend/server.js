// ──────────────────────────────────────────────
//  server.js — Poshakh API server (Express)
//  Single entry point. Reads .env, mounts routes.
// ──────────────────────────────────────────────
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const path = require("path");
const { initDb } = require("./db");

// ── Env validation ──────────────────────────────
const required = ["OWNER_EMAIL", "OWNER_PASSWORD", "JWT_SECRET"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌  Missing required env vars: ${missing.join(", ")}`);
  console.error("    Copy backend/.env.example to backend/.env and fill in the values.");
  process.exit(1);
}

// ── App setup ───────────────────────────────────
const app = express();

// Required for Express to correctly handle HTTPS behind proxies (Railway, Vercel)
app.set("trust proxy", 1);

// CORS — allow the frontend origin and the dashboard's own origin
const PORT_NUM = parseInt(process.env.PORT || "9000", 10);
const selfOrigin = `http://localhost:${PORT_NUM}`;
const allowedOrigins = [
  selfOrigin,
  ...(process.env.STORE_CORS || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim()),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, same-origin requests)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Parse JSON bodies (except for the webhook route which needs raw)
app.use((req, res, next) => {
  if (req.path === "/api/payments/webhook") return next();
  express.json({ limit: "10mb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve uploaded images as static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve the owner dashboard as a static HTML file
app.use("/dashboard", express.static(path.join(__dirname, "dashboard")));

// ── Routes ──────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/payments", require("./routes/payments").router);

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "poshakh-api", version: "1.0.0" });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ───────────────────────────────────────
const PORT = parseInt(process.env.PORT || "9000", 10);

(async () => {
  await initDb(); // Initialize SQLite DB before accepting requests
  app.listen(PORT, () => {
    console.log(`
  ┌────────────────────────────────────────────────────┐
  │  🛍️  Poshakh API running                           │
  │  API:       http://localhost:${PORT}                  │
  │  Dashboard: http://localhost:${PORT}/dashboard        │
  └────────────────────────────────────────────────────┘
    `);
  });
})();
