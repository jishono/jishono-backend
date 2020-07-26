const Forslag = require("../services/forslagService")
const db = require("../db/database")

module.exports = {
    addForslag: async (req, res) => {

        const oppslag = req.body.oppslag
        const user_id = res.locals.user_id
        try {
            const query1 = `SELECT definisjon FROM definisjon
                          WHERE lemma_id = ?`

            const current_defs = await db.query(query1, [oppslag.lemma_id])
            if (current_defs.length > 0) {
                res.status(403).send("Du kan ikke legge til forslag i ord med eksisterende definisjoner")
            } else {
                if (oppslag.definisjon.length > 0 && oppslag.definisjon[0]['definisjon'] != '') {
                    const query2 = `INSERT INTO forslag (lemma_id, user_id, forslag_definisjon)
                            VALUES ?`
                    await db.query(query2, [oppslag.definisjon.map(def => [def.lemma_id, user_id, def.definisjon])])
                    res.status(200).send("Forslag lagt til. Videresender til forslagsoversikt...")

                } else {
                    res.status(400).send("Du må komme med minst ett forslag")
                }
            }
        } catch (error) {
            console.log(error)
            res.status(500).send("Noe gikk galt")
        }
    },
    getAllForslag: async (req, res) => {
        const user_id = res.locals.user_id
        try {
            const query = `SELECT f.forslag_id, o.lemma_id, o.oppslag, o.boy_tabell, f.forslag_definisjon, b.brukernavn, b.user_id,
                        IFNULL(SUM(s.type = 1),0) AS upvotes, IFNULL(SUM(s.type = 0), 0) AS downvotes,
                        f.opprettet, (SELECT type FROM stemmer WHERE user_id = ? AND forslag_id = f.forslag_id) AS minstemme
                        FROM forslag AS f
                        INNER JOIN oppslag AS o USING (lemma_id)
                        INNER JOIN brukere AS b USING (user_id)
                        LEFT OUTER JOIN stemmer AS s USING (forslag_id)
                        WHERE f.status = 0
                        GROUP BY f.forslag_id`
            oppslag = await db.query(query, [user_id])
            res.status(200).send(oppslag)
        } catch (error) {
            console.log(error)
        }
    },
    getBrukerforslag: async (req, res) => {
        const user_id = res.locals.user_id
        try {
            const brukerforslag = await Forslag.getBrukerforslagFraDB(user_id)
            console.log(brukerforslag)
            res.status(200).send(brukerforslag)

        } catch (error) {
            console.log(error)
            res.status(500).send("Noe gikk galt.")
        }
    },
    stemForslag: async (req, res) => {
        const user_id = res.locals.user_id
        const forslag_id = req.params.id
        const type = req.body.type
        try {
            const query1 = `SELECT stemme_id, type 
                        FROM stemmer AS s
                        WHERE user_id = ?
                        AND forslag_id = ?
                        `
            result = await db.query(query1, [user_id, forslag_id])
            if (result.length > 0 && result[0].type == type) {
                const query2 = `DELETE FROM stemmer
                            WHERE user_id = ? AND forslag_id = ?`
                await db.query(query2, [user_id, forslag_id])
                return res.status(200).send("Stemme fjernet")
            }
            const query3 = `INSERT INTO stemmer (forslag_id, user_id, type)
                            VALUES (?, ?, ?)
                            ON DUPLICATE KEY UPDATE
                            type = VALUES (type)
                            `
            await db.query(query3, [forslag_id, user_id, type])

            const query4 = `SELECT IFNULL(SUM(s.type = 1),0) AS upvotes,
                            IFNULL(SUM(s.type = 0),0) AS downvotes
                            FROM stemmer AS s
                            WHERE forslag_id = ?`

            let votes = await db.query(query4, [forslag_id])
            votes = votes[0]
            console.log(votes)

            if (votes.upvotes >= 5) {
                await Forslag.leggForslagTilDB(forslag_id)
                await Forslag.settStatusForslag(forslag_id, 1)
                return res.status(200).send('Forslaget har fått mer enn 5 upvotes og er nå lagt til i ordboka')
            }
            if (votes.downvotes >= 2) {
                await Forslag.settStatusForslag(forslag_id, 4)
                return res.status(200).send('Forslaget har fått mer enn 5 downvotes og er derfor slettet')
            }

            res.status(200).send('Stemme mottatt')

        } catch (error) {
            console.log(error)
            res.status(500).send("Noe gikk galt")
        }
    },
    adminGodkjennForslag: async (req, res) => {
        const forslag_id = req.params.id
        const redigert_forslag = req.body.redigert_forslag
        try {
            await Forslag.leggForslagTilDB(forslag_id, redigert_forslag)
            if (redigert_forslag) {
                await Forslag.settStatusForslag(forslag_id, 3)
            } else {
                await Forslag.settStatusForslag(forslag_id, 2)
            }
            res.status(200).send("Forslag godkjent og lagt til i ordboka")
        } catch (error) {
            console.log(error)
            res.status(500).send("Noe gikk galt")
        }

    },
   
    avvisForslag: async (req, res) => {
        const forslag_id = req.params.id
        try {
            //await module.exports.slettForslagFraDB(forslag_id, null)
            await Forslag.settStatusForslag(forslag_id, 4)
            res.status(200).send("Forslag avvist")
        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke avvise forslag")
        }
    },
    fjernForslag: async (req, res) => {

        const forslag_id = req.params.id
        const user_id = res.locals.user_id

        try {
            await module.exports.slettForslagFraDB(forslag_id, user_id)
            res.status(200).send("Forslag fjernet")
        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke fjerne forslag")
        }
    },

    
}