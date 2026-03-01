const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { runner: migrate } = require("node-pg-migrate");
const app = express();
const config = require("./app/config/config.js")
const path = require("path")
const cronjobs = require('./app/cron/jobs.js')

console.log("Environment:", config.app.node_env)
const corsOptions = {
  origin: config.app.node_env === 'development'
    ? '*'
    : ['https://www.jisho.no', 'https://jisho.no', 'https://baksida.jisho.no']
}

app.use(cors(corsOptions))
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, './app/views'))

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

require("./app/routes/routes")(app);

app.get("/", (req, res) => {
  res.json({ message: "jisho.no admin-api" });
})

app.use((req, res, next) => {
  res.status(404).send({
    status: 404,
    error: 'URLen finnes ikke'
  })
})

cronjobs.digestEmails()

const PORT = process.env.PORT || 3001;

async function start() {
  await migrate({
    databaseUrl: process.env.DATABASE_URL,
    dir: 'migrations',
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: (msg) => console.log('[migrate]', msg),
  })
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
  });
}

start();