-- Add reserved_stock to product_variants
ALTER TABLE product_variants ADD COLUMN reserved_stock INTEGER NOT NULL DEFAULT 0;

-- Create inventory_reservations table
CREATE TABLE inventory_reservations (
  id SERIAL PRIMARY KEY,
  checkout_id TEXT NOT NULL,
  variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for cleanup task
CREATE INDEX idx_inventory_reservations_expires_at ON inventory_reservations(expires_at);
CREATE INDEX idx_inventory_reservations_checkout_id ON inventory_reservations(checkout_id);