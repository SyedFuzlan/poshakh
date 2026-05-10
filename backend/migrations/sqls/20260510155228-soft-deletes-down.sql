DROP TABLE IF EXISTS processed_webhooks;
ALTER TABLE products DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE categories DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE customers DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE product_variants DROP COLUMN IF EXISTS deleted_at;
