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

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'poshakh.db');
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

  // ── tables ────────────────────────────────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT,
      price       REAL    NOT NULL DEFAULT 0,
      price_paise INTEGER NOT NULL DEFAULT 0,
      category    TEXT    NOT NULL DEFAULT '',
      collection  TEXT    NOT NULL DEFAULT '',
      brand       TEXT,
      image_url   TEXT    NOT NULL DEFAULT '',
      stock       INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
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
      utr              TEXT,
      created_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   TEXT    NOT NULL,
      product_id TEXT,
      name       TEXT,
      variant_id INTEGER,
      quantity   INTEGER NOT NULL,
      price      REAL    NOT NULL,
      size       TEXT,
      image      TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // ── safe migrations (columns that may not exist in older DBs) ─────────
  const safeMigrate = (sql) => {
    try { _db.run(sql); } catch (e) {
      if (!String(e.message).includes('duplicate column')) console.error('[db] migration warning:', e.message);
    }
  };

  safeMigrate('ALTER TABLE products ADD COLUMN price_paise INTEGER NOT NULL DEFAULT 0');
  safeMigrate('ALTER TABLE products ADD COLUMN collection TEXT NOT NULL DEFAULT ""');
  safeMigrate('ALTER TABLE products ADD COLUMN brand TEXT');
  safeMigrate('ALTER TABLE orders ADD COLUMN customer_name TEXT');
  safeMigrate('ALTER TABLE orders ADD COLUMN customer_email TEXT');
  safeMigrate('ALTER TABLE orders ADD COLUMN customer_phone TEXT');
  safeMigrate('ALTER TABLE orders ADD COLUMN payment_method TEXT');
  safeMigrate('ALTER TABLE orders ADD COLUMN utr TEXT');

  _save();
  console.log('[db] Ready — path:', DB_PATH);
  return _db;
}

function getDb() {
  if (!_db) throw new Error('DB not initialised');
  return _db;
}

// ── module exports ────────────────────────────────────────────────────────

module.exports = {
  initDb,
  saveDb,
  getDb,
  // The 'db' object is what routes import: const db = require('../db').db
  db: { prepare },
};
