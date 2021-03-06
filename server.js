const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const config = require("./app/config/config.js")
const path = require("path")
const cronjobs = require('./app/cron/jobs.js')

console.log("Environment:", config.app.node_env)
if (config.app.node_env == 'development') {
  const corsOptions = {
    origin: "*"
  }
  app.use(cors(corsOptions))
}

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, './app/views'))

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});