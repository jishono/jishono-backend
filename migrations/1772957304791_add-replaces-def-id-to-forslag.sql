-- Up Migration
ALTER TABLE forslag ADD COLUMN replaces_def_id integer;
ALTER TABLE forslag ADD CONSTRAINT forslag_replaces_def_id_fkey
  FOREIGN KEY (replaces_def_id) REFERENCES definisjon(def_id) ON DELETE SET NULL;

-- Down Migration
ALTER TABLE forslag DROP CONSTRAINT IF EXISTS forslag_replaces_def_id_fkey;
ALTER TABLE forslag DROP COLUMN IF EXISTS replaces_def_id;
