-- Up Migration

-- Change all ON DELETE RESTRICT foreign keys referencing oppslag(lemma_id) to ON DELETE CASCADE,
-- so that deleting an oppslag row automatically removes all dependent rows.

ALTER TABLE definisjon
    DROP CONSTRAINT definisjon_lemma_id_fkey,
    ADD CONSTRAINT definisjon_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE uttale
    DROP CONSTRAINT uttale_lemma_id_fkey,
    ADD CONSTRAINT uttale_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON DELETE CASCADE;

ALTER TABLE alle_boyninger
    DROP CONSTRAINT alle_boyninger_lemma_id_fkey,
    ADD CONSTRAINT alle_boyninger_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON DELETE CASCADE;

ALTER TABLE subst_boy
    DROP CONSTRAINT subst_boy_lemma_id_fkey,
    ADD CONSTRAINT subst_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE verb_boy
    DROP CONSTRAINT verb_boy_lemma_id_fkey,
    ADD CONSTRAINT verb_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE adj_boy
    DROP CONSTRAINT adj_boy_lemma_id_fkey,
    ADD CONSTRAINT adj_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE adv_boy
    DROP CONSTRAINT adv_boy_lemma_id_fkey,
    ADD CONSTRAINT adv_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE det_boy
    DROP CONSTRAINT det_boy_lemma_id_fkey,
    ADD CONSTRAINT det_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE pron_boy
    DROP CONSTRAINT pron_boy_lemma_id_fkey,
    ADD CONSTRAINT pron_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE forslag
    DROP CONSTRAINT forslag_lemma_id_fkey,
    ADD CONSTRAINT forslag_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON DELETE CASCADE;

ALTER TABLE feedback
    DROP CONSTRAINT feedback_lemma_id_fkey,
    ADD CONSTRAINT feedback_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON DELETE CASCADE;

-- Down Migration

ALTER TABLE definisjon
    DROP CONSTRAINT definisjon_lemma_id_fkey,
    ADD CONSTRAINT definisjon_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE uttale
    DROP CONSTRAINT uttale_lemma_id_fkey,
    ADD CONSTRAINT uttale_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id);

ALTER TABLE alle_boyninger
    DROP CONSTRAINT alle_boyninger_lemma_id_fkey,
    ADD CONSTRAINT alle_boyninger_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id);

ALTER TABLE subst_boy
    DROP CONSTRAINT subst_boy_lemma_id_fkey,
    ADD CONSTRAINT subst_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE verb_boy
    DROP CONSTRAINT verb_boy_lemma_id_fkey,
    ADD CONSTRAINT verb_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE adj_boy
    DROP CONSTRAINT adj_boy_lemma_id_fkey,
    ADD CONSTRAINT adj_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE adv_boy
    DROP CONSTRAINT adv_boy_lemma_id_fkey,
    ADD CONSTRAINT adv_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE det_boy
    DROP CONSTRAINT det_boy_lemma_id_fkey,
    ADD CONSTRAINT det_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE pron_boy
    DROP CONSTRAINT pron_boy_lemma_id_fkey,
    ADD CONSTRAINT pron_boy_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE forslag
    DROP CONSTRAINT forslag_lemma_id_fkey,
    ADD CONSTRAINT forslag_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id);

ALTER TABLE feedback
    DROP CONSTRAINT feedback_lemma_id_fkey,
    ADD CONSTRAINT feedback_lemma_id_fkey
        FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id);
