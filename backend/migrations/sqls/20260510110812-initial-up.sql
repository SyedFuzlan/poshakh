CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT    NOT NULL,
  parent_id   INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  slug        TEXT    UNIQUE NOT NULL,
  description TEXT,
  position    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        TEXT    NOT NULL,
  description TEXT,
  price_paise INTEGER NOT NULL DEFAULT 0,
  compare_at_price_paise INTEGER,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  collection  TEXT    NOT NULL DEFAULT '',
  brand       TEXT,
  slug        TEXT    UNIQUE,
  meta_title  TEXT,
  meta_description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_images (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT    NOT NULL,
  alt_text    TEXT,
  position    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checkouts (
  id               TEXT PRIMARY KEY,
  customer_name    TEXT,
  customer_phone   TEXT,
  customer_email   TEXT,
  items_json       TEXT,
  total_paise      INTEGER,
  promo_code       TEXT,
  status           TEXT DEFAULT 'pending',
  last_notified_at TIMESTAMP,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_variants (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size       TEXT,
  color      TEXT,
  stock      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT UNIQUE,
  email         TEXT UNIQUE,
  email_verified INTEGER DEFAULT 0,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login    TIMESTAMP
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
  razorpay_payment_id TEXT UNIQUE,
  utr              TEXT UNIQUE,
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
  shipped_at       TIMESTAMP,
  courier_name     TEXT,
  tracking_number  TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id   TEXT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  variant_id INTEGER,
  name       TEXT,
  quantity   INTEGER NOT NULL,
  price_paise INTEGER NOT NULL,
  size       TEXT,
  image      TEXT
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id          SERIAL PRIMARY KEY,
  order_id    TEXT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      TEXT    NOT NULL,
  comment     TEXT,
  admin_id    TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id          SERIAL PRIMARY KEY,
  variant_id  INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  change      INTEGER NOT NULL,
  reason      TEXT,
  order_id    TEXT,
  admin_id    TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         SERIAL PRIMARY KEY,
  admin_id   TEXT,
  action     TEXT    NOT NULL,
  details    TEXT,
  old_value  TEXT,
  new_value  TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id                 SERIAL PRIMARY KEY,
  code               TEXT    UNIQUE NOT NULL,
  type               TEXT    NOT NULL,
  value              REAL    NOT NULL,
  min_purchase_paise INTEGER DEFAULT 0,
  expiry_date        TIMESTAMP,
  usage_limit        INTEGER DEFAULT 0,
  times_used         INTEGER DEFAULT 0,
  is_active          INTEGER DEFAULT 1,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  customer_id TEXT    NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          SERIAL PRIMARY KEY,
  customer_id TEXT    NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  customer_id TEXT    NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categories (name, slug) VALUES ('Uncategorized', 'uncategorized');