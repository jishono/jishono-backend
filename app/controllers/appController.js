
const config = require("../config/config")
const App = require("../services/appService")

module.exports = {
    getStatistikk: async (req, res) => {
        try {
            let statistikk = {}
            statistikk['brukeroversettelser'] = await App.getBrukeroversettelser()
            statistikk['oppslag_info'] = await App.getOppslagInfo()
            res.status(200).send(statistikk)
            
        } catch (error) {
            res.status(500).send("Kunne ikke hente statistikk")
        }
    }
}