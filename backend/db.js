// ──────────────────────────────────────────────
//  db.js — SQLite using sql.js (pure JS, no C++ needed)
//  Exposes a thin synchronous wrapper API used by routes.
// ──────────────────────────────────────────────
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, "poshakh.db");

let _db = null; // sql.js Database instance (set after init)

// ── Bootstrap — call once at startup ─────────────
async function initDb() {
  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();

  let filebuffer = null;
  if (fs.existsSync(DB_PATH)) {
    filebuffer = fs.readFileSync(DB_PATH);
  }

  _db = filebuffer ? new SQL.Database(filebuffer) : new SQL.Database();

  // WAL mode doesn't apply to sql.js (in-memory), but we persist to disk after writes
  _db.run("PRAGMA foreign_keys = ON");

  // Schema
  _db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      price_paise INTEGER NOT NULL,
      category    TEXT    NOT NULL,
      collection  TEXT    DEFAULT '',
      image_url   TEXT    DEFAULT '',
      created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);

  // Phase 01: add description column — idempotent, only ignore duplicate-column error
  try {
    _db.run(`ALTER TABLE products ADD COLUMN description TEXT`);
  } catch (e) {
    if (!e.message?.includes('duplicate column name')) throw e;
  }
  try {
    _db.run(`ALTER TABLE orders ADD COLUMN customer_email TEXT`);
  } catch (e) {
    if (!e.message?.includes('duplicate column name')) throw e;
  }

  // Phase 01: product variants table — per D-01 / D-02
  _db.run(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size       TEXT    NOT NULL,
      stock      INTEGER NOT NULL DEFAULT 0,
      UNIQUE(product_id, size)
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id                   TEXT    PRIMARY KEY,
      razorpay_payment_id  TEXT,
      razorpay_order_id    TEXT,
      utr                  TEXT,
      payment_method       TEXT    DEFAULT 'razorpay',
      customer_name        TEXT    NOT NULL,
      customer_phone       TEXT    NOT NULL,
      address_line1        TEXT    NOT NULL,
      address_line2        TEXT    DEFAULT '',
      city                 TEXT    NOT NULL,
      state                TEXT    NOT NULL,
      pin_code             TEXT    NOT NULL,
      items_json           TEXT    NOT NULL,
      subtotal_paise       INTEGER NOT NULL,
      shipping_method      TEXT    DEFAULT 'free',
      shipping_cost_paise  INTEGER DEFAULT 0,
      total_paise          INTEGER NOT NULL,
      status               TEXT    DEFAULT 'paid',
      created_at           TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      shipped_at           TEXT
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id            TEXT    PRIMARY KEY,
      first_name    TEXT    NOT NULL DEFAULT '',
      last_name     TEXT    NOT NULL DEFAULT '',
      phone         TEXT    UNIQUE,
      email         TEXT    UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      last_login    TEXT
    )
  `);

  // Persist initial DB file
  persist();
  console.log(`📦 Database ready: ${DB_PATH}`);
  return _db;
}

// ── Persist to disk after every write ────────────
function persist() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── Compatibility API (mirrors better-sqlite3) ────
// sql.js is in-memory and synchronous.
// Parameters must be passed as an array to _db.run() and _db.exec().

function toParamArray(args) {
  // Called as .run(a, b, c) OR .run([a, b, c]) — normalise to flat array
  if (args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return Array.from(args);
}

const db = {
  prepare(sql) {
    return {
      run(...args) {
        const params = toParamArray(args);
        _db.run(sql, params);
        // Read lastInsertRowid BEFORE persist() — persisting reloads from disk
        // which would reset the connection-level last_insert_rowid to 0
        const rid = _db.exec("SELECT last_insert_rowid()");
        const lastInsertRowid = rid[0]?.values?.[0]?.[0] ?? null;
        persist();
        return { lastInsertRowid };
      },
      get(...args) {
        const params = toParamArray(args);
        const result = _db.exec(sql, params);
        if (!result.length || !result[0].values.length) return undefined;
        const cols = result[0].columns;
        const row = result[0].values[0];
        return Object.fromEntries(cols.map((c, i) => [c, row[i]]));
      },
      all(...args) {
        const params = toParamArray(args);
        const result = _db.exec(sql, params);
        if (!result.length) return [];
        const cols = result[0].columns;
        return result[0].values.map((row) =>
          Object.fromEntries(cols.map((c, i) => [c, row[i]]))
        );
      },
    };
  },
  run(sql, params) {
    _db.run(sql, params || []);
    persist();
  },
  exec(sql) {
    return _db.exec(sql);
  },
};

module.exports = { initDb, db };
