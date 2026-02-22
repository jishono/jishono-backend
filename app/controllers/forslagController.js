const Forslag = require("../services/forslagService")
const App = require("../services/appService")
/* const Oppslag = require("../services/oppslagService") */
const msg = require('../locale/msg.json')

module.exports = {
    addForslag: async (req, res) => {

        const nye_forslag = req.body.nye_forslag
        const lemma_id = req.body.lemma_id
        const user_id = res.locals.user_id
        try {

            if (nye_forslag.length > 0 && nye_forslag[0]['definisjon'] != '') {
                for (forslag of nye_forslag) {
                    let forslag_id = await Forslag.leggForslagTilDB(lemma_id, user_id, forslag.definisjon, forslag.prioritet)
                    console.log(forslag)
                    if (forslag.kommentar != null && forslag.kommentar != '') {
                        const kommentar_id = await Forslag.leggForslagKommentarTilDB(forslag_id, user_id, forslag.kommentar)
                        await Forslag.settKommentarSomSettDB([[kommentar_id, user_id]])
                    }
                }
                return res.status(200).send(msg.forslag.lagt_til)
            }
            res.status(400).send(msg.forslag.minst_ett)

        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    getAllForslag: async (req, res) => {
        const user_id = res.locals.user_id
        const status = req.query.status || 0
        try {
            let forslag = await Forslag.getAktiveForslagFraDB(user_id, status)
            res.status(200).send(forslag)
        } catch (error) {
            console.log(error)
        }
    },
    getMyForslag: async (req, res) => {
        const user_id = res.locals.user_id
        try {
            let forslag = await Forslag.getMyForslagFromDB(user_id)
            res.status(200).send(forslag)
        } catch (error) {
            console.log(error)
        }
    },
    hentForslag: async (req, res) => {
        const forslag_id = req.params.id
        try {
            let forslag = await Forslag.hentEnkeltForslagFraDB(forslag_id)
            res.status(200).send(forslag)
        } catch (error) {
            console.log(error)
        }
    },
    stemForslag: async (req, res) => {
        const user_id = res.locals.user_id
        const forslag_id = req.params.id
        const type = req.body.type
        try {

            const forslagseier = await Forslag.hentForslagseierFraDB(forslag_id)
            
            if (forslagseier.status != 0) {
                return res.status(400).send(msg.forslag.avsluttet)
            }

            if (user_id == forslagseier.user_id) {
                return res.status(400).send(msg.forslag.eget_forslag)
            }

            const stemmer_bruker = await Forslag.hentStemmerFraBruker(forslag_id, user_id)

            if (stemmer_bruker.length > 0 && stemmer_bruker[0].type == type) {
                await Forslag.slettStemmeFraDB(forslag_id, user_id)
                return res.status(200).send(msg.forslag.stemme_fjernet)
            }

            await Forslag.settInnStemmeDB(forslag_id, user_id, type)

            const antall_stemmer = await Forslag.hentAntallStemmerPaaForslagFraDB(forslag_id)

            if (antall_stemmer.upvotes >= 3) {
                await Forslag.gjorForslagTilDefinisjonDB(forslag_id)
                await Forslag.settStatusForslag(forslag_id, 1)
                return res.status(200).send(msg.forslag.godkjent_upvotes)
            }
            if (antall_stemmer.downvotes >= 3) {
                await Forslag.settStatusForslag(forslag_id, 4)
                return res.status(200).send(msg.forslag.avvist_downvotes)
            }
            res.status(200).send(msg.forslag.stemme_mottatt)

        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    adminGodkjennForslag: async (req, res) => {
        const forslag_id = req.params.id
        const redigert_forslag = req.body.redigert_forslag
        const endret = req.body.endret
        try {
            await Forslag.gjorForslagTilDefinisjonDB(forslag_id, redigert_forslag)
            if (endret) {
                await Forslag.settStatusForslag(forslag_id, 3)
            } else {
                await Forslag.settStatusForslag(forslag_id, 2)
            }
            res.status(200).send(msg.forslag.godkjent)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }

    },
    redigerForslag: async (req, res) => {
        const forslag_id = req.params.id
        const user_id = res.locals.user_id
        const redigert_forslag = req.body.redigert_forslag
        try {
            await Forslag.endreForslagDB(forslag_id, user_id, redigert_forslag)
            res.status(200).send(msg.forslag.endret)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }

    },

    avvisForslag: async (req, res) => {
        const forslag_id = req.params.id
        try {
            await Forslag.settStatusForslag(forslag_id, 5)
            res.status(200).send(msg.forslag.avvist)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    fjernForslag: async (req, res) => {

        const forslag_id = req.params.id
        const user_id = res.locals.user_id

        try {
            await Forslag.slettForslagFraDB(forslag_id, user_id)
            res.status(200).send(msg.forslag.fjernet)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    getForslagKommentarer: async (req, res) => {

        const user_id = res.locals.user_id
        const forslag_id = req.params.id
        try {
            const kommentarer = await Forslag.hentForslagKommentarerFraDB(forslag_id)
           
            if (kommentarer.length > 0) {
                const kommentarer_sett = kommentarer.map(kommentar => [kommentar.forslag_kommentar_id, user_id])
                await Forslag.settKommentarSomSettDB(kommentarer_sett)
            }

            res.status(200).send(kommentarer)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    postForslagKommentar: async (req, res) => {

        const forslag_id = req.params.id
        const user_id = res.locals.user_id
        const ny_kommentar = req.body.ny_kommentar

        try {
            await Forslag.leggForslagKommentarTilDB(forslag_id, user_id, ny_kommentar)
            res.status(200).send(msg.kommentarer.lagt_til)
            await App.sendNotificationsAfterComment(forslag_id, user_id)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
}