-- Up Migration
ALTER TABLE definisjon ADD COLUMN source varchar NOT NULL DEFAULT 'USER';

UPDATE definisjon SET source = 'WIKI' WHERE oversatt_av = 0;
UPDATE definisjon SET oversatt_av = NULL WHERE oversatt_av = 0;

ALTER TABLE definisjon
  ADD CONSTRAINT definisjon_oversatt_av_fkey
  FOREIGN KEY (oversatt_av) REFERENCES brukere(user_id);

-- Down Migration
ALTER TABLE definisjon DROP CONSTRAINT IF EXISTS definisjon_oversatt_av_fkey;

UPDATE definisjon SET oversatt_av = 0 WHERE source = 'WIKI';

ALTER TABLE definisjon DROP COLUMN source;
