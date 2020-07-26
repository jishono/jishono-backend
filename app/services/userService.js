const db = require("../db/database")
const bcrypt = require('bcrypt');


module.exports = {
    krypterPassord: (passord) => {
        const kryptert_passord = bcrypt.hashSync(passord, 10)
        return kryptert_passord
    },
    sjekkPassord: async (passord, user_id) => {
        try {
            let user = await db.query('SELECT * FROM brukere WHERE user_id', [user_id])
            user = user[0]
            const passwordIsValid = bcrypt.compareSync(passord, user.passord_hash)
            console.log(passwordIsValid)
            return passwordIsValid
        } catch (error) {
            throw error
        }

    },
    getBrukerdataFraDB: async (user_id) => {
        const query = `SELECT user_id, brukernavn, epost, admin
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