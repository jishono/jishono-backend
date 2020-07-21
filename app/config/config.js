require('dotenv').config();

const config = {
    app: {
      port: 3000,
      node_env: process.env.NODE_ENV,
    },
    db: {
      host: process.env.DB_HOST_NODE,
      user: process.env.DB_USER_ADMIN_NODE,
      port: process.env.DB_PORT_NODE,
      database: process.env.DB_NAME_NODE,
      password: process.env.DB_PASS_ADMIN_NODE
    },
    jwt: {
      secret: process.env.JWT_SECRET
    },
   };

module.exports = config;