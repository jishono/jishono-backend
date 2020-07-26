const User = require("../services/userService")

module.exports = {
    getBruker: async (req, res) => {
        const user_id = res.locals.user_id

        const brukerdata = await User.getBrukerdataFraDB(user_id)
        console.log(brukerdata)
        res.status(200).send(brukerdata)

    },
    updateBrukerdata: async (req, res) => {
        const user_id = res.locals.user_id
        const gammelt_passord = req.body.gammelt_passord
        const nytt_passord = req.body.nytt_passord
        const epost = req.body.epost
        let message = 'Profil oppdatert.'

        try {
            const korrekt_passord = await User.sjekkPassord(gammelt_passord, user_id)
            if (!korrekt_passord) {
                return res.status(401).send("Feil passord")
            }
            if (nytt_passord != '') {
                if (nytt_passord.length < 6) {
                    return res.status(400).send('Ugyldig passord. Passordet må ha 6 tegn eller mer')
                }
                await User.updatePassordDB(user_id, nytt_passord)
                message += ' Nytt passord registrert.'
            }
            if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(epost)) {
                return res.status(400).send('Ugyldig e-post-adresse')
            }
            await User.updateEpostDB(user_id, epost)
            res.status(200).send(message)
        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke oppdatere profildata.")
        }

    }
}