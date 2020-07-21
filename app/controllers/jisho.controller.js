const db = require("../db/database")
const config = require("../config/config")
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


// Finn enkeltoppslag med tilhørende data

module.exports = {
  getOppslag: async (req, res) => {
    const lemma_id = req.params.id
    try {
      const query = `SELECT o.lemma_id, o.oppslag, o.ledd, o.boy_tabell, o.notis, 
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
    /* query += ' LIMIT 100' */

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
                   SET ledd = ?, notis = ?
                   WHERE lemma_id = ?`

      await db.query(query3, [oppslag.ledd, oppslag.notis, oppslag.lemma_id])
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

        const query4 = `INSERT INTO definisjon (def_id, lemma_id, prioritet, definisjon)
        VALUES ?
        ON DUPLICATE KEY UPDATE
        prioritet = VALUES (prioritet),
        definisjon = VALUES (definisjon)`
        await db.query(query4, [defs.map(def => [def.def_id, def.lemma_id, def.prioritet, def.definisjon])])

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
    res.status(200).send("Oppdatert")
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

  addForslag: async (req, res) => {

    const oppslag = req.body.oppslag
    console.log(res.locals)
    const user_id = res.locals.user_id
    console.log(oppslag)
    try {
      if (oppslag.definisjon.length > 0) {
        const query = `INSERT INTO forslag (lemma_id, user_id, forslag_definisjon)
                      VALUES ?`
        await db.query(query, [oppslag.definisjon.map(def => [def.lemma_id, user_id, def.definisjon])])

      }
      if (oppslag.kommentar.length > 0) {
        await module.exports.addKommentar(oppslag.kommentar)
      }
      res.status(200).send("Forslag lagt til.")
    } catch (error) {
      console.log(error)
    }


  },

  loggInn: async (req, res) => {
    console.log(req.body.username + " trying to log in...")

    try {
      let user = await db.query('SELECT * FROM brukere WHERE brukernavn = ?', [req.body.username.toLowerCase()])

      if (user.length === 0) {
        return res.status(401).send({ auth: false, token: null })
      }
      user = user[0]
      let passwordIsValid = bcrypt.compareSync(req.body.password, user.passord_hash)
      if (!passwordIsValid || !user) {
        console.log("invalid password")
        return res.status(401).send({ auth: false, token: null })
      }

      let token = jwt.sign({ user: user.brukernavn, user_id: user.user_id, admin: user.admin }, config.jwt.secret, {
        expiresIn: '30d'
      })
      res.status(200).send({ auth: true, token: token, user: user.brukernavn, admin: user.admin });
    } catch (error) {
      console.log(error)
    }
  },
  registrer: async (req, res) => {

    try {
      const user_data = req.body
      if (user_data.check != 'elleve') {
        res.status(401).send("Feil svar")
      }
      const email = user_data.email
      if (!email) { res.status(400).send('E-post-adresse mangler') }
      if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) { res.status(400).send('Ugyldig e-post-adresse') }

      const username = user_data.username
      if (!username) { res.status(400).send('Fornavn mangler') }
      if (username.length < 6) { res.status(400).send('Ugyldig brukernavn. Brukernavnet må ha 6 tegn eller mer') }

      const password = user_data.password
      if (!password) { res.status(400).send('Passord mangler') }
      if (password.length < 6) { res.status(400).send('Ugyldig passord. Passordet må ha 6 tegn eller mer') }

      await module.exports.opprett_bruker(user_data)
      res.status(201).send("Bruker opprettet")
    } catch (error) {
      console.log(error)
      if (error.errno === 1062) {
        res.status(500).send("Brukernavn eller e-post finnes allerede i systemet")
      } else {
        res.status(500).send("Noe gikk galt")
      }
    }
  },
  opprett_bruker: async (user_data) => {
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
  getAllForslag: async (req, res) => {

    try {
      const query = `SELECT f.forslag_id, o.lemma_id, o.oppslag, f.forslag_definisjon, b.brukernavn,
                    IFNULL(SUM(s.type = 1),0) AS upvotes, IFNULL(SUM(s.type = 0), 0) AS downvotes,
                    f.opprettet
                    FROM forslag AS f
                    INNER JOIN oppslag AS o USING (lemma_id)
                    INNER JOIN brukere AS b USING (user_id)
                    LEFT OUTER JOIN stemmer AS s USING (forslag_id)
                    GROUP BY f.forslag_id`
      oppslag = await db.query(query)
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
      const query1 = `SELECT stemme_id 
                    FROM stemmer AS s
                    WHERE user_id = ?
                    AND forslag_id = ?
                    `
      result = await db.query(query1, [user_id, forslag_id])

      if (result.length > 0) {
        res.status(400).send('Du har allerede stemt på dette forslaget')
      } else {
        const query2 = `INSERT INTO stemmer (forslag_id, user_id, type)
                   VALUES (?, ?, ?)
                      `
        await db.query(query2, [forslag_id, user_id, type])

        const query3 = `SELECT IFNULL(SUM(s.type = 1),0) AS upvotes
        FROM stemmer AS s
        WHERE forslag_id = ?`
        const upvotes = await db.query(query3, [forslag_id])

        if (upvotes.length >= 5) {
          await module.exports.godkjennForslag(forslag_id)
          res.status(200).send('Forslaget er herved akseptert og lagt til i ordboka')
        } else {
          res.status(200).send('Stemme mottatt')
        }
      }
    } catch (error) {
      console.log(error)
      res.status(500).send("Noe gikk galt")
    }
  },
  adminGodkjennForslag: async (req, res) => {
    const forslag_id = req.params.id
    try {
      await module.exports.godkjennForslag(forslag_id)
      res.status(200).send("Forslag godkjent og lagt til i ordboka")
    } catch (error) {
      console.log(error)
      res.status(500).send("Noe gikk galt")
    }

  },
  godkjennForslag: async (forslag_id) => {
    try {
      const query1 = `SELECT forslag_id, lemma_id, forslag_definisjon
                      FROM forslag
                      WHERE forslag_id = ?`
      let forslag = await db.query(query1, [forslag_id])
      console.log(forslag)
      forslag = forslag[0]

      const query2 = `SELECT COALESCE(MAX(prioritet), 0) AS max_pri FROM definisjon WHERE lemma_id = ?`
      let result = await db.query(query2, [forslag.lemma_id])

      const max_pri = result[0]['max_pri'] + 1
      const query3 = `INSERT INTO definisjon (lemma_id, prioritet, definisjon)
                      VALUES (?, ?, ?)`
      await db.query(query3, [forslag.lemma_id, max_pri, forslag.forslag_definisjon])

      const query4 = `DELETE FROM forslag
                      WHERE forslag_id = ?`

      await db.query(query4, [forslag.forslag_id])

      const query5 = `DELETE FROM stemmer
                      WHERE forslag_id = ?`

      await db.query(query5, [forslag.forslag_id])
    } catch (error) {
      throw error
    }
  }
}