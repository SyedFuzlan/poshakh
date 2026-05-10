-- Convert email_verified from INTEGER to BOOLEAN for idiomatic PostgreSQL usage.
-- DROP DEFAULT is required because the integer default cannot be automatically cast.
-- USING clause converts 0 -> false, any non-zero -> true.
ALTER TABLE customers
  ALTER COLUMN email_verified DROP DEFAULT,
  ALTER COLUMN email_verified TYPE BOOLEAN USING (email_verified::boolean),
  ALTER COLUMN email_verified SET DEFAULT FALSE;
