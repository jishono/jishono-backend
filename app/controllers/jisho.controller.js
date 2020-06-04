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
    console.log(posarray)
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
      console.log(oppslag)
      const boy_tabell = oppslag[0].boy_tabell + '_boy'

      const query = `SELECT * FROM ?? WHERE lemma_id = ?`

      const result = await db.query(query, [boy_tabell, id])
      console.log(result)
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
        const query6 = `INSERT INTO kommentar (kom_id, lemma_id, bruker, kommentar)
        VALUES ?
        ON DUPLICATE KEY UPDATE
        bruker = VALUES (bruker),
        kommentar = VALUES (kommentar)`
        await db.query(query6, [kommentar.map(kom => [kom.kom_id, lemma_id, kom.bruker, kom.kommentar])])
      } catch (error) {
        console.log(error)
      }
    }
    res.status(200).send("Oppdatert")
  },

  login: async (req, res) => {
    console.log(req.body.username + " trying to log in...")
    let user = await db.query('SELECT * FROM brukere WHERE brukernavn = ?', [req.body.username])

    if (user.length === 0) {
      return res.status(401).send({ auth: false, token: null })
    }
    user = user[0]
    let passwordIsValid = bcrypt.compareSync(req.body.password, user.passord_hash)
    if (!passwordIsValid || !user) {
      return res.status(401).send({ auth: false, token: null })
    }

    let token = jwt.sign({ id: user.username }, config.jwt.secret, {
      expiresIn: '30d'
    })
    res.status(200).send({ auth: true, token: token, user: user.brukernavn });
  }
}