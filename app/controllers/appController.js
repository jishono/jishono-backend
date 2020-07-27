
const App = require("../services/appService")

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
            res.status(500).send("Kunne ikke hente statistikk")
        }
    },
    getAnbefalinger: async (req, res) => {
        try {
            const anbefalinger = await App.getAnbefalingerFraFrekvens()
            res.status(200).send(anbefalinger)
        } catch (error) {
            console.log(error)
            res.status(500).send("Noe gikk galt under henting av anbefalinger")
        }
    }
}