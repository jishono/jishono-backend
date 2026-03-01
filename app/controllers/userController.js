const User = require("../services/userService")
const App = require("../services/appService")
const msg = require('../locale/msg.json')

module.exports = {
    getBruker: async (req, res) => {
        const user_id = res.locals.user_id
        const brukerdata = await User.getBrukerdataFraDB(user_id)
        res.status(200).send(brukerdata)
    },
    loggInn: async (req, res) => {
        console.log(req.body.username + " forsøker å logge inn...")

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
    },

    registrerBruker: async (req, res) => {
        const ny_brukerdata = req.body
        const validert = User.validerNyBrukerdata(ny_brukerdata)

        if (!validert.gyldig) {
            return res.status(validert.status).send(validert.melding)
        }
        await User.opprettBrukerDB(ny_brukerdata)
        await App.sendEpost(ny_brukerdata.email, 'Velkommen til baksida.jisho.no', 'velkommen.ejs', 'admin@jisho.no', { brukernavn: ny_brukerdata.username })
        res.status(201).send(msg.user.registrer.ok)
    },
    updateBrukerdata: async (req, res) => {
        const user_id = res.locals.user_id
        const gammelt_passord = req.body.gammelt_passord
        const nytt_passord = req.body.nytt_passord
        const epost = req.body.epost
        const locale = req.body.locale
        const oppdateringer = req.body.oppdateringer
        let message = msg.user.profil.oppdatert

        const korrekt_passord = await User.sjekkPassordMedID(gammelt_passord, user_id)
        if (!korrekt_passord) {
            return res.status(401).send(msg.user.profil.feil_passord)
        }
        if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(epost)) {
            return res.status(400).send(msg.user.registrer.ugyldig_epost)
        }
        if (locale !== 'no' && locale !== 'jp') {
            return res.status(400).send(msg.user.profil.ugyldig_språk)
        }
        const valid_periods = [0, 1, 7, 14]
        if (!valid_periods.includes(oppdateringer.opp_periode)) {
            return res.status(400).send(msg.user.profil.ugyldig_periode)
        }
        if (nytt_passord != '') {
            if (nytt_passord.length < 6) {
                return res.status(400).send(msg.user.registrer.ugyldig_passord)
            }
            await User.updatePassordDB(user_id, nytt_passord)
            message['no'] += msg.user.profil.passord_oppdatert['no']
            message['ja'] += msg.user.profil.passord_oppdatert['ja']
        }

        await User.updateLocaleDB(user_id, locale)
        await User.updateEpostDB(user_id, epost)
        await User.updateOppdateringerDB(user_id, oppdateringer)

        res.status(200).send(message)
    },
    updateLastSeen: async (req, res) => {
        const user_id = res.locals.user_id
        await User.updateLastSeenDB(user_id)
        res.status(200).send()
    },
    getAllUsers: async (req, res) => {
        const users = await User.getAllUserDataFromDB()
        res.status(200).send(users)
    },
}
