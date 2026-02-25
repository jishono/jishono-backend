-- Up Migration

-- 1. Migrate comments: forslag_kommentarer → oppslag_kommentarer
INSERT INTO oppslag_kommentarer (lemma_id, user_id, kommentar, opprettet)
SELECT f.lemma_id, fk.user_id, fk.kommentar, fk.opprettet
FROM forslag_kommentarer AS fk
INNER JOIN forslag AS f USING (forslag_id);

-- 2. Create oppslag_kommentarer_sett (mirrors forslag_kommentarer_sett structure)
CREATE TABLE oppslag_kommentarer_sett (
    oppslag_kommentar_id integer NOT NULL REFERENCES oppslag_kommentarer (oppslag_kommentar_id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES brukere (user_id) ON DELETE CASCADE,
    sett_tidspunkt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (oppslag_kommentar_id, user_id)
);
CREATE INDEX oppslag_kommentarer_sett_user_id_idx
    ON oppslag_kommentarer_sett USING btree (user_id, oppslag_kommentar_id);

-- 3. Migrate seen-tracking: forslag_kommentarer_sett → oppslag_kommentarer_sett
--    Join through forslag_kommentarer → forslag → oppslag_kommentarer to map IDs
--    (matches on lemma_id + user_id + kommentar text + opprettet timestamp)
INSERT INTO oppslag_kommentarer_sett (oppslag_kommentar_id, user_id, sett_tidspunkt)
SELECT ok.oppslag_kommentar_id, fks.user_id, fks.sett_tidspunkt
FROM forslag_kommentarer_sett AS fks
INNER JOIN forslag_kommentarer AS fk USING (forslag_kommentar_id)
INNER JOIN forslag AS f USING (forslag_id)
INNER JOIN oppslag_kommentarer AS ok
    ON ok.lemma_id = f.lemma_id
    AND ok.user_id = fk.user_id
    AND ok.kommentar = fk.kommentar
    AND ok.opprettet = fk.opprettet
ON CONFLICT DO NOTHING;

-- Down Migration
