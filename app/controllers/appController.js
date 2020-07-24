
const config = require("../config/config")
const App = require("../services/appService")

module.exports = {
    getStatistikk: async (req, res) => {
        try {
            let statistikk = {}
            statistikk['brukeroversettelser'] = await App.getBrukeroversettelser()
            statistikk['oppslag_info'] = await App.getOppslagInfo()
            statistikk['nye_oversettelser'] = await App.getNyeOversettelser()
            res.status(200).send(statistikk)
            
        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke hente statistikk")
        }
    }
}