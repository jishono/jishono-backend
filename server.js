const express = require("express");
const bodyParser = require("body-parser");
/* const cors = require("cors"); */
const app = express();
const middleware = require("./app/routes/middleware");

/* var corsOptions = {
  origin: "http://localhost:8080"
}; */

/* app.use(cors(corsOptions)); */

/* app.use(cors()); */

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function (req, res, next) {
  if (req.url == '/login') {
    next()
  } else {
    if (middleware.verifyToken(req.get('Authorization'))) {
      next()
    } else {
      res.status(401).send("Token authentication failed")
    }
  }
})

require("./app/routes/routes")(app);

app.get("/", (req, res) => {
  res.json({ message: "jisho.no admin-api" });
});

// set port, listen for requests
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});