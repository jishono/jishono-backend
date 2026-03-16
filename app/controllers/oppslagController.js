const db = require("../db/database")
const Oppslag = require("../services/oppslagService")
const App = require("../services/appService")
const msg = require('../locale/msg.json')
const { searchByQuery } = require("../services/oppslagService")
const oppslagService = require("../services/oppslagService")
const { ALLOWED_BOY_TABLES } = require("../constants/boyning")

module.exports = {
  getOppslag: async (req, res) => {
    const lemma_id = req.params.id
    const result = await Oppslag.hentOppslagFraDB(lemma_id, res.locals.user_id)
    const oppslag = result[0]
    if (!oppslag) return res.status(404).send(msg.generell_error)
    oppslag['kommentarer'] = await Oppslag.hentOppslagKommentarerFraDB(lemma_id)
    res.status(200).send(oppslag)
  },
  getKommentarer: async (req, res) => {
    const lemma_id = req.params.id
    const user_id = res.locals.user_id
    const kommentarer = await Oppslag.hentOppslagKommentarerFraDB(lemma_id)
    if (kommentarer.length > 0) {
      const kommentarer_sett = kommentarer.map(k => [k.oppslag_kommentar_id, user_id])
      await Oppslag.settOppslagKommentarerSomSettDB(kommentarer_sett)
    }
    res.status(200).send(kommentarer)
  },
  searchOppslag: async (req, res) => {
    const treff = await Oppslag.sokOppslagMedQuery(req.query)
    res.status(200).send(treff)
  },
  getAiTranslations: async (req, res) => {
    const hasApprovals = req.query.has_approvals === 'true'
    const results = await Oppslag.getRandomAiTranslationsFromDB(res.locals.user_id, 50, hasApprovals)
    res.status(200).send(results)
  },
  getSuggestionList: async (req, res) => {
    const searchWord = req.query.q
    const suggestions = await Oppslag.getSuggestionListFromDB(searchWord)
    res.status(200).send(suggestions)
  },

  searchDiscord: async (req, res) => {
    const searchQuery = req.params.query
    const results = await Oppslag.searchByQuery(searchQuery)

    //Foreløpig fjerna
    /* for (result of results) {
      let conjugations = await Oppslag.getFlatConjugationsFromDB(result.lemma_id)
      let example_sentences = await Oppslag.getExampleSentencesFromDB(conjugations)
      result['example_sentences'] = example_sentences
    } */

    res.status(200).send(results)
  },

  searchOppslag: async (req, res) => {
    const q = req.query.q || null
    const results = await Oppslag.searchOppslag(q)
    res.status(200).send(results)
  },

  getConjugations: async (req, res) => {
    const lemma_id = req.params.id;
    const pos = req.body.pos;

    // Allow only known parts-of-speech to control the table name
    const allowedPosToTable = {
      adj: 'adj_boy',
      adv: 'adv_boy',
      det: 'det_boy',
      pron: 'pron_boy',
      subst: 'subst_boy',
      verb: 'verb_boy',
    };

    if (typeof pos !== 'string' || !(pos in allowedPosToTable)) {
      console.log('Invalid pos value in getConjugations:', pos);
      return res.status(400).send(msg.generell_error);
    }

    const table = allowedPosToTable[pos];
    const conjugations = await Oppslag.getConjugationsFromDB(lemma_id, table)
    res.status(200).send(conjugations)
  },

  getExampleSentences: async (req, res) => {
    const lemma_id = req.params.id;
    const example_sentences = await Oppslag.getExampleSentencesFromDB(lemma_id)
    res.status(200).send(example_sentences)
  },

  findBoyning: async (req, res) => {
    const lemma_id = req.params.id;
    const oppslag = await db.query('SELECT * FROM oppslag WHERE lemma_id = $1', [lemma_id])
    const boy_tabell = oppslag[0].boy_tabell + '_boy'
    if (!ALLOWED_BOY_TABLES.includes(boy_tabell)) {
      return res.status(400).send(msg.generell_error)
    }
    const query = `SELECT * FROM ${boy_tabell} WHERE lemma_id = $1`
    const result = await db.query(query, [lemma_id])
    res.status(200).send(result)
  },

  oppdaterOppslag: async (req, res) => {
    console.log(`[AUDIT] user=${res.locals.user_id} action=oppdaterOppslag lemma_id=${req.params.id}`)
    const lemma_id = req.params.id;
    const { uttale, ledd, is_hidden } = req.body

    await Oppslag.oppdaterOppslagDB(ledd, is_hidden, lemma_id)
    await Oppslag.setUttaleForLemmaDB(lemma_id, uttale ?? [])

    res.status(200).send(msg.oppdatert)
  },

  createDefinisjon: async (req, res) => {
    const lemma_id = req.params.id
    const { definisjon, prioritet } = req.body
    const result = await Oppslag.writeDefinisjonToDB(lemma_id, definisjon, prioritet, res.locals.user_id)
    res.status(201).send(result)
  },

  removeDefinisjon: async (req, res) => {
    const def_id = req.params.def_id
    await Oppslag.deleteDefinisjonInDB(def_id)
    res.status(200).send(msg.oppdatert)
  },

  reorderDefinisjoner: async (req, res) => {
    const { def_ids } = req.body
    await Oppslag.reorderDefinisjonerInDB(def_ids)
    res.status(200).send(msg.oppdatert)
  },

  updateDefinisjon: async (req, res) => {
    const def_id = req.params.def_id
    const { definisjon, prioritet } = req.body
    await Oppslag.updateDefinisjonInDB(def_id, definisjon, prioritet)
    res.status(200).send(msg.oppdatert)
  },

  postOppslagKommentar: async (req, res) => {
    const lemma_id = req.params.id
    const user_id = res.locals.user_id
    const ny_kommentar = req.body.ny_kommentar
    await Oppslag.leggTilOppslagKommentarDB(lemma_id, user_id, ny_kommentar)
    res.status(200).send(msg.kommentarer.lagt_til)
    await App.sendNotificationsAfterComment(lemma_id, user_id)
  },

  addWordSuggestion: async (req, res) => {
    const userID = res.locals.user_id
    const { word, wordClass, parts } = req.body
    const validWordClasses = ['adj', 'adv', 'det', 'egennavn', 'forkorting', 'interjeksjon',
      'konjunksjon', 'prefiks', 'preposisjon', 'pron', 'subst', 'subjunksjon', 'verb', 'symbol']
    if (!word || word.trim() === '') {
      return res.status(400).send(msg.generell_error)
    }
    if (!validWordClasses.includes(wordClass)) {
      return res.status(400).send(msg.generell_error)
    }
    await oppslagService.addWordSuggestionToDB(word, wordClass, parts, userID)
    res.status(201).send(msg.oppslag.forslag_opprettet)
  },
  getWordSuggestion: async (req, res) => {
    const wordID = req.params.id
    const wordSuggestion = await oppslagService.getWordSuggestionFromDB(wordID)
    res.status(200).send(wordSuggestion)
  },
  getAllWordSuggestions: async (req, res) => {
    const wordSuggestions = await oppslagService.getAllWordSuggestionsFromDB()
    res.status(200).send(wordSuggestions)
  },
  acceptWordSuggestion: async (req, res) => {
    console.log(`[AUDIT] user=${res.locals.user_id} action=acceptWordSuggestion id=${req.params.id}`)
    const wordSuggestionID = req.params.id
    const conjugations = req.body.conjugations
    const { word, wordClass, parts } = req.body
    const newWordID = await oppslagService.addWordToDB(word, wordClass, parts)
    await oppslagService.setWordSuggestionsStatus(wordSuggestionID, 1)
    if (['adj', 'adv', 'det', 'pron', 'subst', 'verb'].includes(wordClass)) {
      const insertTable = wordClass + '_boy'
      await oppslagService.addConjugationToDB(newWordID, insertTable, conjugations)
    }
    res.status(200).send(msg.oppslag.opprettet)
  },
  rejectWordSuggestion: async (req, res) => {
    console.log(`[AUDIT] user=${res.locals.user_id} action=rejectWordSuggestion id=${req.params.id}`)
    const wordSuggestionID = req.params.id
    await oppslagService.setWordSuggestionsStatus(wordSuggestionID, 2)
    res.status(200).send(msg.oppslag.avvist)
  }
}
