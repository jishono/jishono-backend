const jwt = require('jsonwebtoken');
const config = require("../config/config")
const msg = require('../locale/msg.json')

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
  if (decoded || ['/forslag', '/veggen/innlegg/undefined'].includes(req.url)) {
    if (decoded) {
      res.locals.user_id = decoded.user_id
      res.locals.decoded_token = decoded
    }
    next()
  } else {
    res.status(401).send(msg.user.ikke_logget_inn)
  }
}

module.exports = {
  verifyToken: verifyToken,
  auth: authenticate
}
