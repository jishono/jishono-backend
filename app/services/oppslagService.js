const db = require("../db/database")
const { ALLOWED_BOY_TABLES, ALLOWED_BOY_COLUMNS } = require("../constants/boyning")

module.exports = {
    hentAlleDefinisjonerPaaOppslag: async (lemma_id) => {
        const query = `SELECT definisjon FROM definisjon
                        WHERE lemma_id = $1`
        const definisjoner = await db.query(query, [lemma_id])
        return definisjoner
    },
    hentOppslagFraDB: async (lemma_id, user_id) => {
        const query = `SELECT o.lemma_id, o.oppslag, o.ledd, o.boy_tabell, o.is_hidden,
                            (SELECT COALESCE(
                                (SELECT JSON_AGG(
                                JSON_BUILD_OBJECT('def_id', d.def_id,
                                            'lemma_id', d.lemma_id,
                                            'prioritet', d.prioritet,
                                            'definisjon', d.definisjon,
                                            'source', d.source,
                                            'brukernavn', (SELECT b.brukernavn FROM brukere b WHERE b.user_id = d.oversatt_av),
                                            'ai_approvals', COALESCE(
                                                (SELECT JSON_AGG(JSON_BUILD_OBJECT(
                                                    'user_id', b2.user_id,
                                                    'username', b2.brukernavn
                                                ))
                                                FROM ai_approval a
                                                INNER JOIN brukere b2 USING (user_id)
                                                WHERE a.def_id = d.def_id),
                                                '[]'::json
                                            )
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
                                    'minstemme', (SELECT s.type FROM stemmer s WHERE s.user_id = $2 AND s.forslag_id = f.forslag_id),
                                    'replaces_def_id', f.replaces_def_id
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
    },

    searchOppslag: async (q) => {
        const params = []
        let filterClause = ''
        let orderClause = ''
        if (q) {
            params.push(`%${q}%`)
            params.push(q)
            filterClause = ` AND o.oppslag ILIKE $1`
            orderClause = `
            ORDER BY
                CASE
                    WHEN od.oppslag ILIKE $2 THEN 0
                    WHEN od.oppslag ILIKE $2 || '%' THEN 1
                    ELSE 2
                END,
                LENGTH(od.oppslag),
                od.oppslag`
        }
        const query = `
            WITH oppslag_def AS (SELECT * FROM oppslag AS o WHERE o.lemma_id IN (SELECT lemma_id FROM definisjon) AND o.is_hidden = false${filterClause})
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
                            'source', d.source,
                            'ai_approvals', CASE WHEN d.source = 'AI' THEN (
                                SELECT COUNT(*) FROM ai_approval AS aa WHERE aa.def_id = d.def_id
                            ) ELSE NULL END
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
                '[]'::json) AS relatert,
                EXISTS (
                    SELECT 1 FROM eksempler_no_oppslag AS eo
                    WHERE eo.lemma_id = od.lemma_id
                ) AS has_examples
            FROM oppslag_def AS od${orderClause};
            `

        const results = db.query(query, params)

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
        console.log('[generateRelatedWords] Starting...')
        const query = `SELECT o.lemma_id, o.oppslag, (SELECT COALESCE(
                            (SELECT JSON_AGG(ab.boyning)
                            FROM alle_boyninger AS ab
                            WHERE ab.lemma_id = o.lemma_id),
                                '[]'::json)) AS boyninger

                        FROM oppslag AS o
                        WHERE lemma_id in (SELECT lemma_id FROM definisjon )
                        `

        const results = await db.query(query)
        console.log(`[generateRelatedWords] Fetched ${results.length} oppslag, building relations...`)
        let inserts = []

        for (let i = 0; i < results.length; i++) {
            const row = results[i]
            if (row.oppslag.indexOf(' ') >= 0) {
                const splits = row.oppslag.split(' ')
                for (const split of splits) {
                    inserts.push([row.lemma_id, split])
                }
            }
            for (const row2 of results) {
                const escapedOppslag = row.oppslag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                const regex = new RegExp('(?<![A-Za-zÆæØøÅå])' + escapedOppslag + '(?![A-Za-zÆæØøÅå])')
                if (row2.oppslag.match(regex)) {
                    if (row2.oppslag != row.oppslag) {
                        const insertArray = [row.lemma_id, row2.oppslag]
                        inserts.push(insertArray)
                    }
                }
            }
            if ((i + 1) % 1000 === 0) {
                console.log(`[generateRelatedWords] Processed ${i + 1}/${results.length} oppslag (${inserts.length} relations so far)`)
            }
        }

        console.log(`[generateRelatedWords] Done processing. ${inserts.length} relations found. Rebuilding table...`)
        await db.query(`DROP TABLE IF EXISTS relaterte_oppslag`)
        await db.query(`CREATE TABLE relaterte_oppslag (
                            relatert_id SERIAL PRIMARY KEY,
                            lemma_id INTEGER NOT NULL,
                            oppslag VARCHAR(255) NOT NULL,
                            FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id)
                        )`)

        if (inserts.length > 0) {
            await db.bulkInsert(
                `INSERT INTO relaterte_oppslag (lemma_id, oppslag)`,
                inserts,
                2
            )
        }

        console.log('[generateRelatedWords] Complete.')
    },

    sokOppslagMedQuery: async (query_string) => {
        const q = query_string.q
        let meddef = (query_string.meddef == "true");
        let utendef = (query_string.utendef == "true");
        if (meddef == true && utendef == true) {
            meddef = false; utendef = false;
        }
        let medut = (query_string.medut == "true");
        let utenut = (query_string.utenut == "true");
        if (medut == true && utenut == true) {
            medut = false; utenut = false;
        }
        let kun_skjult = (query_string.kun_skjult == "true");

        let kunwiki = (query_string.kunwiki == "true");
        let utenwiki = (query_string.utenwiki == "true");
        if (kunwiki == true && utenwiki == true) {
            kunwiki = false; utenwiki = false;
        }

        let med_ai = (query_string.med_ai == "true");
        let uten_ai = (query_string.uten_ai == "true");
        if (med_ai == true && uten_ai == true) {
            med_ai = false; uten_ai = false;
        }

        const posarray = []
        const pos_val = ["adj", "adv", "det", "egennavn", "forkorting",
            "interjeksjon", "konjunksjon", "prefiks", "preposisjon",
            "pron", "subst", "subjunksjon", "uttrykk", "verb", "symbol"]
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
            query += " AND o.lemma_id IN (SELECT lemma_id FROM definisjon WHERE source = 'WIKI')"
        }
        if (utenwiki) {
            query += " AND o.lemma_id NOT IN (SELECT lemma_id FROM definisjon WHERE source = 'WIKI')"
        }

        if (med_ai) {
            query += " AND o.lemma_id IN (SELECT lemma_id FROM definisjon WHERE source NOT IN ('WIKI', 'USER'))"
        }
        if (uten_ai) {
            query += " AND o.lemma_id NOT IN (SELECT lemma_id FROM definisjon WHERE source NOT IN ('WIKI', 'USER'))"
        }

        if (kun_skjult) {
            query += ' AND o.is_hidden = true'
        } else {
            query += ' AND o.is_hidden = false'
        }

        if (posarray.length > 0) {
            query += ` AND o.boy_tabell = ANY($${paramIndex})`
            params.push(posarray)
            paramIndex++
        }

        query += ` ORDER BY oppslag`
        const treff = await db.query(query, params)
        return treff
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
        const results = await db.query(query, [searchQuery])
        return results
    },

    getConjugationsFromDB: async (lemma_id, table) => {
        // NOTE: `table` must be a trusted, whitelisted identifier (see controller validation)
        const query = `SELECT * FROM ${table} WHERE lemma_id = $1 ORDER BY pos ASC`;
        const conjugations = await db.query(query, [lemma_id])
        return conjugations
    },

    getFlatConjugationsFromDB: async (lemma_id) => {
        const query = `SELECT o.oppslag, string_agg(boyning, ',') AS conjugations
                        FROM alle_boyninger AS ab
                        RIGHT JOIN oppslag AS o USING(lemma_id)
                        WHERE lemma_id = $1
                        GROUP BY o.oppslag
                        `
        let conjugations = await db.query(query, [lemma_id])
        if (!conjugations[0]) return []
        if (conjugations[0].conjugations) {
            conjugations = conjugations[0].conjugations.split(',')
        } else {
            conjugations = [conjugations[0].oppslag]
        }
        return conjugations
    },

    getExampleSentencesFromDB: async (lemma_id) => {
        const query = `
            SELECT no.no_setning, ja.ja_setning
            FROM eksempler_no_oppslag AS eo
            JOIN eksempler_no AS no ON eo.eksempler_no_id = no.no_id
            LEFT JOIN eksempler_lenker AS l ON no.no_id = l.no_id
            LEFT JOIN eksempler_ja AS ja ON l.ja_id = ja.ja_id
            WHERE eo.lemma_id = $1
            ORDER BY (ja.ja_setning IS NULL), ja.ja_setning DESC;
        `
        return await db.query(query, [lemma_id])
    },
    hentOppslagKommentarerFraDB: async (lemma_id) => {
        const query = `SELECT ok.oppslag_kommentar_id, ok.lemma_id, ok.opprettet,
                        ok.user_id, b.brukernavn, ok.kommentar
                        FROM oppslag_kommentarer AS ok
                        INNER JOIN brukere AS b USING(user_id)
                        WHERE lemma_id = $1
                        ORDER BY opprettet DESC`
        const kommentarer = await db.query(query, [lemma_id])
        return kommentarer
    },
    settOppslagKommentarerSomSettDB: async (kommentarer_sett) => {
        await db.bulkInsert(
            `INSERT INTO oppslag_kommentarer_sett (oppslag_kommentar_id, user_id)`,
            kommentarer_sett,
            2,
            `ON CONFLICT DO NOTHING`
        )
    },
    writeDefinisjonToDB: async (lemma_id, definisjon, prioritet, user_id) => {
        const query = `INSERT INTO definisjon (lemma_id, definisjon, prioritet, oversatt_av)
                        VALUES ($1, $2, $3, $4)
                        RETURNING def_id`
        const result = await db.query(query, [lemma_id, definisjon, prioritet ?? 1, user_id])
        return result[0]
    },
    deleteDefinisjonInDB: async (def_id) => {
        const rows = await db.query(`DELETE FROM definisjon WHERE def_id = $1 RETURNING lemma_id`, [def_id])
        if (rows.length === 0) return
        const lemma_id = rows[0].lemma_id
        await db.query(`
            UPDATE definisjon SET prioritet = sub.new_prioritet, sist_endret = CURRENT_TIMESTAMP
            FROM (
                SELECT def_id, ROW_NUMBER() OVER (ORDER BY prioritet) AS new_prioritet
                FROM definisjon
                WHERE lemma_id = $1
            ) sub
            WHERE definisjon.def_id = sub.def_id
        `, [lemma_id])
    },
    reorderDefinisjonerInDB: async (def_ids) => {
        const priorities = def_ids.map((_, i) => i + 1)
        const query = `UPDATE definisjon SET prioritet = v.prioritet, sist_endret = CURRENT_TIMESTAMP
                        FROM unnest($1::int[], $2::int[]) AS v(def_id, prioritet)
                        WHERE definisjon.def_id = v.def_id`
        await db.query(query, [def_ids, priorities])
    },
    updateDefinisjonInDB: async (def_id, definisjon, prioritet) => {
        const query = `UPDATE definisjon
                        SET definisjon = $1, prioritet = $2, sist_endret = CURRENT_TIMESTAMP
                        WHERE def_id = $3`
        await db.query(query, [definisjon, prioritet, def_id])
    },
    oppdaterOppslagDB: async (ledd, is_hidden, lemma_id) => {
        const query = `UPDATE oppslag
                        SET ledd = $1, is_hidden = $2, sist_endret = CURRENT_TIMESTAMP
                        WHERE lemma_id = $3`
        await db.query(query, [ledd, !!is_hidden, lemma_id])
    },
    setUttaleForLemmaDB: async (lemma_id, uttale_array) => {
        await db.query('DELETE FROM uttale WHERE lemma_id = $1', [lemma_id])
        if (uttale_array.length > 0) {
            await db.bulkInsert(
                `INSERT INTO uttale (lemma_id, transkripsjon)`,
                uttale_array.map(ut => [lemma_id, ut.transkripsjon]),
                2,
                ''
            )
        }
    },
    leggTilOppslagKommentarDB: async (lemma_id, user_id, ny_kommentar) => {
        const query = `INSERT INTO oppslag_kommentarer (lemma_id, user_id, kommentar)
                        VALUES ($1, $2, $3)`
        await db.query(query, [lemma_id, user_id, ny_kommentar])
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
    getRandomAiTranslationsFromDB: async (user_id, batch = 50, hasApprovals = false) => {
        const approvalFilter = hasApprovals
            ? 'AND EXISTS (SELECT 1 FROM ai_approval aa3 WHERE aa3.def_id = d.def_id)'
            : ''
        const query = `
            SELECT o.lemma_id, o.oppslag, o.ledd, o.boy_tabell, o.is_hidden,
                (SELECT COALESCE(
                    (SELECT JSON_AGG(
                    JSON_BUILD_OBJECT('def_id', d.def_id,
                                'lemma_id', d.lemma_id,
                                'prioritet', d.prioritet,
                                'definisjon', d.definisjon,
                                'source', d.source,
                                'brukernavn', (SELECT b.brukernavn FROM brukere b WHERE b.user_id = d.oversatt_av),
                                'ai_approvals', COALESCE(
                                    (SELECT JSON_AGG(JSON_BUILD_OBJECT(
                                        'user_id', b2.user_id,
                                        'username', b2.brukernavn
                                    ))
                                    FROM ai_approval a
                                    INNER JOIN brukere b2 USING (user_id)
                                    WHERE a.def_id = d.def_id),
                                    '[]'::json
                                )
                                ))
                    FROM definisjon AS d
                    WHERE o.lemma_id = d.lemma_id),
                    '[]'::json)
                    ) AS definisjon
            FROM oppslag AS o
            WHERE o.lemma_id IN (
                SELECT d.lemma_id
                FROM definisjon d
                WHERE d.source = 'AI'
                  AND (SELECT COUNT(*) FROM ai_approval aa WHERE aa.def_id = d.def_id) < 2
                  AND NOT EXISTS (
                      SELECT 1 FROM ai_approval aa2
                      INNER JOIN definisjon d2 ON d2.def_id = aa2.def_id
                      WHERE d2.lemma_id = d.lemma_id AND aa2.user_id = $1
                  )
                  ${approvalFilter}
                ORDER BY RANDOM()
                LIMIT $2
            )
            AND o.is_hidden IS false
            AND NOT EXISTS (
                SELECT 1 FROM forslag f
                WHERE f.lemma_id = o.lemma_id AND f.status = 0
            )
            ORDER BY RANDOM()`
        return await db.query(query, [user_id, batch])
    },
    addConjugationToDB: async (wordID, insertTable, conjugations) => {
        if (!ALLOWED_BOY_TABLES.includes(insertTable)) {
            throw new Error(`Invalid conjugation table: ${insertTable}`)
        }
        const allowedColumns = ALLOWED_BOY_COLUMNS[insertTable]
        for (const conjugation of conjugations) {
            conjugation['lemma_id'] = wordID
            const columns = Object.keys(conjugation)
            const invalidColumn = columns.find(col => !allowedColumns.has(col))
            if (invalidColumn) {
                throw new Error(`Invalid column for ${insertTable}: ${invalidColumn}`)
            }
            const values = Object.values(conjugation)
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
            const query = `INSERT INTO ${insertTable} (${columns.join(', ')}) VALUES (${placeholders})`
            await db.query(query, values)
        }
    }
}
