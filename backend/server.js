// ──────────────────────────────────────────────
//  server.js — Poshakh API server (Express)
//  Single entry point. Reads .env, mounts routes.
// ──────────────────────────────────────────────
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const cookieParser = require('cookie-parser');
const pinoHttp = require("pino-http");
const { initDb, db } = require("./db");
const logger = require("./utils/logger");

// ── Env validation ──────────────────────────────
const required = ["OWNER_EMAIL", "OWNER_PASSWORD_HASH", "JWT_SECRET"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌  Missing required env vars: ${missing.join(", ")}`);
  console.error("    Copy backend/.env.example to backend/.env and fill in the values.");
  process.exit(1);
}

// In production, email sending requires these two vars
if (process.env.NODE_ENV === 'production') {
  const prodRequired = ["RESEND_API_KEY", "APP_URL"];
  const prodMissing = prodRequired.filter((k) => !process.env[k]);
  if (prodMissing.length > 0) {
    console.error(`❌  Missing required production env vars: ${prodMissing.join(", ")}`);
    console.error("    Set RESEND_API_KEY (from resend.com/api-keys) and APP_URL (frontend URL).");
    process.exit(1);
  }
}

// ── App setup ───────────────────────────────────
const app = express();

// Security, Logging and Performance
app.use(pinoHttp({ logger }));
app.use(compression());
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later." }
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:9000',
  'https://www.madebyzohra.in',
  'https://madebyzohra.in',
  ...(process.env.STORE_CORS || '').split(',').map(o => o.trim()).filter(Boolean),
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Parse cookies (required for httpOnly refresh token cookie)
app.use(cookieParser());

// Parse JSON bodies (except for the webhook route which needs raw)
app.use((req, res, next) => {
  if (req.path === "/api/payments/webhook") return next();
  express.json({ limit: "10mb" })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === "/api/payments/webhook") return next();
  express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
});

// Serve uploaded images as static files
app.use(
  "/uploads",
  express.static(path.join(__dirname, "data", "uploads"), {
    dotfiles: "deny",
    index: false,
  })
);

// Restrictive CSP for the owner dashboard (highest-privilege route)
app.use("/dashboard", helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
  },
}));

// Serve the owner dashboard as a static HTML file
app.use("/dashboard", express.static(path.join(__dirname, "dashboard")));

// ── Routes ──────────────────────────────────────
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/customers", authLimiter, require("./routes/customers"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", apiLimiter, require("./routes/orders"));
app.use("/api/payments", apiLimiter, require("./routes/payments").router);
app.use("/api/promo", require("./routes/promo"));
app.use("/api/settings", require("./routes/site-settings"));
const { router: checkoutRouter, runRecoveryTask } = require("./routes/checkouts");
app.use("/api/checkouts", checkoutLimiter, checkoutRouter);

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
  logger.error(err, "Unhandled error");
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
    
    // Start background recovery task (every 30 mins)
    setInterval(runRecoveryTask, 30 * 60 * 1000);
    // Initial run after 1 min
    setTimeout(runRecoveryTask, 60 * 1000);
  });
})();

// ── Graceful Shutdown ───────────────────────────
const shutdown = async (signal) => {
  logger.info({ signal }, "Shutdown signal received");
  // No explicit close for sql.js, but we can ensure process exits cleanly
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => {
  logger.fatal(err, "Unhandled rejection");
  shutdown("unhandledRejection");
});
