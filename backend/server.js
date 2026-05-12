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
const crypto = require("crypto");
const { register, httpRequestDurationMicroseconds } = require("./utils/metrics");
const Sentry = require("@sentry/node");

// ── Sentry ─────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
  });
}

// ── Env validation ──────────────────────────────
const required = ["OWNER_EMAIL", "OWNER_PASSWORD_HASH", "JWT_SECRET"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  logger.fatal(`❌ Missing required env vars: ${missing.join(", ")}`);
  logger.fatal("Copy backend/.env.example to backend/.env and fill in the values.");
  process.exit(1);
}

// In production, email sending requires these vars
if (process.env.NODE_ENV === 'production') {
  const prodRequired = ["RESEND_API_KEY", "APP_URL", "BACKEND_URL"];
  const prodMissing = prodRequired.filter((k) => !process.env[k]);
  if (prodMissing.length > 0) {
    logger.fatal(`❌ Missing required production env vars: ${prodMissing.join(", ")}`);
    logger.fatal("Set RESEND_API_KEY, APP_URL (frontend URL), and BACKEND_URL (backend API URL).");
    process.exit(1);
  }
}

// ── App setup ───────────────────────────────────
const app = express();

// Security, Logging and Performance
app.use(pinoHttp({ logger }));

// Propagate Request ID to headers
app.use((req, res, next) => {
  res.setHeader("X-Request-Id", req.id);
  next();
});

// Metrics Middleware
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    
    // Only track if route is defined (avoids spam from 404s/static)
    if (req.route) {
      httpRequestDurationMicroseconds.observe(
        { method: req.method, route: req.route.path, code: res.statusCode },
        durationInSeconds
      );
    }
  });
  next();
});

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

// Loose limiter for the /api/customers prefix (covers /refresh, /logout, /me).
// Tight authLimiter is applied per-route inside customers.js for signup, login,
// forgot-password and reset-password.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
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
  process.env.BACKEND_URL,
  process.env.APP_URL,
  ...(process.env.STORE_CORS || '').split(',').map(o => o.trim()).filter(Boolean),
].filter(Boolean).map(o => o.replace(/\/$/, '')));

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
  if (req.path.includes("/payments/webhook")) return next();
  express.json({ limit: "10mb" })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.includes("/payments/webhook")) return next();
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

// Serve the owner dashboard as a static HTML file
app.use("/dashboard", express.static(path.join(__dirname, "dashboard")));

// ── Routes ──────────────────────────────────────
const v1 = express.Router();

v1.use("/auth", require("./routes/auth"));
v1.use("/customers", refreshLimiter, require("./routes/customers"));
v1.use("/products", require("./routes/products"));
v1.use("/orders", apiLimiter, require("./routes/orders"));
v1.use("/payments", apiLimiter, require("./routes/payments").router);
v1.use("/promo", require("./routes/promo"));
v1.use("/settings", require("./routes/site-settings"));
const { router: checkoutRouter, runRecoveryTask } = require("./routes/checkouts");
v1.use("/checkouts", checkoutLimiter, checkoutRouter);

app.use("/api/v1", v1);
app.use("/api", v1); // Alias for backward compatibility

// Delhivery delivery status webhooks
app.use("/api/webhooks", require("./routes/webhooks"));

// Health check
app.get("/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", service: "poshakh-api", version: "1.0.0", database: "connected" });
  } catch (err) {
    logger.error(err, "Health check failed");
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

// Prometheus metrics
app.get("/metrics", async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "poshakh-api", version: "1.0.0" });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  logger.error(err, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ───────────────────────────────────────
const PORT = parseInt(process.env.PORT || "9000", 10);

let server;
(async () => {
  // Run migrations on startup
  try {
    console.log('[db] Running migrations...');
    const { execSync } = require('child_process');
    // Run in the backend directory specifically to find database.json and migrations/
    execSync('npx db-migrate up --config ./database.json', { 
      stdio: 'inherit',
      cwd: __dirname,
      timeout: 30000 // 30 second timeout to prevent indefinite hang
    });
    console.log('[db] Migrations completed.');
  } catch (err) {
    console.error('[db] Migration failed or timed out:', err.message);
    // Continue anyway - better to be up than down
  }

  await initDb();
  server = app.listen(PORT, () => {
    logger.info(`Poshakh API running on http://localhost:${PORT}`);
    logger.info(`Dashboard: http://localhost:${PORT}/dashboard`);
    
    setInterval(runRecoveryTask, 30 * 60 * 1000);
    setTimeout(runRecoveryTask, 60 * 1000);
  });
})();

// ── Graceful Shutdown ───────────────────────────
const shutdown = async (signal) => {
  logger.info({ signal }, "Shutdown signal received");
  
  if (server) {
    logger.info("Closing HTTP server...");
    server.close(() => {
      logger.info("HTTP server closed");
    });
  }

  try {
    await db.close();
    logger.info("Database pool closed");
    process.exit(0);
  } catch (err) {
    logger.error(err, "Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => {
  logger.fatal(err, "Unhandled rejection");
  shutdown("unhandledRejection");
});
