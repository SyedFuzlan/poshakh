-- Soft Deletes
ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE categories ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE product_variants ADD COLUMN deleted_at TIMESTAMP;

-- Webhook Idempotency
CREATE TABLE processed_webhooks (
  id SERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for soft deletes
CREATE INDEX idx_products_deleted_at ON products(deleted_at);
CREATE INDEX idx_categories_deleted_at ON categories(deleted_at);
CREATE INDEX idx_customers_deleted_at ON customers(deleted_at);
CREATE INDEX idx_product_variants_deleted_at ON product_variants(deleted_at);
