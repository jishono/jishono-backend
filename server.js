const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const config = require("./app/config/config.js")

console.log("Environment:", config.app.node_env)
if (config.app.node_env == 'development') {
  console.log("Adding localhost:8080 to CORS")
  const corsOptions = {
    origin: "http://localhost:8080"
  }
  app.use(cors(corsOptions))
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

require("./app/routes/routes")(app);

app.get("/", (req, res) => {
  res.json({ message: "jisho.no admin-api" });
});

app.use((req, res, next) => {
  res.status(404).send({
    status: 404,
    error: 'URLen finnes ikke'
  })
})



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});