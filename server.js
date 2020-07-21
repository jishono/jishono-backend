const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();

/* const whitelist = ["https://admin.jisho.no", "http://localhost:8080"]

var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

app.use(cors(corsOptions)); */

let corsOptions = {}
console.log(process.env.NODE_ENV)
if (process.env.NODE_ENV = 'development') {
  corsOptions = {
    origin: "http://localhost:8080"
  }
} else {
  corsOptions = {
    origin: "https://admin.jisho.no"
  }
}

app.use(cors(corsOptions))

/* app.use(cors({origin: '*'})) */

/* app.use(cors()) */

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://admin.jisho.no"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
}); */



require("./app/routes/routes")(app);

app.get("/", (req, res) => {
  res.json({ message: "jisho.no admin-api" });
});

// set port, listen for requests
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});