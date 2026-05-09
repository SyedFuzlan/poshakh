// ────────────────────────────────────────────────────────────────────────
//  db.js  — sql.js wrapper that mimics better-sqlite3's synchronous API
//
//  better-sqlite3 API used in routes:
//    db.prepare(sql).all(p1, p2, ...)          → row[]
//    db.prepare(sql).get(p1, p2, ...)          → row | null
//    db.prepare(sql).run(p1, p2, ...)          → { lastInsertRowid }
//    db.prepare(sql).all([array])              (array form)
//    db.prepare(sql).run([array])              (array form)
// ────────────────────────────────────────────────────────────────────────
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'poshakh.db');
let _db = null;

// ── helpers ───────────────────────────────────────────────────────────────

function flatParams(args) {
  // Routes call .run(a, b, c) or .run([a, b, c]) — normalise to flat array
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

// ── public prepare API ────────────────────────────────────────────────────

function prepare(sql) {
  if (!_db) throw new Error('DB not initialised — call initDb() first');

  return {
    all(...args) {
      const stmt = _db.prepare(sql);
      const params = flatParams(args);
      if (params.length) stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },

    get(...args) {
      const stmt = _db.prepare(sql);
      const params = flatParams(args);
      if (params.length) stmt.bind(params);
      const row = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      return row;
    },

    run(...args) {
      const stmt = _db.prepare(sql);
      const params = flatParams(args);
      if (params.length) stmt.bind(params);
      stmt.step();
      stmt.free();
      // Retrieve last rowid BEFORE saving, while the same in-memory DB holds it
      const rowIdResult = _db.exec('SELECT last_insert_rowid()');
      const lastInsertRowid =
        rowIdResult.length && rowIdResult[0].values.length
          ? Number(rowIdResult[0].values[0][0])
          : 0;
      _save();
      return { lastInsertRowid };
    },
  };
}

// ── persistence ───────────────────────────────────────────────────────────

function _save() {
  if (!_db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
}

function saveDb() { _save(); }

// ── init ──────────────────────────────────────────────────────────────────

async function initDb() {
  if (_db) return _db;

  const SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  console.log('[db] Initialising schema…');
  _db.run('PRAGMA foreign_keys = ON;');

  // ── Migrations ────────────────────────────────────────────────────────
  const migrations = [
    "ALTER TABLE products ADD COLUMN description TEXT;",
    "ALTER TABLE products ADD COLUMN brand TEXT;",
    "ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;",
    "ALTER TABLE products ADD COLUMN meta_title TEXT;",
    "ALTER TABLE products ADD COLUMN meta_description TEXT;",
    "ALTER TABLE products ADD COLUMN slug TEXT;",
    "ALTER TABLE products ADD COLUMN compare_at_price_paise INTEGER;",
    "ALTER TABLE orders ADD COLUMN customer_email TEXT;",
    "ALTER TABLE order_items ADD COLUMN price_paise INTEGER;"
  ];

  for (const m of migrations) {
    try { _db.run(m); } catch (e) { /* ignore if already exists */ }
  }

  // ── tables ────────────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT,
      price_paise INTEGER NOT NULL DEFAULT 0,
      compare_at_price_paise INTEGER,
      category_id INTEGER,
      collection  TEXT    NOT NULL DEFAULT '',
      brand       TEXT,
      slug        TEXT    UNIQUE,
      meta_title  TEXT,
      meta_description TEXT,
      created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      parent_id   INTEGER,
      slug        TEXT    UNIQUE NOT NULL,
      description TEXT,
      position    INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL,
      url         TEXT    NOT NULL,
      alt_text    TEXT,
      position    INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checkouts (
      id               TEXT PRIMARY KEY,
      customer_name    TEXT,
      customer_phone   TEXT,
      customer_email   TEXT,
      items_json       TEXT,
      total_paise      INTEGER,
      status           TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'recovered'
      last_notified_at TEXT,
      created_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      updated_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      size       TEXT,
      color      TEXT,
      stock      INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id            TEXT PRIMARY KEY,
      first_name    TEXT NOT NULL DEFAULT '',
      last_name     TEXT NOT NULL DEFAULT '',
      phone         TEXT UNIQUE,
      email         TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      last_login    TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id               TEXT PRIMARY KEY,
      customer_id      TEXT,
      customer_name    TEXT,
      customer_email   TEXT,
      customer_phone   TEXT,
      total_amount     REAL    NOT NULL,
      status           TEXT    DEFAULT 'pending',
      payment_method   TEXT,
      shipping_address TEXT,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      utr              TEXT,
      address_line1    TEXT,
      address_line2    TEXT,
      city             TEXT,
      state            TEXT,
      pin_code         TEXT,
      items_json       TEXT,
      subtotal_paise   INTEGER,
      shipping_method  TEXT,
      shipping_cost_paise INTEGER,
      total_paise      INTEGER,
      shipped_at       TEXT,
      courier_name     TEXT,
      tracking_number  TEXT,
      created_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   TEXT    NOT NULL,
      product_id INTEGER,
      variant_id INTEGER,
      name       TEXT,
      quantity   INTEGER NOT NULL,
      price_paise INTEGER NOT NULL,
      size       TEXT,
      image      TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    TEXT    NOT NULL,
      status      TEXT    NOT NULL,
      comment     TEXT,
      admin_id    TEXT,
      created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id  INTEGER NOT NULL,
      change      INTEGER NOT NULL, -- e.g. -1 for sale, +5 for restock
      reason      TEXT, -- 'sale', 'return', 'manual_adjustment', 'incoming_shipment'
      order_id    TEXT,
      admin_id    TEXT,
      created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id   TEXT,
      action     TEXT    NOT NULL,
      details    TEXT,
      old_value  TEXT,
      new_value  TEXT,
      created_at TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );
    
    CREATE TABLE IF NOT EXISTS promo_codes (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      code               TEXT    UNIQUE NOT NULL,
      type               TEXT    NOT NULL, -- 'percentage' | 'flat'
      value              REAL    NOT NULL,
      min_purchase_paise INTEGER DEFAULT 0,
      expiry_date        TEXT,
      usage_limit        INTEGER DEFAULT 0, -- 0 = unlimited
      times_used         INTEGER DEFAULT 0,
      is_active          INTEGER DEFAULT 1, -- 1 = true, 0 = false
      created_at         TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // ── safe migrations (columns that may not exist in older DBs) ─────────
  const safeMigrate = (sql) => {
    try { _db.run(sql); } catch (e) {
      if (!String(e.message).includes('duplicate column')) console.error('[db] migration warning:', e.message);
    }
  };

  safeMigrate('ALTER TABLE products ADD COLUMN category_id INTEGER');
  safeMigrate('ALTER TABLE products ADD COLUMN slug TEXT');
  safeMigrate('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug)');
  safeMigrate('ALTER TABLE products ADD COLUMN meta_title TEXT');
  safeMigrate('ALTER TABLE products ADD COLUMN meta_description TEXT');
  safeMigrate('ALTER TABLE order_items ADD COLUMN price_paise INTEGER');
  safeMigrate('ALTER TABLE checkouts ADD COLUMN promo_code TEXT');

  // Create default category if none exists
  try {
    const cat = _db.prepare("SELECT id FROM categories LIMIT 1").step();
    if (!cat) {
      _db.run("INSERT INTO categories (name, slug) VALUES ('Uncategorized', 'uncategorized')");
    }
  } catch(e) {}

  _save();
  console.log('[db] Ready — path:', DB_PATH);
  return _db;
}

function getDb() {
  if (!_db) throw new Error('DB not initialised');
  return _db;
}

/**
 * A simple synchronous transaction helper.
 * Since sql.js is in-memory, we just run the callback and save to disk once at the end.
 */
function transaction(fn) {
  try {
    _db.run('BEGIN TRANSACTION');
    const result = fn();
    _db.run('COMMIT');
    _save();
    return result;
  } catch (err) {
    _db.run('ROLLBACK');
    throw err;
  }
}

/**
 * Logs an admin action to the audit_logs table.
 */
function logAudit({ adminId, action, details, oldValue, newValue }) {
  try {
    prepare(`
      INSERT INTO audit_logs (admin_id, action, details, old_value, new_value)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      adminId || 'system',
      action,
      details || null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null
    );
  } catch (err) {
    console.error('[db] Audit log failed:', err.message);
  }
}

// ── module exports ────────────────────────────────────────────────────────

module.exports = {
  initDb,
  saveDb,
  getDb,
  // The 'db' object is what routes import: const db = require('../db').db
  db: { prepare, transaction, logAudit },
};
