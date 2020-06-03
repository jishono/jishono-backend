const jwt = require('jsonwebtoken');
const config = require("../config/config")

function verifyToken(token) {
    if (token) {
      try {
        var decoded = jwt.verify(token, config.jwt.secret)
        return decoded
      } catch {
        return null
      }
    }
  };

module.exports = {
    verifyToken: verifyToken
}
