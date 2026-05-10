-- Convert email_verified from INTEGER to BOOLEAN for idiomatic PostgreSQL usage.
-- USING clause converts 0 -> false, any non-zero -> true.
ALTER TABLE customers
  ALTER COLUMN email_verified TYPE BOOLEAN
  USING (email_verified::boolean);

ALTER TABLE customers
  ALTER COLUMN email_verified SET DEFAULT FALSE;
