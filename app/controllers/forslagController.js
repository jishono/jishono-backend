const Forslag = require("../services/forslagService")
const Oppslag = require("../services/oppslagService")

module.exports = {
    addForslag: async (req, res) => {

        const forslag_definisjoner = req.body.forslag_definisjoner
        const lemma_id = req.body.lemma_id
        const user_id = res.locals.user_id
        try {

            const current_defs = await Oppslag.hentAlleDefinisjonerPaaOppslag(lemma_id)
            if (current_defs.length > 0) {
                return res.status(403).send("Du kan ikke legge til forslag i ord med eksisterende definisjoner")
            }
            if (forslag_definisjoner.length > 0 && forslag_definisjoner[0] != '') {
                await Forslag.leggForslagTilDB(forslag_definisjoner.map(def => [lemma_id, user_id, def]))
                return res.status(200).send("Forslag lagt til. Videresender til forslagsoversikt...")
            }
            res.status(400).send("Du må komme med minst ett forslag")

        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke legge til forslag")
        }
    },
    getAllForslag: async (req, res) => {
        const user_id = res.locals.user_id
        try {
            let forslag = await Forslag.getAktiveForslagFraDB(user_id)
            res.status(200).send(forslag)
        } catch (error) {
            console.log(error)
        }
    },
    getBrukerforslag: async (req, res) => {
        const user_id = res.locals.user_id
        try {
            const brukerforslag = await Forslag.getBrukerforslagFraDB(user_id)
            res.status(200).send(brukerforslag)

        } catch (error) {
            console.log(error)
            res.status(500).send("Noe gikk galt under henting av forslag")
        }
    },
    stemForslag: async (req, res) => {
        const user_id = res.locals.user_id
        const forslag_id = req.params.id
        const type = req.body.type
        try {

            const stemmer_bruker = await Forslag.hentStemmerFraBruker(forslag_id, user_id)

            if (stemmer_bruker.length > 0 && stemmer_bruker[0].type == type) {
                await Forslag.slettStemmeFraDB(forslag_id, user_id)
                return res.status(200).send("Stemme fjernet")
            }
            const forslagseier = await Forslag.hentForslagseierFraDB(forslag_id)
            if (user_id == forslagseier.user_id) {
                return res.status(400).send("Du kan ikke stemme på ditt eget forslag.")
            }

            await Forslag.settInnStemmeDB(forslag_id, user_id, type)

            const antall_stemmer = await Forslag.hentAntallStemmerPaaForslagFraDB(forslag_id)

            if (antall_stemmer.upvotes >= 5) {
                await Forslag.gjorForslagTilDefinisjonDB(forslag_id)
                await Forslag.settStatusForslag(forslag_id, 1)
                return res.status(200).send('Forslaget har fått mer enn 5 upvotes og er nå lagt til i ordboka')
            }
            if (antall_stemmer.downvotes >= 2) {
                await Forslag.settStatusForslag(forslag_id, 4)
                return res.status(200).send('Forslaget har fått mer enn 5 downvotes og er derfor slettet')
            }
            res.status(200).send('Stemme mottatt')

        } catch (error) {
            console.log(error)
            res.status(500).send("Noe gikk galt under stemming på forslag")
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
            res.status(200).send("Forslag godkjent og lagt til i ordboka")
        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke godkjenne forslag")
        }

    },
    redigerForslag: async (req, res) => {
        const forslag_id = req.params.id
        const user_id = res.locals.user_id
        const redigert_forslag = req.body.redigert_forslag
        try {
            await Forslag.endreForslagDB(forslag_id, user_id, redigert_forslag)
            await Forslag.nullstillStemmerDB(forslag_id, user_id)
            res.status(200).send("Forslag redigert og stemmer nullstilt.")
        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke redigere forslag")
        }

    },

    avvisForslag: async (req, res) => {
        const forslag_id = req.params.id
        try {
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
            await Forslag.slettForslagFraDB(forslag_id, user_id)
            res.status(200).send("Forslag fjernet")
        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke fjerne forslag")
        }
    },
    getForslagKommentarer: async (req, res) => {

        const forslag_id = req.params.id
        try {
            const kommentarer = await Forslag.hentForslagKommentarerFraDB(forslag_id)
            res.status(200).send(kommentarer)
        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke legge til kommentar")
        }
    },
    postForslagKommentar: async (req, res) => {

        const forslag_id = req.params.id
        const user_id = res.locals.user_id
        const ny_kommentar = req.body.ny_kommentar

        try {
            await Forslag.leggForslagKommentarTilDB(forslag_id, user_id, ny_kommentar)
            res.status(200).send("Kommentar lagt til")
        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke legge til kommentar")
        }
    },
}