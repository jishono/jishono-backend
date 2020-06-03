require('dotenv').config();

const config = {
    app: {
      port: 3000
    },
    db: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      password: process.env.DB_PASS
    },
    jwt: {
      secret: process.env.JWT_SECRET
    },
   };

module.exports = config;