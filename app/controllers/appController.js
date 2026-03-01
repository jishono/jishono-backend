const App = require("../services/appService")
const db = require("../db/database.js")
const msg = require('../locale/msg.json')

module.exports = {
    getHealth: async (req, res) => {
        try {
            await db.query('SELECT 1');
            res.status(200).json({ status: 'ok' });
        } catch (error) {
            res.status(503).json({ status: 'error', message: error.message });
        }
    },
    getStatistikk: async (req, res) => {
        let statistikk = {}
        statistikk['brukeroversettelser'] = await App.getBrukeroversettelser()
        statistikk['oppslag_info'] = await App.getOppslagInfo()
        statistikk['nye_oversettelser'] = await App.getNyeOversettelser()
        statistikk['nye_forslag'] = await App.getNyeForslag()
        statistikk['antall_kommentarer'] = await App.getAntallKommentarer()
        statistikk['translated_by_day'] = await App.getWordsWithTranslationsByDay()
        res.status(200).send(statistikk)
    },
    getAnbefalinger: async (req, res) => {
        const anbefalinger = await App.getAnbefalingerFraFrekvens()
        res.status(200).send(anbefalinger)
    },

    hentVegginnlegg: async (req, res) => {
        const innlegg_id = (req.params.id === 'undefined') ? null : req.params.id
        const user_id = res.locals.user_id
        const innlegg = await App.hentVegginnleggFraDB(innlegg_id)
        const innlegg_ider = await App.hentAlleInnleggIDerFraDB()
        if (innlegg_ider.length > 0) {
            const innlegg_sett = innlegg_ider.map(innlegg => [innlegg.innlegg_id, user_id])
            await App.settInnleggSomSettDB(innlegg_sett)
        }
        res.status(200).send(innlegg)
    },
    hentAntallUsetteVegginnlegg: async (req, res) => {
        const user_id = res.locals.user_id
        const usette_innlegg = await App.hentAntallUsetteVegginnleggFraDB(user_id)
        res.status(200).send(usette_innlegg)
    },
    postNyttVegginnlegg: async (req, res) => {
        const parent_id = req.body.parent_id
        const user_id = res.locals.user_id
        const innhold = req.body.innhold
        if (innhold.length > 1000) {
            return res.status(400).send(msg.veggen.max_size)
        }
        await App.leggInnleggTilDB(parent_id, user_id, innhold)
        res.status(200).send(msg.veggen.innlegg_lagt_til)
        await App.sendNotificationsAfterWallPost(parent_id, user_id)
    },
    endreVegginnlegg: async (req, res) => {
        const user_id = res.locals.user_id
        const innlegg_id = req.params.id
        const endret_innhold = req.body.endret_innhold
        await App.endreInnleggDB(innlegg_id, user_id, endret_innhold)
        res.status(200).send(msg.veggen.innlegg_endret)
    },
    deleteVegginnlegg: async (req, res) => {
        const user_id = res.locals.user_id
        const innlegg_id = req.params.id
        let innlegg = await App.getSingleVegginnleggFraDB(innlegg_id)
        if (innlegg.har_svar) {
            await App.endreInnleggDB(innlegg_id, user_id, "***Slettet av bruker / 投稿者により削除されました***")
        } else {
            await App.deleteInnleggDB(innlegg_id, user_id)
        }
        res.status(200).send(msg.veggen.innlegg_slettet)
    },
    postFeedback: async (req, res) => {
        const lemma_id = req.params.id
        const feedback = req.body.feedback
        await App.writeFeedbackToDB(lemma_id, feedback)
        res.status(200).send("フィードバックを頂きました！")
    },
    postRequest: async (req, res) => {
        const request = req.body.request
        await App.writeRequestToDB(request)
        res.status(200).send("依頼を頂きました！")
    },
    getRequests: async (req, res) => {
        const requests = await App.getUntranslatedRequests()
        res.status(200).send(requests)
    },
    getPageVisits: async (req, res) => {
        const visits = await App.getPageVisitStatsFromDB()
        res.status(200).send(visits)
    },
}
