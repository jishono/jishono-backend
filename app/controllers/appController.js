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
    getAlleVeggeninnlegg: async (req, res) => {
        try {
            const innlegg = await App.hentAlleVegginnleggFraDB()
            res.status(200).send(innlegg)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
    postNyttVeggeninnlegg: async (req, res) => {

        const parent_id = req.body.parent_id
        const user_id = res.locals.user_id
        const innhold = req.body.innhold

        try {
            await App.leggInnleggTilDB(parent_id, user_id, innhold)
            res.status(200).send(msg.veggen.innlegg_lagt_til)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }
    },
}