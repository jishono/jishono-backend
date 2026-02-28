const db = require("../db/database")

module.exports = {
    hentAlleDefinisjonerPaaOppslag: async (lemma_id) => {
        const query = `SELECT definisjon FROM definisjon
                        WHERE lemma_id = $1`
        try {
            const definisjoner = await db.query(query, [lemma_id])
            return definisjoner
        } catch (error) {
            throw error
        }
    },
    hentOppslagFraDB: async (lemma_id, user_id) => {
        try {
            const query = `SELECT o.lemma_id, o.oppslag, o.ledd, o.boy_tabell, o.skjult,
                            (SELECT COALESCE(
                                (SELECT JSON_AGG(
                                JSON_BUILD_OBJECT('def_id', d.def_id,
                                            'lemma_id', d.lemma_id,
                                            'prioritet', d.prioritet,
                                            'definisjon', d.definisjon,
                                            'brukernavn', (SELECT b.brukernavn FROM brukere b WHERE b.user_id = d.oversatt_av)
                                            ))
                                FROM definisjon AS d
                                WHERE o.lemma_id = d.lemma_id),
                                '[]'::json)
                                ) AS definisjon,
                            (SELECT COALESCE(
                                (SELECT JSON_AGG(
                                JSON_BUILD_OBJECT('uttale_id',u.uttale_id,
                                            'lemma_id', u.lemma_id,
                                            'transkripsjon', u.transkripsjon
                                            ))
                                FROM uttale AS u
                                WHERE u.lemma_id = o.lemma_id),
                                '[]'::json)
                                ) AS uttale,
                            (SELECT COUNT(*) FROM oppslag_kommentarer ok WHERE ok.lemma_id = o.lemma_id) AS antall_kommentarer,
                            (CASE WHEN
                                (SELECT COUNT(*) FROM oppslag_kommentarer ok WHERE ok.lemma_id = o.lemma_id) >
                                (SELECT COUNT(*) FROM oppslag_kommentarer_sett oks
                                 INNER JOIN oppslag_kommentarer ok USING(oppslag_kommentar_id)
                                 WHERE oks.user_id = $2 AND ok.lemma_id = o.lemma_id)
                            THEN 0 ELSE 1 END) AS sett,
                            (SELECT COALESCE(
                                (SELECT JSON_AGG(JSON_BUILD_OBJECT(
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
                                    'minstemme', (SELECT s.type FROM stemmer s WHERE s.user_id = $2 AND s.forslag_id = f.forslag_id)
                                ) ORDER BY f.prioritet, f.opprettet)
                                FROM forslag AS f
                                INNER JOIN brukere AS b USING (user_id)
                                WHERE f.lemma_id = o.lemma_id),
                                '[]'::json)
                                ) AS forslag
                            FROM oppslag AS o
                            WHERE o.lemma_id = $1`

            const oppslag = await db.query(query, [lemma_id, user_id])
            return oppslag
        } catch (error) {
            throw error
        }
    },

    getAllItemsFromDB: async () => {
        const query = `
            WITH oppslag_def AS (SELECT * FROM oppslag AS o WHERE o.lemma_id IN (SELECT lemma_id FROM definisjon))
            SELECT
                od.lemma_id,
                od.oppslag,
                od.ledd,
                od.boy_tabell,
                COALESCE(
                    (SELECT JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'def_id', d.def_id,
                            'prioritet', d.prioritet,
                            'definisjon', d.definisjon,
                            'wiki', CASE WHEN d.oversatt_av = 0 THEN 1 ELSE 0 END
                        )
                    )
                    FROM definisjon AS d
                    WHERE od.lemma_id = d.lemma_id),
                '[]'::json) AS definisjoner,
                COALESCE(
                    (SELECT JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'uttale_id', u.uttale_id,
                            'transkripsjon', u.transkripsjon
                        )
                    )
                    FROM uttale AS u
                    WHERE u.lemma_id = od.lemma_id),
                '[]'::json) AS uttale,
                COALESCE(
                    (SELECT JSON_AGG(b.pos)
                    FROM subst_boy AS b
                    WHERE b.lemma_id = od.lemma_id),
                '[]'::json) AS pos,
                COALESCE(
                    (SELECT JSON_AGG(oppslag)
                    FROM relaterte_oppslag AS ro
                    WHERE ro.lemma_id = od.lemma_id),
                '[]'::json) AS relatert
            FROM oppslag_def AS od;
            `

        const results = db.query(query)

        return results
    },

    getSuggestionListFromDB: async (searchWord) => {
        const query = `
        SELECT DISTINCT o.oppslag
        FROM alle_boyninger AS ab
        INNER JOIN oppslag AS o ON ab.lemma_id = o.lemma_id
        WHERE ab.boyning = $1
        AND o.oppslag != $2
        AND ab.lemma_id IN (SELECT lemma_id FROM definisjon);
    `;
    const results = await db.query(query, [searchWord, searchWord]);

        return results
    },

    generateRelatedWords: async () => {
        const query = `SELECT o.lemma_id, o.oppslag, (SELECT COALESCE(
                            (SELECT JSON_AGG(ab.boyning)
                            FROM alle_boyninger AS ab
                            WHERE ab.lemma_id = o.lemma_id),
                                '[]'::json)) AS boyninger

                        FROM oppslag AS o
                        WHERE lemma_id in (SELECT lemma_id FROM definisjon )
                        `

        const results = await db.query(query)
        let inserts = []

        for (row of results) {
            if (row.oppslag.indexOf(' ') >= 0) {
                const splits = row.oppslag.split(' ')
                for (split of splits) {
                    inserts.push([row.lemma_id, split])
                }
            }
            for (row2 of results) {
                const regex = new RegExp('(?<![A-Za-zÆæØøÅå])' + row.oppslag + '(?![A-Za-zÆæØøÅå])')
                if (row2.oppslag.match(regex)) {
                    if (row2.oppslag != row.oppslag) {
                        const insertArray = [row.lemma_id, row2.oppslag]
                        inserts.push(insertArray)
                    }
                }
            }
        }

        await db.query(`DROP TABLE IF EXISTS relaterte_oppslag`)
        await db.query(`CREATE TABLE relaterte_oppslag (
                            relatert_id SERIAL PRIMARY KEY,
                            lemma_id INTEGER NOT NULL,
                            oppslag VARCHAR(50) NOT NULL,
                            FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id)
                        )`)

        if (inserts.length > 0) {
            await db.bulkInsert(
                `INSERT INTO relaterte_oppslag (lemma_id, oppslag)`,
                inserts,
                2
            )
        }

    },

    sokOppslagMedQuery: async (query_string) => {
        const q = query_string.q
        let meddef = (query_string.meddef == "true");
        let utendef = (query_string.utendef == "true");
        if (meddef == true & utendef == true) {
            meddef = false; utendef = false;
        }
        let medut = (query_string.medut == "true");
        let utenut = (query_string.utenut == "true");
        if (medut == true & utenut == true) {
            medut = false; utenut = false;
        }
        let kun_skjult = (query_string.kun_skjult == "true");

        let kunwiki = (query_string.kunwiki == "true");
        let utenwiki = (query_string.utenwiki == "true");
        if (kunwiki == true & utenwiki == true) {
            kunwiki = false; utenwiki = false;
        }

        posarray = []
        pos_val = ["adj", "adv", "det", "egennavn", "forkorting",
            "interjeksjon", "konjunksjon", "prefiks", "preposisjon",
            "pron", "subst", "subjunksjon", "verb", "symbol"]
        pos_val.forEach(pos => {
            if (query_string[pos] == "true") {
                posarray.push(pos)
            }
        })
        let query = `SELECT *
                  FROM oppslag AS o
                  WHERE 1=1`

        let params = []
        let paramIndex = 1

        if (q) {
            query += ` AND o.oppslag LIKE $${paramIndex}`
            params.push(q + '%')
            paramIndex++
        }

        if (meddef) {
            query += ' AND o.lemma_id IN (SELECT lemma_id FROM definisjon)'
        }
        if (utendef) {
            query += ' AND o.lemma_id NOT IN (SELECT lemma_id FROM definisjon)'
        }

        if (medut) {
            query += ' AND o.lemma_id IN (SELECT lemma_id FROM uttale)'
        }
        if (utenut) {
            query += ' AND o.lemma_id NOT IN (SELECT lemma_id FROM uttale)'
        }

        if (kunwiki) {
            query += ' AND o.lemma_id IN (SELECT lemma_id FROM definisjon WHERE oversatt_av = 0)'
        }
        if (utenwiki) {
            query += ' AND o.lemma_id NOT IN (SELECT lemma_id FROM definisjon WHERE oversatt_av = 0)'
        }

        if (kun_skjult) {
            query += ' AND o.skjult = 1'
        } else {
            query += ' AND o.skjult = 0'
        }

        if (posarray.length > 0) {
            query += ` AND o.boy_tabell = ANY($${paramIndex})`
            params.push(posarray)
            paramIndex++
        }

        query += ` ORDER BY oppslag`
        try {
            const treff = await db.query(query, params)
            return treff
        } catch (error) {
            throw error
        }
    },

    searchByQuery: async (searchQuery) => {
        const query = `WITH oppslag_def AS (SELECT * FROM oppslag AS o WHERE o.lemma_id IN (SELECT lemma_id FROM definisjon))

                        SELECT od.lemma_id, od.oppslag, od.ledd, od.boy_tabell,
                            (SELECT COALESCE(
                                (SELECT JSON_AGG(
                                    JSON_BUILD_OBJECT('def_id', d.def_id,
                                        'prioritet', d.prioritet,
                                        'definisjon', d.definisjon
                                        ))
                                FROM definisjon AS d
                                WHERE od.lemma_id = d.lemma_id),
                            '[]'::json)
                            ) AS definisjoner,
                            (SELECT COALESCE(
                                (SELECT JSON_AGG(
                                    JSON_BUILD_OBJECT('uttale_id',u.uttale_id,
                                        'transkripsjon', u.transkripsjon
                                        ))
                                FROM uttale AS u
                                WHERE u.lemma_id = od.lemma_id),
                            '[]'::json)
                            ) AS uttale
                        FROM oppslag_def AS od
                        WHERE od.oppslag = $1
                        LIMIT 5`
        try {
            const results = await db.query(query, [searchQuery])
            return results
        } catch (error) {
            throw error
        }
    },

    getConjugationsFromDB: async (lemma_id, table) => {
        // NOTE: `table` must be a trusted, whitelisted identifier (see controller validation)
        const query = `SELECT * FROM ${table} WHERE lemma_id = $1 ORDER BY pos ASC`;
        try {
            const conjugations = await db.query(query, [lemma_id])
            return conjugations
        } catch (error) {
            throw error
        }
    },

    getFlatConjugationsFromDB: async (lemma_id) => {
        const query = `SELECT o.oppslag, string_agg(boyning, ',') AS conjugations
                        FROM alle_boyninger AS ab
                        RIGHT JOIN oppslag AS o USING(lemma_id)
                        WHERE lemma_id = $1
                        GROUP BY o.oppslag
                        `
        try {
            let conjugations = await db.query(query, [lemma_id])
            if (conjugations[0].conjugations) {
                conjugations = conjugations[0].conjugations.split(',')
            } else {
                conjugations = [conjugations[0].oppslag]
            }
            return conjugations
        } catch (error) {
            throw error
        }
    },

    getExampleSentencesFromDB: async (conjugations) => {
        let regex = '\\s(' + conjugations.join('|') + ')\\s'
        const query = `
            SELECT no.no_setning, ja.ja_setning
            FROM eksempler_no AS no
            LEFT JOIN eksempler_lenker AS l ON no.no_id = l.no_id
            LEFT JOIN eksempler_ja AS ja ON l.ja_id = ja.ja_id
            WHERE no.no_setning ~ $1
            ORDER BY ja.ja_setning DESC;
        `
        try {
            const conjugations = await db.query(query, [regex])
            return conjugations
        } catch (error) {
            throw error
        }
    },
    hentOppslagKommentarerFraDB: async (lemma_id) => {
        const query = `SELECT ok.oppslag_kommentar_id, ok.lemma_id, ok.opprettet,
                        ok.user_id, b.brukernavn, ok.kommentar
                        FROM oppslag_kommentarer AS ok
                        INNER JOIN brukere AS b USING(user_id)
                        WHERE lemma_id = $1
                        ORDER BY opprettet DESC`
        try {
            const kommentarer = await db.query(query, [lemma_id])
            return kommentarer
        } catch (error) {
            throw error
        }
    },
    settOppslagKommentarerSomSettDB: async (kommentarer_sett) => {
        try {
            await db.bulkInsert(
                `INSERT INTO oppslag_kommentarer_sett (oppslag_kommentar_id, user_id)`,
                kommentarer_sett,
                2,
                `ON CONFLICT DO NOTHING`
            )
        } catch (error) {
            throw error
        }
    },
    slettDefinisjonerFraDB: async (def_id_array) => {
        const query = `DELETE FROM definisjon
                        WHERE def_id = ANY($1)`
        try {
            await db.query(query, [def_id_array])
        } catch (error) {
            throw error
        }

    },
    slettUttaleFraDB: async (uttale_id_array) => {
        const query = `DELETE FROM uttale
                        WHERE uttale_id = ANY($1)`
        try {
            await db.query(query, [uttale_id_array])
        } catch (error) {
            throw error
        }

    },
    oppdaterOppslagDB: async (ledd, skjult, lemma_id) => {
        const query = `UPDATE oppslag
                        SET ledd = $1, skjult = $2, sist_endret = CURRENT_TIMESTAMP
                        WHERE lemma_id = $3`
        try {
            await db.query(query, [ledd, skjult, lemma_id])
        } catch (error) {
            throw error
        }

    },
    leggTilDefinisjonDB: async (def_array) => {
        await db.bulkInsert(
            `INSERT INTO definisjon (def_id, lemma_id, prioritet, definisjon, oversatt_av)`,
            def_array,
            5,
            `ON CONFLICT (def_id) DO UPDATE SET
                prioritet = EXCLUDED.prioritet,
                definisjon = EXCLUDED.definisjon,
                sist_endret = CURRENT_TIMESTAMP`
        )
    },
    leggTilUttaleDB: async (uttale_array) => {
        await db.bulkInsert(
            `INSERT INTO uttale (uttale_id, lemma_id, transkripsjon)`,
            uttale_array,
            3,
            `ON CONFLICT (uttale_id) DO UPDATE SET
                transkripsjon = EXCLUDED.transkripsjon`
        )
    },
    leggTilOppslagKommentarDB: async (lemma_id, user_id, ny_kommentar) => {
        try {
            const query = `INSERT INTO oppslag_kommentarer (lemma_id, user_id, kommentar)
                        VALUES ($1, $2, $3)`

            await db.query(query, [lemma_id, user_id, ny_kommentar])
        } catch (error) {
            throw error
        }
    },
    addWordSuggestionToDB: async (word, wordClass, parts, userID) => {
        const query = `INSERT INTO oppslag_forslag(oppslag, boy_tabell, ledd, user_id)
                        VALUES ($1, $2, $3, $4)`

        await db.query(query, [word, wordClass, parts, userID])
    },
    getAllWordSuggestionsFromDB: async () => {
        const query = `SELECT o.oppslag_forslag_id, o.oppslag, o.boy_tabell, o.ledd,
                        o.status, o.opprettet, b.brukernavn
                        FROM oppslag_forslag AS o
                        INNER JOIN brukere AS b USING (user_id)`

        const results = await db.query(query)
        return results
    },
    getWordSuggestionFromDB: async (wordID) => {
        const query = `SELECT o.oppslag_forslag_id, o.oppslag, o.boy_tabell, o.ledd, o.status,
                        o.opprettet, b.brukernavn
                        FROM oppslag_forslag AS o
                        INNER JOIN brukere AS b USING(user_id)
                        WHERE oppslag_forslag_id = $1`

        const result = await db.query(query, [wordID])
        return result[0]
    },
    addWordToDB: async (word, wordClass, parts) => {
        const query = `INSERT INTO oppslag (oppslag, boy_tabell, ledd)
                        VALUES ($1, $2, $3)
                        RETURNING lemma_id`

        const result = await db.query(query, [word, wordClass, parts])
        return result[0].lemma_id
    },
    setWordSuggestionsStatus: async (wordSuggestionID, status) => {
        const query = `UPDATE oppslag_forslag
                        SET status = $1
                        WHERE oppslag_forslag_id = $2`

        await db.query(query, [status, wordSuggestionID])
    },
    addConjugationToDB: async (wordID, insertTable, conjugations) => {
        for (const conjugation of conjugations) {
            conjugation['lemma_id'] = wordID
            const columns = Object.keys(conjugation)
            const values = Object.values(conjugation)
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
            const query = `INSERT INTO ${insertTable} (${columns.join(', ')}) VALUES (${placeholders})`
            await db.query(query, values)
        }
    }
}
