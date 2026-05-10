-- Revert email_verified from BOOLEAN back to INTEGER.
ALTER TABLE customers
  ALTER COLUMN email_verified TYPE INTEGER
  USING (email_verified::integer);

ALTER TABLE customers
  ALTER COLUMN email_verified SET DEFAULT 0;
