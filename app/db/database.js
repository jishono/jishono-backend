const config = require("../config/config.js");
const { Pool } = require('pg');

const pool = new Pool({
  host: config.db.host,
  user: config.db.user,
  database: config.db.database,
  password: config.db.password,
  port: config.db.port,
});

module.exports = {
  query: async (text, params = []) => {
    try {
      const result = await pool.query(text, params);
      return result.rows;
    } catch (error) {
      console.error('Full error details:', error);
      console.error('Query that failed:', text);
      throw error;
    }
  },
  bulkInsert: async (baseQuery, rows, columnsPerRow, onConflict = '') => {
    if (rows.length === 0) return [];
    const values = rows.map((row, i) => {
      const offset = i * columnsPerRow;
      return `(${row.map((_, j) => `$${offset + j + 1}`).join(', ')})`;
    }).join(', ');
    const params = rows.flat();
    const fullQuery = `${baseQuery} VALUES ${values} ${onConflict}`;
    try {
      const result = await pool.query(fullQuery, params);
      return result.rows;
    } catch (error) {
      console.error('Full error details:', error);
      console.error('Query that failed:', fullQuery);
      throw error;
    }
  }
};
