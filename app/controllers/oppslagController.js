const db = require("../db/database")
const Oppslag = require("../services/oppslagService")
const App = require("../services/appService")
const msg = require('../locale/msg.json')
const { searchByQuery } = require("../services/oppslagService")
const oppslagService = require("../services/oppslagService")

module.exports = {
  getOppslag: async (req, res) => {
    const lemma_id = req.params.id
    try {
      let oppslag = await Oppslag.hentOppslagFraDB(lemma_id)
      oppslag = oppslag[0]
      oppslag['kommentarer'] = await Oppslag.hentOppslagKommentarerFraDB(lemma_id)
      res.status(200).send(oppslag)
    } catch (error) {
      console.log(error)
      res.status(500).send(msg.generell_error)
    }
  },
  getKommentarer: async (req, res) => {
    const lemma_id = req.params.id
    try {
      const kommentarer = await Oppslag.hentOppslagKommentarerFraDB(lemma_id)
      res.status(200).send(kommentarer)
    } catch (error) {
      console.log(error)
      res.status(500).send(msg.generell_error)
    }
  },
  searchOppslag: async (req, res) => {
    try {
      const treff = await Oppslag.sokOppslagMedQuery(req.query)
      res.status(200).send(treff)
    } catch (error) {
      console.log(error)
      res.status(500).send(msg.generell_error)
    }
  },
  getSuggestionList: async (req, res) => {
    try {
      const searchWord = req.query.q
      const suggestions = await Oppslag.getSuggestionListFromDB(searchWord)
      res.status(200).send(suggestions)
    } catch (error) {
      console.log(error)
      res.status(500).send(msg.generell_error)
    }
  },

  searchDiscord: async (req, res) => {
    const searchQuery = req.params.query
    try {
      const results = await Oppslag.searchByQuery(searchQuery)

      //Foreløpig fjerna
      /* for (result of results) {
        let conjugations = await Oppslag.getFlatConjugationsFromDB(result.lemma_id)
        let example_sentences = await Oppslag.getExampleSentencesFromDB(conjugations)
        result['example_sentences'] = example_sentences
      } */

      res.status(200).send(results)
    } catch (error) {
      console.log(error)
      res.status(500).send(msg.generell_error)
    }
  },

  getAllItems: async (req, res) => {
    try {
      await App.registerVisit()
      const results = await Oppslag.getAllItemsFromDB()
      res.status(200).send(results)
    } catch (error) {
      console.log(error)
      res.status(500).send(msg.generell_error)
    }
  },

  getConjugations: async (req, res) => {
    const lemma_id = req.params.id;
    const pos = req.body.pos
    const table = pos + '_boy'
    try {
      const conjugations = await Oppslag.getConjugationsFromDB(lemma_id, table)
      res.status(200).send(conjugations)
    } catch (error) {
      console.log(error)
      res.status(500).send(msg.generell_error)
    }
  },

  getExampleSentences: async (req, res) => {
    const lemma_id = req.params.id;
    try {
      const conjugations = await Oppslag.getFlatConjugationsFromDB(lemma_id)
      const example_sentences = await Oppslag.getExampleSentencesFromDB(conjugations)
      res.status(200).send(example_sentences)
    } catch (error) {
      console.log(error)
      res.status(500).send(msg.generell_error)
    }
  },

  findBoyning: async (req, res) => {
    const lemma_id = req.params.id;
    try {
      const oppslag = await db.query('SELECT * FROM oppslag WHERE lemma_id = $1', [lemma_id])
      const boy_tabell = oppslag[0].boy_tabell + '_boy'
      const query = `SELECT * FROM ${boy_tabell} WHERE lemma_id = $1`
      const result = await db.query(query, [lemma_id])
      res.status(200).send(result)
    } catch (error) {
      console.log(error)
      res.status(500).send(msg.generell_error)
    }
  },

  oppdaterOppslag: async (req, res) => {
    const lemma_id = req.params.id;
    const user_id = res.locals.user_id
    const uttale = req.body.oppslag.uttale
    const defs = req.body.oppslag.definisjon
    const ny_kommentar = req.body.oppslag.ny_kommentar
    const oppslag = req.body.oppslag
    const deldata = req.body.deldata

    if (deldata.def.length > 0) {
      try {
        await Oppslag.slettDefinisjonerFraDB(deldata.def)
      } catch (error) {
        console.log(error)
        return res.status(500).send(msg.generell_error)
      }
    }

    if (deldata.uttale.length > 0) {
      try {
        await Oppslag.slettUttaleFraDB(deldata.uttale)
      } catch (error) {
        console.log(error)
        return res.status(500).send(msg.generell_error)
      }
    }

    try {
      await Oppslag.oppdaterOppslagDB(oppslag.ledd, oppslag.skjult, oppslag.lemma_id)
    } catch (error) {
      console.log(error)
      return res.status(500).send(msg.generell_error)
    }
    let pri = 1
    if (defs.length > 0) {
      try {
        defs.forEach(def => {
          def.prioritet = pri
          pri++
        })

        await Oppslag.leggTilDefinisjonDB(defs.map(def => [def.def_id, def.lemma_id, def.prioritet, def.definisjon, user_id]))

      } catch (error) {
        console.log(error)
        return res.status(500).send(msg.generell_error)
      }
    }

    if (uttale.length > 0) {
      try {
        await Oppslag.leggTilUttaleDB(uttale.map(ut => [ut.uttale_id, lemma_id, ut.transkripsjon]))

      } catch (error) {
        console.log(error)
        return res.status(500).send(msg.generell_error)
      }
    }
    if (ny_kommentar) {
      try {
        await Oppslag.leggTilOppslagKommentarDB(lemma_id, user_id, ny_kommentar)
      } catch (error) {
        console.log(error)
        return res.status(500).send(msg.generell_error)
      }
    }
    res.status(200).send(msg.oppdatert)
  },


  addWordSuggestion: async (req, res) => {
    const userID = res.locals.user_id
    const { word, wordClass, parts } = req.body
    try {
      if (word !== '' && wordClass !== '') {
        await oppslagService.addWordSuggestionToDB(word, wordClass, parts, userID)
      }
      res.status(200).send(msg.oppslag.forslag_opprettet)
    } catch (error) {
      console.log(error)
      return res.status(500).send(msg.generell_error)
    }

  },
  getWordSuggestion: async (req, res) => {
    const wordID = req.params.id
    try {
      const wordSuggestion = await oppslagService.getWordSuggestionFromDB(wordID)
      res.status(200).send(wordSuggestion)
    } catch (error) {
      console.log(error)
      return res.status(500).send(msg.generell_error)
    }

  },
  getAllWordSuggestions: async (req, res) => {
    try {
      const wordSuggestions = await oppslagService.getAllWordSuggestionsFromDB()
      res.status(200).send(wordSuggestions)
    } catch (error) {
      console.log(error)
      return res.status(500).send(msg.generell_error)
    }

  },
  acceptWordSuggestion: async (req, res) => {
    const wordSuggestionID = req.params.id
    const conjugations = req.body.conjugations
    const { word, wordClass, parts } = req.body
    try {
      const newWordID = await oppslagService.addWordToDB(word, wordClass, parts)
      await oppslagService.setWordSuggestionsStatus(wordSuggestionID, 1)
      if (['adj', 'adv', 'det', 'pron', 'subst', 'verb'].includes(wordClass)) {
        const insertTable = wordClass + '_boy'
        await oppslagService.addConjugationToDB(newWordID, insertTable, conjugations)
      }
      res.status(200).send(msg.oppslag.opprettet)
    } catch (error) {
      console.log(error)
      return res.status(500).send(msg.generell_error)
    }
  },
  rejectWordSuggestion: async (req, res) => {
    const wordSuggestionID = req.params.id
    try {
      await oppslagService.setWordSuggestionsStatus(wordSuggestionID, 2)
      res.status(200).send(msg.oppslag.avvist)
    } catch (error) {
      console.log(error)
      return res.status(500).send(msg.generell_error)
    }
  }
}