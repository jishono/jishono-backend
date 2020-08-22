const db = require("../db/database")
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require("../config/config")
const msg = require('../locale/msg.json')


module.exports = {
    krypterPassord: (passord) => {
        const kryptert_passord = bcrypt.hashSync(passord, 10)
        return kryptert_passord
    },
    sjekkPassordMedID: async (passord, user_id) => {
        try {
            let user = await db.query('SELECT passord_hash FROM brukere WHERE user_id = ?', [user_id])
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
            return { gyldig: false, status: 401, melding: msg.user.registrer.feil_svar }
        }
        const email = ny_brukerdata.email
        if (!email) {
            return { gyldig: false, status: 400, melding: msg.user.registrer.mangler_epost }
        }
        if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
            return { gyldig: false, status: 400, melding: msg.user.registrer.ugyldig_epost }
        }

        const username = ny_brukerdata.username
        if (!username) {
            return { gyldig: false, status: 400, melding: msg.user.registrer.mangler_brukernavn }
        }
        if (username.length < 6 || username.length > 13 || !(/^[a-zæøå]+$/.test(username))) {
            return { gyldig: false, status: 400, melding: msg.user.registrer.ugyldig_brukernavn }
        }

        const password = ny_brukerdata.password
        if (!password) {
            return { gyldig: false, status: 400, melding: msg.user.registrer.mangler_passord }
        }
        if (password.length < 6) {
            return { gyldig: false, status: 400, melding: msg.user.registrer.ugyldig_passord }
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
        const query = `SELECT user_id, brukernavn, epost, locale, admin,
                        JSON_OBJECT('opp_periode', opp_periode,
                        'opp_kommentar_eget', opp_kommentar_eget, 'opp_svar', opp_svar) AS oppdateringer
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
    },
    updateOppdateringerDB: async (user_id, oppdateringer) => {
        const opp_periode = oppdateringer.opp_periode
        const opp_kommentar_eget = oppdateringer.opp_kommentar_eget
        const opp_svar = oppdateringer.opp_svar

        const query = `UPDATE brukere
                        SET opp_periode = ?, opp_kommentar_eget = ?, opp_svar = ?
                        WHERE user_id = ?`
        try {
            await db.query(query, [opp_periode, opp_kommentar_eget, opp_svar, user_id])
        } catch (error) {
            throw error
        }
    },
    getUlestOversiktFraDB: async (user_id) => {

        let ulest = {}
        const query1 = ` SELECT (SELECT COUNT(f.forslag_id) 
                        FROM forslag AS f
                        INNER JOIN forslag_kommentarer AS kf USING(forslag_id)
                        WHERE f.user_id = ?) 
                        -
                        (SELECT COUNT(f.forslag_id) 
                        FROM forslag AS f
                        INNER JOIN forslag_kommentarer AS kf USING(forslag_id)
                        INNER JOIN forslag_kommentarer_sett AS fks USING(forslag_kommentar_id)
                        WHERE f.user_id = ?
                        AND fks.user_id = ?)
                        AS antall
                        `
        let result = await db.query(query1, [user_id, user_id, user_id])
        ulest['kommentarer_egne'] = result[0]['antall']

        const query2 = ` WITH kommentarer AS (
                            SELECT DISTINCT f.forslag_id
                            FROM forslag AS f
                            INNER JOIN forslag_kommentarer AS fk USING(forslag_id) 
                            WHERE fk.user_id = ?)
                        
                        SELECT
                        (SELECT COUNT(*)
                        FROM kommentarer
                        INNER JOIN forslag_kommentarer USING (forslag_id)
                        )
                         -
                        (SELECT COUNT(*) 
                        FROM kommentarer
                        INNER JOIN forslag_kommentarer AS fk USING (forslag_id)
                        INNER JOIN forslag_kommentarer_sett AS fks USING (forslag_kommentar_id)
                        WHERE fks.user_id = ?
                        ) AS antall
                        `
        result = await db.query(query2, [user_id, user_id])
        ulest['svar_kommentarer'] = result[0]['antall']

        const query3 = ` SELECT (SELECT COUNT(*)
                        FROM veggen_innlegg)
                        -
                        (SELECT COUNT(*)
                        FROM veggen_innlegg
                        INNER JOIN veggen_innlegg_sett AS vis USING (innlegg_id)
                        WHERE vis.user_id = ?) AS antall
                        `
        result = await db.query(query3, [user_id])
        ulest['vegginnlegg'] = result[0]['antall']

        const query4 = ` SELECT COUNT(*) AS antall
                        FROM forslag AS f
                        LEFT OUTER JOIN stemmer AS s USING(forslag_id)
                        WHERE f.user_id != ?
                        AND f.status = 0
                        AND (s.user_id != ? OR s.user_id IS NULL)
                        `
        result = await db.query(query4, [user_id, user_id])
        ulest['forslag_ikke_stemt'] = result[0]['antall']

        return ulest
    },
    getAktiviteterSistePeriode: async (user_id, dager) => {

        let aktiviteter = {}
        const query1 = `SELECT COUNT(*) AS antall
                        FROM forslag
                        WHERE opprettet >= DATE_ADD(CURDATE(), INTERVAL -? DAY)
                        `
        let result = await db.query(query1, [dager])

        aktiviteter['nye_forslag'] = result[0]['antall']

        const query2 = `SELECT COUNT(*) AS antall
                        FROM forslag_kommentarer
                        WHERE opprettet >= DATE_ADD(CURDATE(), INTERVAL -? DAY)
                        `
        result = await db.query(query2, [dager])
        aktiviteter['nye_kommentarer'] = result[0]['antall']

        const query3 = `SELECT COUNT(*) AS antall
                        FROM definisjon
                        WHERE opprettet >= DATE_ADD(CURDATE(), INTERVAL -? DAY)
                        `
        result = await db.query(query3, [dager])
        aktiviteter['nye_oversettelser'] = result[0]['antall']

        const query4 = `SELECT COUNT(*) AS antall
                        FROM veggen_innlegg
                        WHERE opprettet >= DATE_ADD(CURDATE(), INTERVAL -? DAY)
                        `
        result = await db.query(query4, [dager])
        aktiviteter['nye_vegginnlegg'] = result[0]['antall']

        const query5 = `SELECT COUNT(*) AS antall
                        FROM stemmer
                        WHERE opprettet >= DATE_ADD(CURDATE(), INTERVAL -? DAY)
                        `
        result = await db.query(query5, [dager])
        aktiviteter['nye_stemmer'] = result[0]['antall']

        const query6 = `SELECT COUNT(*) AS antall
                        FROM stemmer AS s
                        INNER JOIN forslag AS f USING(forslag_id)
                        WHERE s.opprettet >= DATE_ADD(CURDATE(), INTERVAL -? DAY)
                        AND f.user_id = ?
                           `
        result = await db.query(query6, [dager, user_id])
        aktiviteter['nye_stemmer_eget_forslag'] = result[0]['antall']

        return aktiviteter
    },
    getUserEmailByPeriod: async (period) => {
        const query = `SELECT user_id, epost, brukernavn
                        FROM brukere
                        WHERE opp_periode = ?`

        const users = await db.query(query, [period])
        
        return users
    },
    updateLastSeenDB: async (user_id) => {
        const query = `UPDATE brukere
                        SET sist_sett = CURRENT_TIMESTAMP
                        WHERE user_id = ?`

        await db.query(query, [user_id])
        
    }
}