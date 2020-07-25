const db = require("../db/database")
const config = require("../config/config")
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

module.exports = {
  getOppslag: async (req, res) => {
    const lemma_id = req.params.id
    try {
      const query = `SELECT o.lemma_id, o.oppslag, o.ledd, o.boy_tabell, 
      (SELECT IFNULL(
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT('def_id', d.def_id,
                    'lemma_id', d.lemma_id,
                    'prioritet', d.prioritet,
                    'definisjon', d.definisjon                    
                    ))
        FROM definisjon AS d
        WHERE o.lemma_id = d.lemma_id),
        JSON_ARRAY())
        ) AS definisjon,
      (SELECT IFNULL(
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT('uttale_id',u.uttale_id,
                    'lemma_id', u.lemma_id,
                    'transkripsjon', u.transkripsjon
                    ))
         FROM uttale AS u 
         WHERE u.lemma_id = o.lemma_id),
         JSON_ARRAY())
         ) AS uttale
        
      FROM oppslag AS o
      WHERE o.lemma_id = ?`

      oppslag = await db.query(query, [lemma_id])
      res.status(200).send(oppslag[0])
    } catch (error) {
      console.log(error)
    }
  },
  getKommentarer: async (req, res) => {
    const lemma_id = req.params.id
    try {
      const query = `
        SELECT *
        FROM kommentar
        WHERE lemma_id = ?
        ORDER BY opprettet DESC`
      kommentarer = await db.query(query, [lemma_id])
      res.status(200).send(kommentarer)
    } catch (error) {
      console.log(error)
    }
  },
  searchOppslag: async (req, res) => {
    const q = req.query.q

    let meddef = (req.query.meddef == "true");
    let utendef = (req.query.utendef == "true");
    if (meddef == true & utendef == true) {
      meddef = false; utendef = false;
    }
    let medut = (req.query.medut == "true");
    let utenut = (req.query.utenut == "true");
    if (medut == true & utenut == true) {
      medut = false; utenut = false;
    }

    posarray = []
    pos_val = ["adj", "adv", "det", "forkorting",
      "interjeksjon", "konjunksjon", "prefiks", "preposisjon",
      "pron", "subst", "subjunksjon", "verb", "symbol"]
    pos_val.forEach(pos => {
      if (req.query[pos] == "true") {
        posarray.push(pos)
      }
    })
    let query = `SELECT *
                  FROM oppslag AS o
                  WHERE 1=1`

    let params = []

    if (q) {
      query += ' AND o.oppslag LIKE ?'
      params.push(q + '%')
    }

    if (meddef) {
      query += ' AND o.lemma_id IN (SELECT lemma_id FROM definisjon)'
    }
    if (utendef) {
      query += ' AND o.lemma_id NOT IN (SELECT lemma_id FROM definisjon)'
    }

    if (medut) {
      query += ' AND o.lemma_id IN (SELECT lemma_id FROM uttale)'
    }
    if (utenut) {
      query += ' AND o.lemma_id NOT IN (SELECT lemma_id FROM uttale)'
    }

    if (posarray.length > 0) {
      query += ' AND o.boy_tabell IN (?)'
      params.push(posarray)
    }

    query += ` ORDER BY oppslag`

    try {
      const result = await db.query(query, params)
      res.status(200).send(result)
    } catch (error) {
      console.log(error)
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

  update: async (req, res) => {
    const lemma_id = req.params.id;
    const user_id = res.locals.user_id
    uttale = req.body.oppslag.uttale
    defs = req.body.oppslag.definisjon
    kommentar = req.body.oppslag.kommentar
    oppslag = req.body.oppslag
    deldata = req.body.deldata

    if (deldata.def.length > 0) {
      try {
        const query1 = `DELETE FROM definisjon
                        WHERE def_id IN (?)`
        await db.query(query1, [deldata.def])
      } catch (error) {
        console.log(error)
      }
    }

    if (deldata.uttale.length > 0) {
      try {
        const query2 = `DELETE FROM uttale
                        WHERE uttale_id IN (?)`
        await db.query(query2, [deldata.uttale])
      } catch (error) {
        console.log(error)
      }
    }

    try {
      const query3 = `UPDATE oppslag
                   SET ledd = ?
                   WHERE lemma_id = ?`

      await db.query(query3, [oppslag.ledd, oppslag.lemma_id])
    } catch (error) {
      console.log(error)
    }
    let pri = 1
    if (defs.length > 0) {
      try {
        defs.forEach(def => {
          def.prioritet = pri
          pri++
        })

        const query4 = `INSERT INTO definisjon (def_id, lemma_id, prioritet, definisjon, oversatt_av)
        VALUES ?
        ON DUPLICATE KEY UPDATE
        prioritet = VALUES (prioritet),
        definisjon = VALUES (definisjon),
        sist_endret = CURRENT_TIMESTAMP`
        await db.query(query4, [defs.map(def => [def.def_id, def.lemma_id, def.prioritet, def.definisjon, user_id])])

      } catch (error) {
        console.log(error)
      }
    }

    if (uttale.length > 0) {
      try {
        const query5 = `INSERT INTO uttale (uttale_id, lemma_id, transkripsjon)
        VALUES ?
        ON DUPLICATE KEY UPDATE
        transkripsjon = VALUES (transkripsjon)`
        await db.query(query5, [uttale.map(ut => [ut.uttale_id, lemma_id, ut.transkripsjon])])

      } catch (error) {
        console.log(error)
      }
    }
    if (kommentar.length > 0) {
      try {
        await module.exports.addKommentar(kommentar)
      } catch (error) {
        console.log(error)
      }
    }
    res.status(200).send("Oppdatert!")
  },

  addKommentar: async (kommentar) => {
    console.log(kommentar)
    try {
      const query = `INSERT INTO kommentar (kom_id, lemma_id, bruker, kommentar)
      VALUES ?
      ON DUPLICATE KEY UPDATE
      bruker = VALUES (bruker),
      kommentar = VALUES (kommentar)`
      await db.query(query, [kommentar.map(kom => [kom.kom_id, kom.lemma_id, kom.bruker, kom.kommentar])])

    } catch (error) {
      throw error
    }
  },


  loggInn: async (req, res) => {
    console.log(req.body.username + " trying to log in...")

    try {
      let user = await db.query('SELECT * FROM brukere WHERE brukernavn = ?', [req.body.username.toLowerCase()])

      if (user.length === 0) {
        return res.status(401).send('Feil brukernavn eller passord')
      }
      user = user[0]
      let passwordIsValid = bcrypt.compareSync(req.body.password, user.passord_hash)
      if (!passwordIsValid || !user) {
        return res.status(401).send('Feil brukernavn eller passord')
      }
      let token = jwt.sign({ user: user.brukernavn, user_id: user.user_id, admin: user.admin }, config.jwt.secret, {
        expiresIn: '30d'
      })
      const query = `UPDATE brukere 
                    SET sist_innlogget = CURRENT_TIMESTAMP 
                    WHERE user_id = ?`
      await db.query(query, [user.user_id])
      res.status(200).send({ auth: true, token: token, user_id: user.user_id, username: user.brukernavn, admin: user.admin });
    } catch (error) {
      console.log(error)
      res.status(500).send("Noe gikk galt")
    }
  },
  registrer: async (req, res) => {

    try {
      const user_data = req.body
      let validated = true
      if (user_data.check.toLowerCase() != 'elleve') {
        res.status(401).send("Feil svar")
        validated = false
      }
      const email = user_data.email
      if (!email) {
        res.status(400).send('E-post-adresse mangler')
        validated = false
      }
      if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        res.status(400).send('Ugyldig e-post-adresse')
        validated = false
      }

      const username = user_data.username
      if (!username) {
        res.status(400).send('Fornavn mangler')
        validated = false
      }
      if (username.length < 6 && username.length < 13) {
        res.status(400).send('Ugyldig brukernavn. Brukernavnet må være mellom 6 og 12 tegn')
        validated = false
      }

      const password = user_data.password
      if (!password) {
        res.status(400).send('Passord mangler')
        validated = false
      }
      if (password.length < 6) {
        res.status(400).send('Ugyldig passord. Passordet må ha 6 tegn eller mer')
        validated = false
      }
      if (validated) {
        await module.exports.opprettBruker(user_data)
        res.status(201).send("Bruker opprettet. Du kan nå logge inn.")
      }
    } catch (error) {
      console.log(error)
      if (error.errno === 1062) {
        res.status(500).send("Brukernavn eller e-post finnes allerede i systemet")
      } else {
        res.status(500).send("Noe gikk galt")
      }
    }
  },

  opprettBruker: async (user_data) => {
    user_data["password"] = bcrypt.hashSync(user_data["password"], 10)

    let user_data_array = []

    Object.values(user_data).forEach(element => {
      user_data_array.push([element])
    })
    console.log(user_data_array)

    const query = `INSERT INTO brukere (brukernavn, epost, passord_hash, admin)
                    VALUES (?, ?, ?, FALSE)`
    try {
      await db.query(query, [[user_data.username.toLowerCase()], [user_data.email.toLowerCase()], [user_data.password]])
    } catch (error) {
      throw error
    }
  },

  addForslag: async (req, res) => {

    const oppslag = req.body.oppslag
    const user_id = res.locals.user_id
    try {
      const query1 = `SELECT definisjon FROM definisjon
                      WHERE lemma_id = ?`

      const current_defs = await db.query(query1, [oppslag.lemma_id])
      if (current_defs.length > 0) {
        res.status(403).send("Du kan ikke legge til forslag i ord med eksisterende definisjoner")
      } else {
        if (oppslag.definisjon.length > 0 && oppslag.definisjon[0]['definisjon'] != '') {
          const query2 = `INSERT INTO forslag (lemma_id, user_id, forslag_definisjon)
                        VALUES ?`
          await db.query(query2, [oppslag.definisjon.map(def => [def.lemma_id, user_id, def.definisjon])])
          res.status(200).send("Forslag lagt til. Videresender til forslagsoversikt...")

        } else {
          res.status(400).send("Du må komme med minst ett forslag")
        }
      }
    } catch (error) {
      console.log(error)
      res.status(500).send("Noe gikk galt")
    }
  },
  getAllForslag: async (req, res) => {
    const user_id = res.locals.user_id
    try {
      const query = `SELECT f.forslag_id, o.lemma_id, o.oppslag, o.boy_tabell, f.forslag_definisjon, b.brukernavn, b.user_id,
                    IFNULL(SUM(s.type = 1),0) AS upvotes, IFNULL(SUM(s.type = 0), 0) AS downvotes,
                    f.opprettet, (SELECT type FROM stemmer WHERE user_id = ? AND forslag_id = f.forslag_id) AS minstemme
                    FROM forslag AS f
                    INNER JOIN oppslag AS o USING (lemma_id)
                    INNER JOIN brukere AS b USING (user_id)
                    LEFT OUTER JOIN stemmer AS s USING (forslag_id)
                    GROUP BY f.forslag_id`
      oppslag = await db.query(query, [user_id])
      res.status(200).send(oppslag)
    } catch (error) {
      console.log(error)
    }
  },
  stemForslag: async (req, res) => {
    const user_id = res.locals.user_id
    const forslag_id = req.params.id
    const type = req.body.type
    try {
      const query1 = `SELECT stemme_id, type 
                    FROM stemmer AS s
                    WHERE user_id = ?
                    AND forslag_id = ?
                    `
      result = await db.query(query1, [user_id, forslag_id])
      if (result.length > 0 && result[0].type == type) {
        const query2 = `DELETE FROM stemmer
                        WHERE user_id = ? AND forslag_id = ?`
        await db.query(query2, [user_id, forslag_id])
        return res.status(200).send("Stemme fjernet")
      }
      const query3 = `INSERT INTO stemmer (forslag_id, user_id, type)
                        VALUES (?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                        type = VALUES (type)
                        `
      await db.query(query3, [forslag_id, user_id, type])

      const query4 = `SELECT IFNULL(SUM(s.type = 1),0) AS upvotes,
      IFNULL(SUM(s.type = 0),0) AS downvotes
          FROM stemmer AS s
          WHERE forslag_id = ?`
      
      let votes = await db.query(query4, [forslag_id])
      votes = votes[0]
      console.log(votes)

      if (votes.upvotes >= 5) {
        await module.exports.godkjennForslag(forslag_id)
        return res.status(200).send('Forslaget har fått mer enn 5 upvotes og er nå lagt til i ordboka')
      }
      if (votes.downvotes >= 2) {
        await module.exports.slettForslagFraDB(forslag_id)
        return res.status(200).send('Forslaget har fått mer enn 5 downvotes og er derfor slettet')
      }

      res.status(200).send('Stemme mottatt')

    } catch (error) {
      console.log(error)
      res.status(500).send("Noe gikk galt")
    }
  },
  adminGodkjennForslag: async (req, res) => {
    const forslag_id = req.params.id
    const redigert_forslag = req.body.redigert_forslag
    try {
      await module.exports.godkjennForslag(forslag_id, redigert_forslag)
      res.status(200).send("Forslag godkjent og lagt til i ordboka")
    } catch (error) {
      console.log(error)
      res.status(500).send("Noe gikk galt")
    }

  },
  godkjennForslag: async (forslag_id, redigert_forslag = null) => {
    try {
      const query1 = `SELECT forslag_id, lemma_id, forslag_definisjon, user_id
                      FROM forslag
                      WHERE forslag_id = ?`
      let forslag = await db.query(query1, [forslag_id])
      forslag = forslag[0]
      if (redigert_forslag) {
        forslag.forslag_definisjon = redigert_forslag
      }
      const query2 = `SELECT COALESCE(MAX(prioritet), 0) AS max_pri FROM definisjon WHERE lemma_id = ?`
      let result = await db.query(query2, [forslag.lemma_id])

      const max_pri = result[0]['max_pri'] + 1
      const query3 = `INSERT INTO definisjon (lemma_id, prioritet, definisjon, oversatt_av)
                      VALUES (?, ?, ?, ?)`
      await db.query(query3, [forslag.lemma_id, max_pri, forslag.forslag_definisjon, forslag.user_id])

      await module.exports.slettForslagFraDB(forslag_id, null)
    } catch (error) {
      throw error
    }
  },
  avvisForslag: async (req, res) => {

    const forslag_id = req.params.id
    try {
      await module.exports.slettForslagFraDB(forslag_id, null)
      res.status(200).send("Forslag avvist")
    } catch (error) {
      console.log(error)
      res.status(500).send("Kunne ikke fjerne forslag")
    }
  },
  fjernForslag: async (req, res) => {

    const forslag_id = req.params.id
    const user_id = res.locals.user_id

    try {
      await module.exports.slettForslagFraDB(forslag_id, user_id)
      res.status(200).send("Forslag fjernet")
    } catch (error) {
      console.log(error)
      res.status(500).send("Kunne ikke fjerne forslag")
    }
  },

  slettForslagFraDB: async (forslag_id, user_id) => {
    try {
      let query1 = `DELETE FROM forslag
                    WHERE forslag_id = ?`
      if (user_id) {
        query1 += `AND user_id = ?`
      }
      await db.query(query1, [forslag_id, user_id])

      const query2 = `DELETE FROM stemmer
                      WHERE forslag_id = ?`
      await db.query(query2, [forslag_id])

    } catch (error) {
      throw error
    }
  },
  getAnbefalinger: async (req, res) => {
    const query = `SELECT f.score, o.lemma_id, o.oppslag, o.boy_tabell
                  FROM frekvens AS f 
                  INNER JOIN oppslag AS o ON o.oppslag = f.lemma
                  WHERE o.oppslag NOT IN 
                    (SELECT oppslag FROM definisjon AS d
                      INNER JOIN oppslag AS o
                      USING (lemma_id))
                      AND o.lemma_id NOT IN 
                      (SELECT lemma_id FROM forslag AS f)
                      AND o.boy_tabell NOT IN ('symbol','forkorting')
                  ORDER BY f.score ASC
                  LIMIT 500
                  `
    try {
      const results = await db.query(query)
      const amount = results.length
      let anbefalinger = []
      for (let i = 0; i < 10; i++) {
        let random_index = Math.floor(Math.random() * amount)
        let random_result = results[random_index]
        if (!anbefalinger.some(item => item.lemma_id === random_result.lemma_id)) {
          anbefalinger.push(random_result)
        }
      }
      res.status(200).send(anbefalinger)
    } catch (error) {
      console.log(error)
      res.status(500).send("Noe gikk galt.")
    }
  }
}