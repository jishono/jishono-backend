-- Up Migration
CREATE TABLE eksempler_no_oppslag (
    eksempler_no_id INTEGER NOT NULL REFERENCES eksempler_no(no_id) ON DELETE CASCADE,
    lemma_id        INTEGER NOT NULL REFERENCES oppslag(lemma_id) ON DELETE CASCADE,
    PRIMARY KEY (eksempler_no_id, lemma_id)
);
CREATE INDEX eksempler_no_oppslag_lemma_id_idx ON eksempler_no_oppslag (lemma_id);

-- Down Migration
DROP TABLE eksempler_no_oppslag;
