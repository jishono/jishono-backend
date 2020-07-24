const db = require("../db/database")

module.exports = {
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
            const query1 = `SELECT 'Oversatte ord' AS tittel, COUNT(DISTINCT lemma_id) AS antall
                            FROM definisjon AS d
                            `
            const result1 = await db.query(query1)
            oppslag_info.push(result1[0])

            const query2 = `SELECT 'Ord uten oversettelse' AS tittel, 
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
}