-- Up Migration
CREATE TABLE ai_approval (
    ai_approval_id SERIAL PRIMARY KEY,
    def_id INTEGER NOT NULL REFERENCES definisjon(def_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES brukere(user_id) ON DELETE CASCADE,
    opprettet TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (def_id, user_id)
);

CREATE INDEX ai_approval_def_id_idx ON ai_approval (def_id);

-- Down Migration
DROP TABLE IF EXISTS ai_approval;
DROP INDEX IF EXISTS ai_approval_def_id_idx;
