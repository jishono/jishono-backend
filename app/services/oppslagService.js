const db = require("../db/database")

module.exports = {
    hentAlleDefinisjonerPaaOppslag: async (lemma_id) => {
        const query = `SELECT definisjon FROM definisjon
                        WHERE lemma_id = ?`
        try {
            const definisjoner = await db.query(query, [lemma_id])
            return definisjoner
        } catch (error) {
            throw error
        }
    },
    hentOppslagFraDB: async (lemma_id) => {
        try {
            const query = `SELECT o.lemma_id, o.oppslag, o.ledd, o.boy_tabell, 
                            (SELECT IFNULL(
                                (SELECT JSON_ARRAYAGG(
                                JSON_OBJECT('def_id', d.def_id,
                                            'lemma_id', d.lemma_id,
                                            'prioritet', d.prioritet,
                                            'definisjon', d.definisjon                    
                                            ))
                                FROM definisjon AS d
                                WHERE o.lemma_id = d.lemma_id),
                                JSON_ARRAY())
                                ) AS definisjon,
                            (SELECT IFNULL(
                                (SELECT JSON_ARRAYAGG(
                                JSON_OBJECT('uttale_id',u.uttale_id,
                                            'lemma_id', u.lemma_id,
                                            'transkripsjon', u.transkripsjon
                                            ))
                                FROM uttale AS u 
                                WHERE u.lemma_id = o.lemma_id),
                                JSON_ARRAY())
                                ) AS uttale
                            FROM oppslag AS o
                            WHERE o.lemma_id = ?`

            const oppslag = await db.query(query, [lemma_id])
            return oppslag
        } catch (error) {
            throw error
        }
    },

    getAllItemsFromDB: async () => {
        const query = `
            WITH oppslag_def AS (SELECT * FROM oppslag AS o WHERE o.lemma_id IN (SELECT lemma_id FROM definisjon))
            
            SELECT od.lemma_id, od.oppslag, od.ledd, od.boy_tabell, 
                (SELECT IFNULL(
                    (SELECT JSON_ARRAYAGG(
                        JSON_OBJECT('def_id', d.def_id,
                            'prioritet', d.prioritet,
                            'definisjon', d.definisjon                    
                            ))
                    FROM definisjon AS d
                    WHERE od.lemma_id = d.lemma_id),
                JSON_ARRAY())
                ) AS definisjoner,
                (SELECT IFNULL(
                    (SELECT JSON_ARRAYAGG(
                        JSON_OBJECT('uttale_id',u.uttale_id,
                            'transkripsjon', u.transkripsjon
                            ))
                    FROM uttale AS u 
                    WHERE u.lemma_id = od.lemma_id),
                JSON_ARRAY())
                ) AS uttale,
                (SELECT IFNULL(
                    (SELECT JSON_ARRAYAGG(b.pos)
                    FROM subst_boy AS b
                    WHERE b.lemma_id = od.lemma_id),
                JSON_ARRAY())
                ) AS pos,
                (SELECT IFNULL(
                    (SELECT JSON_ARRAYAGG(oppslag)
                    FROM relaterte_oppslag AS ro
                    WHERE ro.lemma_id = od.lemma_id),
                JSON_ARRAY())
                ) AS relatert
            FROM oppslag_def AS od
            `

        const results = db.query(query)

        return results
    },

    getSuggestionListFromDB: async (searchWord) => {
        const query = `
                    SELECT DISTINCT oppslag
                    FROM alle_boyninger AS ab
                    INNER JOIN oppslag AS o USING(lemma_id)
                    WHERE ab.boyning = ?
                    AND oppslag != ?
                    AND lemma_id IN (SELECT lemma_id FROM definisjon);
                    `
        const results = await db.query(query, [searchWord, searchWord])

        return results
    },

    generateRelatedWords: async () => {
        const query = `SELECT o.lemma_id, o.oppslag, (SELECT IFNULL(
                            (SELECT JSON_ARRAYAGG(ab.boyning)
                            FROM alle_boyninger AS ab
                            WHERE ab.lemma_id = o.lemma_id),
                                JSON_ARRAY())) AS boyninger
        
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
                        console.log(row.oppslag, row2.oppslag)
                        const insertArray = [row.lemma_id, row2.oppslag]
                        inserts.push(insertArray)
                    }
                }
            }
        }
        const query2 = `DROP TABLE IF EXISTS relaterte_oppslag;
                        CREATE TABLE relaterte_oppslag (
                            relatert_id mediumint NOT NULL PRIMARY KEY AUTO_INCREMENT,
                            lemma_id mediumint NOT NULL,
                            oppslag varchar(50) COLLATE utf8mb4_danish_ci NOT NULL,
                            FOREIGN KEY (lemma_id) REFERENCES oppslag (lemma_id)
                            );
                        INSERT INTO relaterte_oppslag (lemma_id, oppslag)
                        VALUES ?
                        ;
                        
        `

        await db.query(query2, [inserts])

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

        posarray = []
        pos_val = ["adj", "adv", "det", "forkorting",
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

        if (q) {
            query += ' AND o.oppslag LIKE ?'
            params.push(q + '%')
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

        if (posarray.length > 0) {
            query += ' AND o.boy_tabell IN (?)'
            params.push(posarray)
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
        console.log(searchQuery)
        const query = `WITH oppslag_def AS (SELECT * FROM oppslag AS o WHERE o.lemma_id IN (SELECT lemma_id FROM definisjon))
            
                        SELECT od.lemma_id, od.oppslag, od.ledd, od.boy_tabell, 
                            (SELECT IFNULL(
                                (SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT('def_id', d.def_id,
                                        'prioritet', d.prioritet,
                                        'definisjon', d.definisjon                    
                                        ))
                                FROM definisjon AS d
                                WHERE od.lemma_id = d.lemma_id),
                            JSON_ARRAY())
                            ) AS definisjoner,
                            (SELECT IFNULL(
                                (SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT('uttale_id',u.uttale_id,
                                        'transkripsjon', u.transkripsjon
                                        ))
                                FROM uttale AS u 
                                WHERE u.lemma_id = od.lemma_id),
                            JSON_ARRAY())
                            ) AS uttale  
                        FROM oppslag_def AS od
                        WHERE od.oppslag LIKE CONCAT('%', ?, '%')
                        ORDER BY
                        CASE
                            WHEN lower(od.oppslag) LIKE ? THEN 1
                            WHEN lower(od.oppslag) LIKE ? || '%' THEN 2
                            WHEN lower(od.oppslag) LIKE '%' || ? THEN 3
                            ELSE 4
                        END
                        LIMIT 5`
        try {
            const results = await db.query(query, [searchQuery, searchQuery, searchQuery, searchQuery])
            return results
        } catch (error) {
            throw error
        }
    },

    getConjugationsFromDB: async (lemma_id, table) => {
        const query = `SELECT * FROM ?? WHERE lemma_id = ?
                        ORDER BY pos ASC`
        try {
            const conjugations = await db.query(query, [table, lemma_id])
            return conjugations
        } catch (error) {
            throw error
        }
    },

    getFlatConjugationsFromDB: async (lemma_id) => {
        const query = `SELECT o.oppslag, group_concat(boyning) AS conjugations 
                        FROM alle_boyninger AS ab
                        RIGHT JOIN oppslag AS o USING(lemma_id)
                        WHERE lemma_id = ?
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
        const query = ` SELECT no.no_setning, ja.ja_setning
                        FROM eksempler_no AS no
                        LEFT JOIN eksempler_lenker AS l ON no.no_id = l.no_id
                        LEFT JOIN eksempler_ja AS ja ON l.ja_id = ja.ja_id
                        WHERE no.no_setning REGEXP ?
                        ORDER BY ja.ja_setning DESC
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
                        WHERE lemma_id = ?
                        ORDER BY opprettet DESC`
        try {
            const kommentarer = await db.query(query, [lemma_id])
            return kommentarer
        } catch (error) {
            throw error
        }
    },
    slettDefinisjonerFraDB: async (def_id_array) => {
        const query = `DELETE FROM definisjon
                        WHERE def_id IN (?)`
        try {
            await db.query(query, [def_id_array])
        } catch (error) {
            throw error
        }

    },
    slettUttaleFraDB: async (uttale_id_array) => {
        const query = `DELETE FROM uttale
                        WHERE uttale_id IN (?)`
        try {
            await db.query(query, [uttale_id_array])
        } catch (error) {
            throw error
        }

    },
    oppdaterLeddOppslagDB: async (ledd, lemma_id) => {
        const query = `UPDATE oppslag
                        SET ledd = ?
                        WHERE lemma_id = ?`
        try {
            await db.query(query, [ledd, lemma_id])
        } catch (error) {
            throw error
        }

    },
    leggTilDefinisjonDB: async (def_array) => {
        console.log(def_array)
        const query = `INSERT INTO definisjon (def_id, lemma_id, prioritet, definisjon, oversatt_av)
                        VALUES ?
                        ON DUPLICATE KEY UPDATE
                        prioritet = VALUES (prioritet),
                        definisjon = VALUES (definisjon),
                        sist_endret = CURRENT_TIMESTAMP`
        try {
            await db.query(query, [def_array])
        } catch (error) {
            throw error
        }
    },
    leggTilUttaleDB: async (uttale_array) => {
        const query = `INSERT INTO uttale (uttale_id, lemma_id, transkripsjon)
                        VALUES ?
                        ON DUPLICATE KEY UPDATE
                        transkripsjon = VALUES (transkripsjon)`
        try {
            await db.query(query, [uttale_array])
        } catch (error) {
            throw error
        }
    },
    leggTilOppslagKommentarDB: async (lemma_id, user_id, ny_kommentar) => {
        try {
            const query = `INSERT INTO oppslag_kommentarer (lemma_id, user_id, kommentar)
                        VALUES (?, ?, ?)`

            await db.query(query, [lemma_id, user_id, ny_kommentar])
        } catch (error) {
            throw error
        }
    }
}