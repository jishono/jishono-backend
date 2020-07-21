const jwt = require('jsonwebtoken');
const config = require("../config/config")

function verifyToken (token) {
  if (token) {
    try {
      var decoded = jwt.verify(token, config.jwt.secret)
      return decoded
    } catch {
      return null
    }
  }
};

async function authenticate (req, res, next) {
  const decoded = module.exports.verifyToken(req.get('Authorization'))
  if (decoded) {
    res.locals.user_id = decoded.user_id
    res.locals.decoded_token = decoded
    next()
  } else {
    res.status(401).send("Token authentication failed")
  }
}

module.exports = {
  verifyToken: verifyToken,
  auth: authenticate
}
