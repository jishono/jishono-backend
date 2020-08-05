const User = require("../services/userService")
const msg = require('../locale/msg.json')

module.exports = {
    getBruker: async (req, res) => {
        const user_id = res.locals.user_id

        const brukerdata = await User.getBrukerdataFraDB(user_id)
        console.log(brukerdata)
        res.status(200).send(brukerdata)

    },
    loggInn: async (req, res) => {
        console.log(req.body.username + " forsøker å logge inn...")

        try {
            let bruker = await User.hentBrukerMedBrukernavn(req.body.username)

            if (bruker.length === 0) {
                return res.status(401).send(msg.user.logg_inn_error)
            }
            bruker = bruker[0]
            const passord_gyldig = User.sjekkPassordBcrypt(req.body.password, bruker.passord_hash)
            if (!passord_gyldig || !bruker) {
                return res.status(401).send(msg.user.logg_inn_error)
            }
            const token = User.genererJWT(bruker)
            await User.oppdaterSistInnlogget(bruker.user_id)
            res.status(200).send({ auth: true, token: token, user_id: bruker.user_id, username: bruker.brukernavn, admin: bruker.admin, locale: bruker.locale });
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
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
            res.status(201).send(msg.user.registrer.ok)
        } catch (error) {
            console.log(error)
            if (error.errno === 1062) {
                res.status(500).send(msg.user.registrer.finnes)
            } else {
                res.status(500).send(msg.generell_error)
            }
        }
    },
    updateBrukerdata: async (req, res) => {
        const user_id = res.locals.user_id
        const gammelt_passord = req.body.gammelt_passord
        const nytt_passord = req.body.nytt_passord
        const epost = req.body.epost
        const locale = req.body.locale
        let message = msg.user.profil.oppdatert
        console.log(message)

        try {
            const korrekt_passord = await User.sjekkPassordMedID(gammelt_passord, user_id)
            if (!korrekt_passord) {
                return res.status(401).send(msg.user.profil.feil_passord)
            }
            if (nytt_passord != '') {
                if (nytt_passord.length < 6) {
                    return res.status(400).send(msg.user.registrer.ugyldig_passord)
                }
                await User.updatePassordDB(user_id, nytt_passord)
                message['no'] += msg.user.profil.passord_oppdatert['no']
                message['ja'] += msg.user.profil.passord_oppdatert['ja']
            }
            if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(epost)) {
                return res.status(400).send(msg.user.registrer.ugyldig_epost)
            }
            await User.updateEpostDB(user_id, epost)
            
            if (!locale == 'no' || !locale == 'jp') {
                return res.status(400).send(msg.user.profil.ugyldig_språk)
            }
            await User.updateLocaleDB(user_id, locale)

            res.status(200).send(message)
        } catch (error) {
            console.log(error)
            res.status(500).send(msg.generell_error)
        }

    }
}