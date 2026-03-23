-- Up Migration
-- Change all ON DELETE RESTRICT foreign keys referencing oppslag(lemma_id) to ON DELETE CASCADE,
-- so that deleting an oppslag row automatically removes all dependent rows.
ALTER TABLE
    relaterte_oppslag DROP CONSTRAINT relaterte_oppslag_lemma_id_fkey,
ADD
    CONSTRAINT relaterte_oppslag_lemma_id_fkey FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE CASCADE;

-- Down Migration