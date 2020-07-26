const db = require("../db/database")

module.exports = {
    getBrukerforslagFraDB: async (user_id) => {
        const query = `SELECT f.forslag_id, o.oppslag, o.boy_tabell, f.forslag_definisjon,
                            IFNULL (SUM(s.type = 1), 0) AS upvotes, IFNULL(SUM(s.type = 0), 0) AS downvotes,
                            f.status, f.opprettet 
                            FROM forslag AS f
                            INNER JOIN oppslag AS o USING(lemma_id)
                            LEFT OUTER JOIN stemmer AS s USING(forslag_id)
                            WHERE f.user_id = ?
                            GROUP BY f.forslag_id`
        try {
            const brukerforslag = await db.query(query, [user_id])
            return brukerforslag
        } catch (error) {
            throw error
        }
    },
    slettForslagFraDB: async (forslag_id, user_id) => {
        try {
            let query1 = `DELETE FROM forslag
                        WHERE forslag_id = ?
                        AND user_id = ?`
            await db.query(query1, [forslag_id, user_id])

            const query2 = `DELETE FROM stemmer
                          WHERE forslag_id = ?`
            await db.query(query2, [forslag_id])

        } catch (error) {
            throw error
        }
    },
    leggForslagTilDB: async (forslag_id, redigert_forslag = null) => {
        try {
            const query1 = `SELECT forslag_id, lemma_id, forslag_definisjon, user_id
                          FROM forslag
                          WHERE forslag_id = ?`
            let forslag = await db.query(query1, [forslag_id])
            forslag = forslag[0]
            if (redigert_forslag) {
                forslag.forslag_definisjon = redigert_forslag
                const query2 = `UPDATE forslag SET forslag_definisjon = ?
                                WHERE forslag_id = ?`
                await db.query(query2, [redigert_forslag, forslag_id] )
            }
            const query3 = `SELECT COALESCE(MAX(prioritet), 0) AS max_pri FROM definisjon WHERE lemma_id = ?`
            let result = await db.query(query3, [forslag.lemma_id])

            const max_pri = result[0]['max_pri'] + 1
            const query4 = `INSERT INTO definisjon (lemma_id, prioritet, definisjon, oversatt_av)
                          VALUES (?, ?, ?, ?)`
            await db.query(query4, [forslag.lemma_id, max_pri, forslag.forslag_definisjon, forslag.user_id])

            //await module.exports.slettForslagFraDB(forslag_id, null)

        } catch (error) {
            throw error
        }
    },
    settStatusForslag: async (forslag_id, statuskode) => {
        try {
            const query = `UPDATE forslag SET status = ?
                            WHERE forslag_id = ?`

            const result = await db.query(query, [statuskode, forslag_id])
            console.log(result)

        } catch (error) {
            throw error
        }
    }
}