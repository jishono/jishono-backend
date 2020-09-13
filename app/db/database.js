const config = require("../config/config.js");
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: config.db.host,
  user: config.db.user,
  database: config.db.database,
  password: config.db.password,
  multipleStatements: true
})

module.exports = {
  query: async (text, params) => {
    try {
      const start = Date.now()
      const [result, fields] = await pool.query(text, params)
      const duration = Date.now() - start
      console.log('executed query', { text, duration, rows: result.length })
      return result
    } catch (error) {
      throw error
    }
  }
}
