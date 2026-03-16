require('dotenv').config();

const config = {
  app: {
    port: 3000,
    node_env: process.env.NODE_ENV,
  },
  db: {
    host: process.env.DB_HOST_NODE,
    user: process.env.DB_USER_ADMIN_NODE,
    port: process.env.DB_PORT_NODE || 5432,
    database: process.env.DB_NAME_NODE,
    password: process.env.DB_PASS_ADMIN_NODE
  },
  jwt: {
    secret: process.env.JWT_SECRET
  },
  email: {
    enabled: process.env.NODEMAILER_ENABLED,
    smtp_host: process.env.NODEMAILER_SMTP_HOST,
    smtp_port: process.env.NODEMAILER_SMTP_PORT,
    user: process.env.NODEMAILER_USER,
    password: process.env.NODEMAILER_PASSWORD,
  }
};

module.exports = config;