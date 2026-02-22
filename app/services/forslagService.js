const db = require("../db/database")

module.exports = {
    getAktiveForslagFraDB: async (user_id, status) => {
        const query = `SELECT
                        o.lemma_id,
                        o.oppslag,
                        o.boy_tabell,
                        COALESCE(
                            (SELECT JSON_AGG(JSON_BUILD_OBJECT(
                                'def_id', d.def_id,
                                'prioritet', d.prioritet,
                                'definisjon', d.definisjon
                            ) ORDER BY d.prioritet)
                            FROM definisjon AS d WHERE d.lemma_id = o.lemma_id),
                            '[]'::json
                        ) AS definisjoner,
                        JSON_AGG(JSON_BUILD_OBJECT(
                            'forslag_id', f.forslag_id,
                            'forslag_definisjon', f.forslag_definisjon,
                            'prioritet', f.prioritet,
                            'brukernavn', b.brukernavn,
                            'user_id', b.user_id,
                            'status', f.status,
                            'opprettet', f.opprettet,
                            'godkjent_avvist', f.godkjent_avvist,
                            'endret', f.endret,
                            'upvotes', COALESCE((SELECT COUNT(*) FROM stemmer s WHERE s.forslag_id = f.forslag_id AND s.type = 1), 0),
                            'downvotes', COALESCE((SELECT COUNT(*) FROM stemmer s WHERE s.forslag_id = f.forslag_id AND s.type = 0), 0),
                            'minstemme', (SELECT s.type FROM stemmer s WHERE s.user_id = $1 AND s.forslag_id = f.forslag_id),
                            'antall_kommentarer', (SELECT COUNT(*) FROM forslag_kommentarer fk WHERE fk.forslag_id = f.forslag_id),
                            'sett', (CASE WHEN
                                (SELECT COUNT(*) FROM forslag_kommentarer fk WHERE fk.forslag_id = f.forslag_id) >
                                (SELECT COUNT(*) FROM forslag_kommentarer_sett fks
                                 INNER JOIN forslag_kommentarer fk USING(forslag_kommentar_id)
                                 WHERE fks.user_id = $2 AND fk.forslag_id = f.forslag_id)
                            THEN 0 ELSE 1 END)
                        ) ORDER BY f.prioritet, f.opprettet) AS forslag
                        FROM forslag AS f
                        INNER JOIN oppslag AS o USING (lemma_id)
                        INNER JOIN brukere AS b USING (user_id)
                        WHERE f.status = $3
                        GROUP BY o.lemma_id, o.oppslag, o.boy_tabell`
        try {
            const forslag = await db.query(query, [user_id, user_id, status])
            return forslag
        } catch (error) {
            throw error
        }
    },
    getMyForslagFromDB: async (user_id) => {

        const query = `SELECT f.forslag_id, o.lemma_id, o.oppslag, o.boy_tabell, f.forslag_definisjon,
                        b.brukernavn, b.user_id, f.status, f.opprettet, f.godkjent_avvist, f.endret,
                        COALESCE(SUM(CASE WHEN s.type = 1 THEN 1 ELSE 0 END),0) AS upvotes, COALESCE(SUM(CASE WHEN s.type = 0 THEN 1 ELSE 0 END), 0) AS downvotes,
                        (SELECT type FROM stemmer WHERE user_id = $1 AND forslag_id = f.forslag_id) AS minstemme,
                        (SELECT COUNT(forslag_id) FROM forslag_kommentarer WHERE forslag_id = f.forslag_id) AS antall_kommentarer,
                        (CASE WHEN (SELECT COUNT(lemma_id) FROM definisjon WHERE lemma_id = o.lemma_id) > 0 THEN 1 ELSE 0 END) AS eksisterende_definisjoner,
                        (CASE WHEN
                            (SELECT COUNT(*)
                                FROM forslag_kommentarer AS fk
                                WHERE fk.forslag_id = f.forslag_id
                            ) >
                            (SELECT COUNT(*)
                                FROM forslag_kommentarer_sett AS fks
                                INNER JOIN forslag_kommentarer AS fk USING(forslag_kommentar_id)
                                WHERE fks.user_id = $2
                                AND fk.forslag_id = f.forslag_id
                            ) THEN 0 ELSE 1 END) AS sett
                        FROM forslag AS f
                        INNER JOIN oppslag AS o USING (lemma_id)
                        INNER JOIN brukere AS b USING (user_id)
                        LEFT OUTER JOIN stemmer AS s USING (forslag_id)
                        WHERE f.user_id = $3
                        GROUP BY f.forslag_id, o.lemma_id, o.oppslag, o.boy_tabell,
                                 b.brukernavn, b.user_id, f.status, f.opprettet, f.godkjent_avvist, f.endret`
        try {
            const forslag = await db.query(query, [user_id, user_id, user_id])
            return forslag
        } catch (error) {
            throw error
        }
    },
    hentEnkeltForslagFraDB: async (forslag_id) => {
        const query = `SELECT f.forslag_id, o.lemma_id, o.oppslag, o.boy_tabell,
                        f.forslag_definisjon, b.brukernavn, b.user_id, f.opprettet, f.status,
                        (SELECT COALESCE(
                            (SELECT JSON_AGG(
                            JSON_BUILD_OBJECT('def_id', d.def_id,
                                        'lemma_id', d.lemma_id,
                                        'prioritet', d.prioritet,
                                        'definisjon', d.definisjon
                                        ))
                            FROM definisjon AS d
                            WHERE o.lemma_id = d.lemma_id),
                            '[]'::json)
                            ) AS eksisterende_definisjoner
                        FROM forslag AS f
                        INNER JOIN brukere AS b USING (user_id)
                        INNER JOIN oppslag AS o USING (lemma_id)
                        WHERE f.forslag_id = $1`
        try {
            const forslag = await db.query(query, [forslag_id])
            return forslag[0]
        } catch (error) {
            throw error
        }
    },
    settInnStemmeDB: async (forslag_id, user_id, type) => {
        const query = `INSERT INTO stemmer (forslag_id, user_id, type)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (forslag_id, user_id) DO UPDATE
                        SET type = EXCLUDED.type
                        `
        try {
            await db.query(query, [forslag_id, user_id, type])

        } catch (error) {
            throw error
        }
    },
    slettStemmeFraDB: async (forslag_id, user_id) => {
        const query = `DELETE FROM stemmer
                        WHERE forslag_id = $1
                        AND user_id = $2`
        try {
            await db.query(query, [forslag_id, user_id])

        } catch (error) {
            throw error
        }
    },
    hentAntallStemmerPaaForslagFraDB: async (forslag_id) => {
        const query = `SELECT COALESCE(SUM(CASE WHEN s.type = 1 THEN 1 ELSE 0 END),0) AS upvotes,
                        COALESCE(SUM(CASE WHEN s.type = 0 THEN 1 ELSE 0 END),0) AS downvotes
                        FROM stemmer AS s
                        WHERE forslag_id = $1`
        try {
            const stemmer = await db.query(query, [forslag_id])
            return stemmer[0]
        } catch (error) {
            throw error
        }
    },
    hentForslagseierFraDB: async (forslag_id) => {
        const query = `SELECT user_id, status FROM forslag
                        WHERE forslag_id = $1`
        try {
            const forslagseier = await db.query(query, [forslag_id])
            return forslagseier[0]
        } catch (error) {
            throw error
        }
    },
    hentStemmerFraBruker: async (forslag_id, user_id) => {
        try {
            let query = `SELECT s.stemme_id, s.type
                        FROM stemmer AS s
                        WHERE s.forslag_id = $1
                        AND s.user_id = $2
                        `
            const stemmer = await db.query(query, [forslag_id, user_id])
            return stemmer

        } catch (error) {
            throw error
        }
    },
    slettForslagFraDB: async (forslag_id, user_id) => {
        try {
            let query1 = `DELETE FROM forslag
                        WHERE forslag_id = $1
                        AND user_id = $2`
            await db.query(query1, [forslag_id, user_id])

            const query2 = `DELETE FROM stemmer
                          WHERE forslag_id = $1`
            await db.query(query2, [forslag_id])

        } catch (error) {
            throw error
        }
    },
    leggForslagTilDB: async (lemma_id, user_id, forslag, prioritet = 1) => {
        try {
            const query = `INSERT INTO forslag (lemma_id, user_id, forslag_definisjon, prioritet)
                            VALUES ($1, $2, $3, $4)
                            RETURNING forslag_id`
            const result = await db.query(query, [lemma_id, user_id, forslag, prioritet])
            return result[0].forslag_id

        } catch (error) {
            throw error
        }
    },
    gjorForslagTilDefinisjonDB: async (forslag_id, redigert_forslag = null) => {
        try {
            const query1 = `SELECT forslag_id, lemma_id, forslag_definisjon, user_id
                          FROM forslag
                          WHERE forslag_id = $1`
            let forslag = await db.query(query1, [forslag_id])
            forslag = forslag[0]
            if (redigert_forslag) {
                forslag.forslag_definisjon = redigert_forslag
                const query2 = `UPDATE forslag SET forslag_definisjon = $1
                                WHERE forslag_id = $2`
                await db.query(query2, [redigert_forslag, forslag_id])
            }
            const query3 = `SELECT COALESCE(MAX(prioritet), 0) AS max_pri FROM definisjon WHERE lemma_id = $1`
            let result = await db.query(query3, [forslag.lemma_id])

            const max_pri = result[0]['max_pri'] + 1
            const query4 = `INSERT INTO definisjon (lemma_id, prioritet, definisjon, oversatt_av)
                          VALUES ($1, $2, $3, $4)`
            await db.query(query4, [forslag.lemma_id, max_pri, forslag.forslag_definisjon, forslag.user_id])

        } catch (error) {
            throw error
        }
    },
    settStatusForslag: async (forslag_id, statuskode) => {
        try {
            const query = `UPDATE forslag
                            SET status = $1, godkjent_avvist = CURRENT_TIMESTAMP
                            WHERE forslag_id = $2`

            await db.query(query, [statuskode, forslag_id])

        } catch (error) {
            throw error
        }
    },
    hentForslagKommentarerFraDB: async (forslag_id) => {
        try {
            const query = `SELECT fk.forslag_kommentar_id, fk.forslag_id, b.brukernavn,
                            fk.opprettet, fk.kommentar
                            FROM forslag_kommentarer AS fk
                            INNER JOIN brukere AS b USING(user_id)
                            WHERE forslag_id = $1
                            ORDER BY fk.opprettet DESC
                           `

            const kommentarer = await db.query(query, [forslag_id])
            return kommentarer

        } catch (error) {
            throw error
        }
    },
    leggForslagKommentarTilDB: async (forslag_id, user_id, kommentar) => {
        try {
            const query = `INSERT INTO forslag_kommentarer (forslag_id, user_id, kommentar)
                            VALUES ($1, $2, $3)
                            RETURNING forslag_kommentar_id
                           `

            const result = await db.query(query, [forslag_id, user_id, kommentar])
            return result[0].forslag_kommentar_id

        } catch (error) {
            throw error
        }
    },
    endreForslagDB: async (forslag_id, user_id, redigert_forslag) => {
        try {
            const query = `UPDATE forslag
                            SET forslag_definisjon = $1, endret = 1
                            WHERE forslag_id = $2
                            AND user_id = $3
                           `
            await db.query(query, [redigert_forslag, forslag_id, user_id])

        } catch (error) {
            throw error
        }
    },
    nullstillStemmerDB: async (forslag_id, user_id) => {
        try {
            const query = `DELETE FROM stemmer
                            WHERE forslag_id = $1
                            AND forslag_id IN (SELECT forslag_id FROM forslag WHERE user_id = $2)
                           `
            await db.query(query, [forslag_id, user_id])

        } catch (error) {
            throw error
        }
    },
    settKommentarSomSettDB: async (kommentarer_sett) => {
        try {
            await db.bulkInsert(
                `INSERT INTO forslag_kommentarer_sett (forslag_kommentar_id, user_id)`,
                kommentarer_sett,
                2,
                `ON CONFLICT DO NOTHING`
            )

        } catch (error) {
            throw error
        }
    },
}
