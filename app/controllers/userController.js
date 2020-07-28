const User = require("../services/userService")

module.exports = {
    getBruker: async (req, res) => {
        const user_id = res.locals.user_id

        const brukerdata = await User.getBrukerdataFraDB(user_id)
        console.log(brukerdata)
        res.status(200).send(brukerdata)

    },
    loggInn: async (req, res) => {
        console.log(req.body.username + " trying to log in...")

        try {
            let bruker = await User.hentBrukerMedBrukernavn(req.body.username)

            if (bruker.length === 0) {
                return res.status(401).send('Feil brukernavn eller passord')
            }
            bruker = bruker[0]
            const passord_gyldig = User.sjekkPassordBcrypt(req.body.password, bruker.passord_hash)
            if (!passord_gyldig || !bruker) {
                return res.status(401).send('Feil brukernavn eller passord')
            }
            const token = User.genererJWT(bruker)
            await User.oppdaterSistInnlogget(bruker.user_id)
            res.status(200).send({ auth: true, token: token, user_id: bruker.user_id, username: bruker.brukernavn, admin: bruker.admin, locale: bruker.locale });
        } catch (error) {
            console.log(error)
            res.status(500).send("Noe gikk galt under innlogging")
        }
    },

    registrerBruker: async (req, res) => {
        try {
            const ny_brukerdata = req.body
            const validert = User.validerNyBrukerdata(ny_brukerdata)

            if (!validert.gyldig) {
                return res.status(validert.status).send(validert.melding)
            }
            await User.opprettBrukerDB(ny_brukerdata)
            res.status(201).send("Bruker opprettet. Du kan nå logge inn.")
        } catch (error) {
            console.log(error)
            if (error.errno === 1062) {
                res.status(500).send("Brukernavn eller e-post finnes allerede i systemet")
            } else {
                res.status(500).send("Noe gikk galt")
            }
        }
    },
    updateBrukerdata: async (req, res) => {
        const user_id = res.locals.user_id
        const gammelt_passord = req.body.gammelt_passord
        const nytt_passord = req.body.nytt_passord
        const epost = req.body.epost
        const locale = req.body.locale
        let message = 'Profil oppdatert.'

        try {
            const korrekt_passord = await User.sjekkPassordMedID(gammelt_passord, user_id)
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
            
            if (!locale == 'no' || !locale == 'jp') {
                return res.status(400).send('Ugyldig språkvalg.')
            }
            await User.updateLocaleDB(user_id, locale)

            res.status(200).send(message)
        } catch (error) {
            console.log(error)
            res.status(500).send("Kunne ikke oppdatere profildata.")
        }

    }
}