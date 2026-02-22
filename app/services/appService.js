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
                            AND o.skjult != 1
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
    getUntranslatedRequests: async () => {
        const query = `SELECT o.lemma_id, o.oppslag, o.boy_tabell
                            FROM ønsker AS ø
                            INNER JOIN oppslag AS o ON o.oppslag = ø.oppslag
                            WHERE o.oppslag NOT IN
                                (SELECT oppslag FROM definisjon AS d
                                INNER JOIN oppslag AS o
                                USING (lemma_id))
                            AND o.skjult != 1
                            AND o.lemma_id NOT IN
                                (SELECT lemma_id FROM forslag AS f)
                            AND o.boy_tabell NOT IN ('symbol','forkorting')
                            AND LENGTH(o.oppslag) > 1
                            AND o.oppslag NOT IN ('Æ','æ','Ø','ø','Å','å')
                            ORDER BY ø.tidspunkt
                            LIMIT 500
                            `
        const results = await db.query(query)
        return results

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
                            WHERE oversatt_av != 0
                            `
            const result1 = await db.query(query1)
            oppslag_info.push(result1[0])

            const query2 = `SELECT 'ord_wiki' AS tittel, COUNT(DISTINCT lemma_id) AS antall
                            FROM definisjon AS d
                            WHERE oversatt_av = 0
                            `
            const result2 = await db.query(query2)
            oppslag_info.push(result2[0])

            const query3 = `SELECT 'ord_uten' AS tittel,
                            COUNT(DISTINCT lemma_id) AS antall
                            FROM oppslag AS o
                            WHERE lemma_id NOT IN (SELECT lemma_id FROM definisjon)
                            `
            const result3 = await db.query(query3)
            oppslag_info.push(result3[0])

            return oppslag_info
        } catch (error) {
            throw error
        }
    },
    getNyeOversettelser: async () => {
        try {
            const query = `SELECT TO_CHAR(opprettet, 'DD-FMMM') AS dato, count(*) AS antall
                             FROM definisjon AS d
                             WHERE opprettet BETWEEN NOW() - INTERVAL '30 days' AND NOW()
                             AND oversatt_av != 0
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
            const query = `SELECT TO_CHAR(opprettet, 'DD-FMMM') AS dato, count(*) AS antall
                             FROM forslag AS f
                             WHERE opprettet BETWEEN NOW() - INTERVAL '30 days' AND NOW()
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
            const query = `SELECT TO_CHAR(opprettet, 'DD-FMMM') AS dato, count(*) AS antall
                             FROM forslag_kommentarer AS fk
                             WHERE opprettet BETWEEN NOW() - INTERVAL '30 days' AND NOW()
                             GROUP BY dato
                             `
            const antall_kommentarer = await db.query(query)

            return antall_kommentarer
        } catch (error) {
            throw error
        }
    },
    getWordsWithTranslationsByDay: async () => {
        try {
            const query = ` SELECT fulldate, (SELECT COUNT(DISTINCT lemma_id)
                                            FROM oppslag AS o
                                            INNER JOIN definisjon AS d USING (lemma_id)
                            WHERE d.opprettet <= fulldate
                            AND d.oversatt_av != 0
                            ) AS antall
                            FROM dates
                            WHERE fulldate >= '2020-08-01' AND fulldate <= CURRENT_DATE + 1
                            GROUP BY fulldate;
                             `
            const antall_kommentarer = await db.query(query)

            return antall_kommentarer
        } catch (error) {
            throw error
        }
    },
    hentVegginnleggFraDB: async (innlegg_id = null) => {
        try {
            const query = ` SELECT vi.innlegg_id, vi.parent_id, b.brukernavn,
                            vi.opprettet, vi.innhold, vi.endret, vi.user_id,
                            GREATEST(vi.opprettet,
                                COALESCE((SELECT MAX(opprettet)
                                FROM veggen_innlegg AS barn
                                WHERE barn.parent_id = vi.innlegg_id)
                                , vi.opprettet)) AS nyeste,
                            (SELECT COALESCE(
                            (SELECT JSON_AGG(
                                JSON_BUILD_OBJECT('innlegg_id', vi2.innlegg_id,
                                            'brukernavn', b2.brukernavn,
                                            'user_id', vi2.user_id,
                                            'innhold', vi2.innhold,
                                            'opprettet', vi2.opprettet,
                                            'endret', vi2.endret
                                            ))
                                FROM veggen_innlegg AS vi2
                                INNER JOIN brukere AS b2 ON vi2.user_id = b2.user_id
                                WHERE vi.innlegg_id = vi2.parent_id),
                                '[]'::json)
                                ) AS svar
                            FROM veggen_innlegg AS vi
                            INNER JOIN brukere AS b ON vi.user_id = b.user_id
                            WHERE parent_id IS NULL
                            AND vi.innlegg_id = COALESCE($1, vi.innlegg_id)
                            ORDER BY nyeste DESC
                        `
            const result = await db.query(query, [innlegg_id])

            return result
        } catch (error) {
            throw error
        }
    },
    getSingleVegginnleggFraDB: async (innlegg_id) => {
        try {
            const query = ` SELECT vi.innlegg_id, vi.parent_id,
                            vi.opprettet, vi.innhold, vi.endret, vi.user_id,
                            (SELECT COALESCE(
                                (SELECT vi2.innlegg_id
                                FROM veggen_innlegg AS vi2
                                WHERE vi.innlegg_id = vi2.parent_id
                                LIMIT 1),
                                0)) AS har_svar
                            FROM veggen_innlegg AS vi
                            WHERE innlegg_id = $1
                        `
            const result = await db.query(query, [innlegg_id])

            return result[0]
        } catch (error) {
            throw error
        }
    },
    leggInnleggTilDB: async (parent_id, user_id, innhold) => {
        try {
            const query = `INSERT INTO veggen_innlegg (parent_id, user_id, innhold)
                            VALUES ($1, $2, $3)
                            RETURNING innlegg_id
                           `
            const result = await db.query(query, [parent_id, user_id, innhold])
            return result[0]

        } catch (error) {
            throw error
        }
    },
    endreInnleggDB: async (innlegg_id, user_id, endret_innhold) => {
        try {
            const query = `UPDATE veggen_innlegg
                            SET innhold = $1, endret = 1
                            WHERE user_id = $2
                            AND innlegg_id = $3
                           `
            await db.query(query, [endret_innhold, user_id, innlegg_id])

        } catch (error) {
            throw error
        }
    },
    deleteInnleggDB: async (innlegg_id, user_id) => {
        try {
            const query = `DELETE FROM veggen_innlegg
                            WHERE user_id = $1
                            AND innlegg_id = $2
                           `
            await db.query(query, [user_id, innlegg_id])

        } catch (error) {
            throw error
        }
    },
    hentAlleInnleggIDerFraDB: async () => {
        try {
            const query = `SELECT (innlegg_id)
                            FROM veggen_innlegg
                            `

            const result = await db.query(query)

            return result
        } catch (error) {
            throw error
        }
    },
    hentAntallUsetteVegginnleggFraDB: async (user_id) => {
        try {
            const query = `SELECT
                            (SELECT COUNT(*)
                            FROM veggen_innlegg
                            ) -
                            (SELECT COUNT(*)
                                FROM veggen_innlegg AS vi
                                INNER JOIN veggen_innlegg_sett AS vis USING(innlegg_id)
                                WHERE vis.user_id = $1
                            ) AS usette_innlegg
                        `

            const result = await db.query(query, [user_id])

            return result[0]
        } catch (error) {
            throw error
        }
    },
    settInnleggSomSettDB: async (innlegg_sett) => {
        try {
            await db.bulkInsert(
                `INSERT INTO veggen_innlegg_sett (innlegg_id, user_id)`,
                innlegg_sett,
                2,
                `ON CONFLICT DO NOTHING`
            )

        } catch (error) {
            throw error
        }
    },

    sendEpost: async (to, subject, template, bcc = '', options = {}) => {
        try {
            options['title'] = subject
            const html = await ejs.renderFile(path.join(__dirname, '../views/') + template, options)
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
                from: '"baksida.jisho.no" <no-reply@jisho.no>',
                to: to, // receiver Email
                bcc: bcc,
                subject: subject, // Subject line
                //body: body, // plain text body
                html: html
            }

            await transporter.sendMail(mailOptions)
        } catch (error) {
            throw error
        }
    },
    sendNotificationsAfterComment: async (forslag_id, user_id) => {

        let adressees = []

        const query = `SELECT f.user_id, b.epost, b.brukernavn
                        FROM forslag AS f
                        INNER JOIN brukere AS b ON f.user_id = b.user_id
                        WHERE forslag_id = $1
                        AND f.user_id != $2
                        AND b.opp_kommentar_eget = 1`

        const owner = await db.query(query, [forslag_id, user_id])
        if (owner.length > 0) {
            adressees.push(owner[0])
        }

        const query2 = `SELECT DISTINCT fk.user_id, b.epost, b.brukernavn
                        FROM forslag AS f
                        INNER JOIN forslag_kommentarer AS fk ON f.forslag_id = fk.forslag_id
                        INNER JOIN brukere AS b ON fk.user_id = b.user_id
                        WHERE f.forslag_id = $1
                        AND fk.user_id != $2
                        AND b.opp_svar = 1
                        `

        const commenters = await db.query(query2, [forslag_id, user_id])
        for (commenter of commenters) {
            if (!adressees.some(adressee => adressee.user_id === commenter.user_id)) {
                adressees.push(commenter)
            }
        }

        for (adressee of adressees) {
            await module.exports.sendEpost(adressee.epost, "Noen har kommentert...", 'comment_notification.ejs', 'admin@jisho.no', { forslag_id: forslag_id })
        }


    },
    sendNotificationsAfterWallPost: async (innlegg_id, user_id) => {

        let adressees = []

        const query = `SELECT vi.user_id, b.epost, b.brukernavn
                        FROM veggen_innlegg AS vi
                        INNER JOIN brukere AS b USING (user_id)
                        WHERE vi.innlegg_id = $1
                        AND vi.user_id != $2
                        AND b.opp_svar = 1`

        const owner = await db.query(query, [innlegg_id, user_id])
        if (owner.length > 0) {
            adressees.push(owner[0])
        }

        const query2 = `SELECT DISTINCT vi.user_id, b.epost, b.brukernavn
                        FROM veggen_innlegg AS vi
                        INNER JOIN brukere AS b USING (user_id)
                        WHERE vi.parent_id = $1
                        AND vi.user_id != $2
                        AND b.opp_svar = 1
                        `

        const repliers = await db.query(query2, [innlegg_id, user_id])
        for (replier of repliers) {
            if (!adressees.some(adressee => adressee.user_id === replier.user_id)) {
                adressees.push(replier)
            }
        }

        for (adressee of adressees) {
            await module.exports.sendEpost(adressee.epost, "Noen har svart på...", 'wall_notification.ejs', 'admin@jisho.no', { innlegg_id: innlegg_id })
        }


    },
    writeFeedbackToDB: async (lemma_id, feedback) => {
        const query = `INSERT INTO feedback(lemma_id, feedback)
                        VALUES ($1, $2)`
        await db.query(query, [lemma_id, feedback])
    },
    writeRequestToDB: async (request) => {
        const query = `INSERT INTO ønsker (oppslag)
                        VALUES ($1)`
        await db.query(query, [request])
    },
    registerVisit: async () => {
        const query = `INSERT INTO page_traffic DEFAULT VALUES`
        await db.query(query)
    },
    getPageVisitStatsFromDB: async () => {
        const query = `SELECT TO_CHAR(timestamp, 'DD.MM.YYYY') AS dato, COUNT(*) AS antall
                        FROM page_traffic
                        GROUP BY TO_CHAR(timestamp, 'DD.MM.YYYY')
                        ORDER BY MIN(timestamp) DESC`
        const result = await db.query(query)
        return result
    }
}
