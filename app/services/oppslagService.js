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
    sokOppslagMedQuery: async (query_string) => {
        const q = query_string.q
        console.log(query_string)
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