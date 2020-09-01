const cron = require("node-cron");
const User = require("../services/userService")
const App = require("../services/appService");
const moment = require("moment")

async function getAllDataForDigest (user_id, periode) {
    const ulest = await User.getUlestOversiktFraDB(user_id)
    const aktiviteter = await User.getAktiviteterSistePeriode(user_id, periode)
    let data = {}
    data['ulest'] = ulest
    data['aktiviteter'] = aktiviteter

    return data
}

module.exports = {
    digestEmails: async () => {
        cron.schedule("0 17 * * *", async () => {
            const users = await User.getUserEmailByPeriod(1)
            for (user of users) {
                let data = await getAllDataForDigest(user.user_id, 1)
                data['tid'] = 'den siste dagen'
                data['brukernavn'] = user.brukernavn
                await App.sendEpost(user.epost, "Siste aktiviteter på Baksida", 'aktivitet.ejs','admin@jisho.no', data)
            }
        })

        cron.schedule("0 18 * * 0", async () => {
            const users = await User.getUserEmailByPeriod(7)
            for (user of users) {
                let data = await getAllDataForDigest(user.user_id, 7)
                data['tid'] = 'de siste 7 dagene'
                data['brukernavn'] = user.brukernavn
                await App.sendEpost(user.epost, "Siste aktiviteter på Baksida", 'aktivitet.ejs', 'admin@jisho.no', data)
            }
        })

        cron.schedule("0 19 * * 0", async () => {
            if (moment().format('W') % 2 == 1) {
                const users = await User.getUserEmailByPeriod(14)
                for (user of users) {
                    let data = await getAllDataForDigest(user.user_id, 14)
                    data['tid'] = 'de siste 14 dagene'
                    data['brukernavn'] = user.brukernavn
                    await App.sendEpost(user.epost, "Siste aktiviteter på Baksida", 'aktivitet.ejs', 'admin@jisho.no', data)
                }
            }
        })
    }
}