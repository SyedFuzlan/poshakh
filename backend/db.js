const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || './poshakh.db';
let _db = null;

async function initDb() {
  if (_db) return _db;

  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  console.log('Initializing Database Schema...');

  // 1. Create Tables
  _db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT,
      image_url TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      size TEXT,
      color TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      shipping_address TEXT,
      razorpay_order_id TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      phone TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      last_login TEXT
    );
  `);

  // 2. Migrations
  try {
    _db.run(`ALTER TABLE products ADD COLUMN brand TEXT`);
  } catch (e) {
    if (!e.message?.includes('duplicate column name')) {
      console.error('Migration error (brand):', e.message);
    }
  }

  // Ensure collection column exists (D-06 check)
  try {
    _db.run(`ALTER TABLE products ADD COLUMN collection TEXT`);
  } catch (e) {
    if (!e.message?.includes('duplicate column name')) {
      console.error('Migration error (collection):', e.message);
    }
  }
  
  // Ensure price_paise column exists (since routes use it)
  try {
    _db.run(`ALTER TABLE products ADD COLUMN price_paise INTEGER`);
    // Migrate existing price to price_paise if needed
    _db.run(`UPDATE products SET price_paise = CAST(price * 100 AS INTEGER) WHERE price_paise IS NULL`);
  } catch (e) {
    if (!e.message?.includes('duplicate column name')) {
      console.error('Migration error (price_paise):', e.message);
    }
  }

  saveDb();
  console.log('Database ready');
  return _db;
}

function saveDb() {
  if (!_db) return;
  const data = _db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
  if (!_db) throw new Error("Database not initialized. Call initDb() first.");
  return _db;
}

function prepare(sql) {
  const statement = getDb().prepare(sql);
  return {
    all: (...params) => {
      // Handle array of params or spread params
      const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      statement.bind(p);
      const results = [];
      while (statement.step()) results.push(statement.getAsObject());
      statement.reset(); // Don't free yet, let GC handle or use a pool if needed
      return results;
    },
    get: (...params) => {
      const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      statement.bind(p);
      const result = statement.step() ? statement.getAsObject() : null;
      statement.reset();
      return result;
    },
    run: (...params) => {
      const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      statement.bind(p);
      statement.step();
      statement.reset();
      saveDb();
      // Get last insert ID
      const res = getDb().exec("SELECT last_insert_rowid()");
      return { lastInsertRowid: res[0].values[0][0] };
    },
    free: () => statement.free()
  };
}

module.exports = {
  initDb,
  saveDb,
  getDb,
  db: {
    prepare,
    run: (sql, params) => prepare(sql).run(params),
    get: (sql, params) => prepare(sql).get(params),
    all: (sql, params) => prepare(sql).all(params)
  }
};
