const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || './poshakh.db';

let _db = null;

async function initDb() {
    if (_db) return _db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        _db = new SQL.Database(fileBuffer);
  } else {
        _db = new SQL.Database();
  }

  // Create Tables First
  _db.run(`
      CREATE TABLE IF NOT EXISTS products (
            id          TEXT    PRIMARY KEY,
                  name        TEXT    NOT NULL,
                        description TEXT,
                              price       REAL    NOT NULL,
                                    category    TEXT,
                                          image_url   TEXT,
                                                stock       INTEGER NOT NULL DEFAULT 0,
                                                      created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
                                                          )
                                                            `);

  _db.run(`
      CREATE TABLE IF NOT EXISTS product_variants (
            id          TEXT    PRIMARY KEY,
                  product_id  TEXT    NOT NULL,
                        size        TEXT,
                              color       TEXT,
                                    stock       INTEGER NOT NULL DEFAULT 0,
                                          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
                                              )
                                                `);

  _db.run(`
      CREATE TABLE IF NOT EXISTS orders (
            id              TEXT    PRIMARY KEY,
                  customer_id     TEXT,
                        total_amount    REAL    NOT NULL,
                              status          TEXT    DEFAULT 'pending',
                                    shipping_address TEXT,
                                          created_at      TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
                                              )
                                                `);

  _db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
            id          TEXT    PRIMARY KEY,
                  order_id    TEXT    NOT NULL,
                        product_id  TEXT    NOT NULL,
                              variant_id  TEXT,
                                    quantity    INTEGER NOT NULL,
                                          price       REAL    NOT NULL,
                                                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                                                      FOREIGN KEY (product_id) REFERENCES products(id)
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

  // Migrations (ALTER TABLE)
  try {
        _db.run(`ALTER TABLE products ADD COLUMN brand TEXT`);
  } catch (e) {
        if (!e.message?.includes('duplicate column name')) throw e;
  }

  try {
        _db.run(`ALTER TABLE orders ADD COLUMN razorpay_order_id TEXT`);
  } catch (e) {
        if (!e.message?.includes('duplicate column name')) throw e;
  }

  try {
        _db.run(`ALTER TABLE orders ADD COLUMN razorpay_payment_id TEXT`);
  } catch (e) {
        if (!e.message?.includes('duplicate column name')) throw e;
  }

  try {
        _db.run(`ALTER TABLE orders ADD COLUMN customer_email TEXT`);
  } catch (e) {
        if (!e.message?.includes('duplicate column name')) throw e;
  }

  persist();
    console.log('Database ready');
    return _db;
}

function persist() {
    if (!_db) return;
    const data = _db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}

module.exports = {
    initDb,
    getDb: () => _db,
    persist,
    prepare: (sql) => {
          return {
                  run: (...params) => {
                            const result = _db.run(sql, params);
                            persist();
                            return result;
                  },
                  get: (...params) => {
                            const stmt = _db.prepare(sql);
                            const result = stmt.getAsObject(params);
                            stmt.free();
                            return Object.keys(result).length > 0 ? result : undefined;
                  },
                  all: (...params) => {
                            const stmt = _db.prepare(sql);
                            const results = [];
                            while (stmt.step()) {
                                        results.push(stmt.getAsObject(params));
                            }
                            stmt.free();
                            return results;
                  }
          };
    }
};
