const db = require("../db/database")

module.exports = {
    getAnbefalingerFraFrekvens: async () => {
        try {
            const query = `SELECT f.score, o.lemma_id, o.oppslag, o.boy_tabell
                            FROM frekvens AS f 
                            INNER JOIN oppslag AS o ON o.oppslag = f.lemma
                            WHERE o.oppslag NOT IN 
                            (SELECT oppslag FROM definisjon AS d
                                INNER JOIN oppslag AS o
                                USING (lemma_id))
                                AND o.lemma_id NOT IN 
                                (SELECT lemma_id FROM forslag AS f)
                                AND o.boy_tabell NOT IN ('symbol','forkorting')
                            ORDER BY f.score ASC
                            LIMIT 500
                            `
            const results = await db.query(query)
            const amount = results.length
            let anbefalinger = []
            for (let i = 0; i < 10; i++) {
                let random_index = Math.floor(Math.random() * amount)
                let random_result = results[random_index]
                if (!anbefalinger.some(item => item.lemma_id === random_result.lemma_id)) {
                    anbefalinger.push(random_result)
                }
            }
            return anbefalinger
        } catch (error) {
            throw error
        }
    },
    getBrukeroversettelser: async () => {
        try {
            const query = `SELECT b.brukernavn, COUNT(*) AS antall_oversettelser
                            FROM definisjon AS d
                            INNER JOIN brukere AS b ON d.oversatt_av = b.user_id
                            GROUP BY b.brukernavn
                            ORDER BY antall_oversettelser DESC`

            const brukeroversettelser = await db.query(query)
            return brukeroversettelser
        } catch (error) {
            throw error
        }
    },
    getOppslagInfo: async () => {
        try {

            let oppslag_info = []
            const query1 = `SELECT 'ord_med' AS tittel, COUNT(DISTINCT lemma_id) AS antall
                            FROM definisjon AS d
                            `
            const result1 = await db.query(query1)
            oppslag_info.push(result1[0])

            const query2 = `SELECT 'ord_uten' AS tittel, 
                            COUNT(DISTINCT lemma_id) AS antall
                            FROM oppslag AS o
                            WHERE lemma_id NOT IN (SELECT lemma_id FROM definisjon)
                            `
            const result2 = await db.query(query2)
            oppslag_info.push(result2[0])

            return oppslag_info
        } catch (error) {
            throw error
        }
    },
    getNyeOversettelser: async () => {
        try {
            const query = `SELECT DATE_FORMAT(opprettet, '%d-%c') AS dato, count(*) AS antall
                             FROM definisjon AS d
                             WHERE opprettet BETWEEN NOW() - INTERVAL 30 DAY AND NOW()
                             GROUP BY dato
                             `
            const nye_oversettelser = await db.query(query)

            return nye_oversettelser
        } catch (error) {
            throw error
        }
    },
    getNyeForslag: async () => {
        try {
            const query = `SELECT DATE_FORMAT(opprettet, '%d-%c') AS dato, count(*) AS antall
                             FROM forslag AS f
                             WHERE opprettet BETWEEN NOW() - INTERVAL 30 DAY AND NOW()
                             GROUP BY dato
                             `
            const nye_forslag = await db.query(query)

            return nye_forslag
        } catch (error) {
            throw error
        }
    },
    getAntallKommentarer: async () => {
        try {
            const query = `SELECT DATE_FORMAT(opprettet, '%d-%c') AS dato, count(*) AS antall
                             FROM forslag_kommentarer AS fk
                             WHERE opprettet BETWEEN NOW() - INTERVAL 30 DAY AND NOW()
                             GROUP BY dato
                             `
            const antall_kommentarer = await db.query(query)

            return antall_kommentarer
        } catch (error) {
            throw error
        }
    },
}