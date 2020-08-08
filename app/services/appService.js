const db = require("../db/database")
const config = require("../config/config")
const ejs = require("ejs")
const nodemailer = require('nodemailer')
const path = require("path")

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
                            AND LENGTH(o.oppslag) > 1
                            AND o.oppslag NOT IN ('Æ','æ','Ø','ø','Å','å')
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
    hentVegginnleggFraDB: async (innlegg_id) => {
        try {
            const query = ` SELECT vi.innlegg_id, vi.parent_id, b.brukernavn,
                            vi.opprettet, vi.innhold, vi.endret, vi.user_id,
                            (SELECT IFNULL(
                            (SELECT JSON_ARRAYAGG(
                                JSON_OBJECT('innlegg_id', vi2.innlegg_id,
                                            'brukernavn', b2.brukernavn,
                                            'user_id', vi2.user_id,
                                            'innhold', vi2.innhold,
                                            'opprettet', vi2.opprettet,
                                            'endret', vi2.endret                    
                                            ))
                                FROM veggen_innlegg AS vi2
                                INNER JOIN brukere AS b2 ON vi2.user_id = b2.user_id
                                WHERE vi.innlegg_id = vi2.parent_id),
                                JSON_ARRAY())
                                ) AS svar
                            FROM veggen_innlegg AS vi
                            INNER JOIN brukere AS b ON vi.user_id = b.user_id
                            WHERE parent_id IS NULL
                            AND vi.innlegg_id = IFNULL(?, vi.innlegg_id)
                            ORDER BY vi.opprettet DESC
                        `
            const result = await db.query(query, [innlegg_id])

            return result
        } catch (error) {
            throw error
        }
    },
    leggInnleggTilDB: async (parent_id, user_id, innhold) => {
        try {
            const query = `INSERT INTO veggen_innlegg (parent_id, user_id, innhold) 
                            VALUES (?, ?, ?)
                           `
            await db.query(query, [parent_id, user_id, innhold])

        } catch (error) {
            throw error
        }
    },
    endreInnleggDB: async (innlegg_id, user_id, endret_innhold) => {
        try {
            const query = `UPDATE veggen_innlegg
                            SET innhold = ?, endret = 1
                            WHERE user_id = ?
                            AND innlegg_id = ?
                           `
            await db.query(query, [endret_innhold, user_id, innlegg_id])

        } catch (error) {
            throw error
        }
    },
    sendEpost: async (to, subject, template) => {
        try {
            console.log(config.epost.user)
            const html = await ejs.renderFile(path.join(__dirname, '../views/') + template)
            const transporter = nodemailer.createTransport({
                host: 'smtp.webhuset.no',
                port: 465,
                secure: true,
                auth: {
                    user: config.epost.user,
                    pass: config.epost.password
                }
            })

            let mailOptions = {
                from: '"Admin - jisho.no" <admin@jisho.no>',
                to: to, // receiver Email
                subject: subject, // Subject line
                //body: body, // plain text body
                html: html
            }

            await transporter.sendMail(mailOptions)
        } catch (error) {
            throw error
        }
    }
}