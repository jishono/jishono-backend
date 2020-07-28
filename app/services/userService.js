const db = require("../db/database")
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require("../config/config")

module.exports = {
    krypterPassord: (passord) => {
        const kryptert_passord = bcrypt.hashSync(passord, 10)
        return kryptert_passord
    },
    sjekkPassordMedID: async (passord, user_id) => {
        try {
            let user = await db.query('SELECT * FROM brukere WHERE user_id = ?', [user_id])
            user = user[0]
            const passord_gyldig = bcrypt.compareSync(passord, user.passord_hash)
            return passord_gyldig
        } catch (error) {
            throw error
        }

    },
    sjekkPassordBcrypt: (passord, passord_hash) => {
        return bcrypt.compareSync(passord, passord_hash)
    },
    hentBrukerMedBrukernavn: async (brukernavn) => {
        const query = `SELECT * FROM brukere WHERE brukernavn = ?`

        return await db.query(query, [brukernavn.toLowerCase()])
    },
    oppdaterSistInnlogget: async (user_id) => {
        const query = `UPDATE brukere 
                        SET sist_innlogget = CURRENT_TIMESTAMP 
                        WHERE user_id = ?`
        try {
            await db.query(query, [user_id])
        } catch (error) {
            throw error
        }
    },
    genererJWT: (bruker) => {
        const token = jwt.sign({ user: bruker.brukernavn, user_id: bruker.user_id, admin: bruker.admin, locale: bruker.locale }, config.jwt.secret, {
            expiresIn: '30d'
        })
        return token
    },
    validerNyBrukerdata: (ny_brukerdata) => {
        if (ny_brukerdata.check.toLowerCase() != 'elleve') {
            return { gyldig: false, status: 401, melding: 'Feil svar' }
        }
        const email = ny_brukerdata.email
        if (!email) {
            return { gyldig: false, status: 400, melding: 'E-post-adresse mangler' }
        }
        if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
            return { gyldig: false, status: 400, melding: 'Ugyldig e-post-adresse' }
        }

        const username = ny_brukerdata.username
        if (!username) {
            return { gyldig: false, status: 400, melding: 'Fornavn mangler' }
        }
        if (username.length < 6 && username.length < 13) {
            return { gyldig: false, status: 400, melding: 'Ugyldig brukernavn. Brukernavnet må være mellom 6 og 12 tegn' }
        }

        const password = ny_brukerdata.password
        if (!password) {
            return { gyldig: false, status: 400, melding: 'Passord mangler' }
        }
        if (password.length < 6) {
            return { gyldig: false, status: 400, melding: 'Ugyldig passord. Passordet må ha 6 tegn eller mer' }
        }
        return { gyldig: true }
    },
    opprettBrukerDB: async (ny_brukerdata) => {
        ny_brukerdata["password"] = module.exports.krypterPassord(ny_brukerdata['password'])

        const query = `INSERT INTO brukere (brukernavn, epost, passord_hash, admin)
                        VALUES (?, ?, ?, FALSE)`
        try {
            await db.query(query, [[ny_brukerdata.username.toLowerCase()], [ny_brukerdata.email.toLowerCase()], [ny_brukerdata.password]])
        } catch (error) {
            throw error
        }
    },
    getBrukerdataFraDB: async (user_id) => {
        const query = `SELECT user_id, brukernavn, epost, locale, admin
                        FROM brukere
                        WHERE user_id = ?`
        try {
            const brukerdata = await db.query(query, [user_id])
            return brukerdata[0]
        } catch (error) {
            throw error
        }
    },
    updateEpostDB: async (user_id, epost) => {

        const query = `UPDATE brukere
                    SET epost = ?
                    WHERE user_id = ?`
        try {
            await db.query(query, [epost, user_id])
        } catch (error) {
            throw error
        }
    },
    updateLocaleDB: async (user_id, locale) => {

        const query = `UPDATE brukere
                    SET locale = ?
                    WHERE user_id = ?`
        try {
            await db.query(query, [locale, user_id])
        } catch (error) {
            throw error
        }
    },
    updatePassordDB: async (user_id, nytt_passord) => {
        const kryptert_passord = module.exports.krypterPassord(nytt_passord)

        const query = `UPDATE brukere
                        SET passord_hash = ?
                        WHERE user_id = ?`
        try {
            await db.query(query, [kryptert_passord, user_id])
        } catch (error) {
            throw error
        }
    }
}