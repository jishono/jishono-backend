const config = require("../config/config.js");
const mysql = require('mysql2/promise');

const opts = {
  host: config.db.host,
  user: 'root',
  //port: config.db.port,
  database: config.db.name,
  password: '',
  /* password: config.db.password, */
};

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  //port: config.db.port,
  database: 'jisho',
  password: '',
  /* password: config.db.password, */
})

module.exports = {
  query: async (text, params) => {
    try {
      const start = Date.now()
      const [result, fields] = await pool.query(text, params)
      const duration = Date.now() - start
      console.log(result)
      console.log('executed query', { text, duration, rows: result.length })
      return result
    } catch (error) {
      console.log(error)
    }
  }
}
