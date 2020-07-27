const db = require("../db/database")
const Oppslag = require("../services/oppslagService")


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
      res.status(500).send("Kunne ikke hente oppslag")
    }
  },
  getKommentarer: async (req, res) => {
    const lemma_id = req.params.id
    try {
      const kommentarer = await Oppslag.hentOppslagKommentarerFraDB(lemma_id)
      res.status(200).send(kommentarer)
    } catch (error) {
      console.log(error)
      res.status(500).send("Kunne ikke hente kommentarer")
    }
  },
  searchOppslag: async (req, res) => {
  
    try {
      const treff = await Oppslag.sokOppslagMedQuery(req.query)
      res.status(200).send(treff)
    } catch (error) {
      console.log(error)
      res.status(500).send("Noe gikk galt")
    }
  },

  findBoyning: async (req, res) => {
    const id = req.params.id;
    try {
      const oppslag = await db.query('SELECT * FROM oppslag WHERE lemma_id = ?', [id])
      const boy_tabell = oppslag[0].boy_tabell + '_boy'
      const query = `SELECT * FROM ?? WHERE lemma_id = ?`
      const result = await db.query(query, [boy_tabell, id])
      res.status(200).send(result)
    } catch (error) {
      console.log(error)
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
        return res.status(500).send("Noe gikk galt under sletting av definisjoner")
      }
    }

    if (deldata.uttale.length > 0) {
      try {
        await Oppslag.slettUttaleFraDB(deldata.uttale)
      } catch (error) {
        console.log(error)
        return res.status(500).send("Noe gikk galt under sletting av uttaler")
      }
    }

    try {
      await Oppslag.oppdaterLeddOppslagDB(oppslag.ledd, oppslag.lemma_id)
    } catch (error) {
      console.log(error)
      return res.status(500).send("Noe gikk galt under oppdatering av ledd")
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
        return res.status(500).send("Noe gikk galt under oppdatering av definisjoner")
      }
    }

    if (uttale.length > 0) {
      try {
        await Oppslag.leggTilUttaleDB(uttale.map(ut => [ut.uttale_id, lemma_id, ut.transkripsjon]))

      } catch (error) {
        console.log(error)
        return res.status(500).send("Noe gikk galt under oppdatering av uttale")
      }
    }
    console.log(ny_kommentar)
    if (ny_kommentar) {
      try {
        await Oppslag.leggTilOppslagKommentarDB(lemma_id, user_id, ny_kommentar)
      } catch (error) {
        console.log(error)
        return res.status(500).send("Noe gikk galt under oppretting av ny kommentar")
      }
    }
    res.status(200).send("Oppdatert!")
  }
}