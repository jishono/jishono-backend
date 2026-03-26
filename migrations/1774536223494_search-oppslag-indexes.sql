-- Up Migration
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX oppslag_oppslag_trgm_idx ON oppslag USING gin (oppslag gin_trgm_ops);

CREATE INDEX subst_boy_lemma_id_idx ON subst_boy (lemma_id);

-- Down Migration
DROP INDEX IF EXISTS oppslag_oppslag_trgm_idx;

DROP INDEX IF EXISTS subst_boy_lemma_id_idx;