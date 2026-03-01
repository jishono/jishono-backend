const msg = require('../locale/msg.json')

module.exports = function authenticateAdmin (req, res, next) {
    if (res.locals.decoded_token?.admin === true) {
        next()
    } else {
        res.status(401).json({ error: msg.generell_error })
    }
}

