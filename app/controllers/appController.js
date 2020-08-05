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
    }
}