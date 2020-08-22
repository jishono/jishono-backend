const App = require("../services/appService")
const msg = require('../locale/msg.json')

module.exports = {
    getStatistikk: async (req, res) => {
        try {
            let statistikk = {}
            statistikk['brukeroversettelser'] = await App.getBrukeroversettelser()
            statistikk['oppslag_info'] = await App.getOppslagInfo()
            statistikk['nye_oversettelser'] = await App.getNyeOversettelser()
            statistikk['nye_forslag'] = await App.getNyeForslag()
            statistikk['antall_kommentarer'] = await App.getAntallKommentarer()
            res.status(200).send(statistikk)

        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    getAnbefalinger: async (req, res) => {
        try {
            const anbefalinger = await App.getAnbefalingerFraFrekvens()
            res.status(200).send(anbefalinger)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },

    hentVegginnlegg: async (req, res) => {
        try {
            const innlegg_id = (req.params.id === 'undefined') ? null : req.params.id
            const user_id = res.locals.user_id
            const innlegg = await App.hentVegginnleggFraDB(innlegg_id)
            const innlegg_ider = await App.hentAlleInnleggIDerFraDB()
            if (innlegg_ider.length > 0) {
                const innlegg_sett = innlegg_ider.map(innlegg => [innlegg.innlegg_id, user_id])
                await App.settInnleggSomSettDB(innlegg_sett)
            }
            res.status(200).send(innlegg)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    hentAntallUsetteVegginnlegg: async (req, res) => {
        try {
            const user_id = res.locals.user_id
            const usette_innlegg = await App.hentAntallUsetteVegginnleggFraDB(user_id)
            res.status(200).send(usette_innlegg)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    postNyttVegginnlegg: async (req, res) => {

        const parent_id = req.body.parent_id
        const user_id = res.locals.user_id
        const innhold = req.body.innhold
        if (innhold.length > 1000) {
            return res.status(400).send(msg.veggen.max_size)
        }
        try {
            await App.leggInnleggTilDB(parent_id, user_id, innhold)
            res.status(200).send(msg.veggen.innlegg_lagt_til)
            await App.sendNotificationsAfterWallPost(parent_id, user_id)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    endreVegginnlegg: async (req, res) => {
        try {
            const user_id = res.locals.user_id
            const innlegg_id = req.params.id
            const endret_innhold = req.body.endret_innhold
            await App.endreInnleggDB(innlegg_id, user_id, endret_innhold)
            res.status(200).send(msg.veggen.innlegg_endret)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    deleteVegginnlegg: async (req, res) => {
        try {
            const user_id = res.locals.user_id
            const innlegg_id = req.params.id
            let innlegg = await App.getSingleVegginnleggFraDB(innlegg_id)
            console.log(innlegg)
            if (innlegg.har_svar) {
                await App.endreInnleggDB(innlegg_id, user_id, "***Slettet av bruker / 投稿者により削除されました***")
            } else {
                await App.deleteInnleggDB(innlegg_id, user_id)
            }
            res.status(200).send(msg.veggen.innlegg_slettet)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    }
}