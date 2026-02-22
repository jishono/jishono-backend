-- Up Migration

ALTER TABLE brukere ALTER COLUMN admin DROP DEFAULT;
ALTER TABLE brukere ALTER COLUMN admin TYPE boolean USING (admin = 1);
ALTER TABLE brukere ALTER COLUMN admin SET DEFAULT false;

-- Down Migration

ALTER TABLE brukere ALTER COLUMN admin DROP DEFAULT;
ALTER TABLE brukere ALTER COLUMN admin TYPE smallint USING (admin::int);
ALTER TABLE brukere ALTER COLUMN admin SET DEFAULT 0;
