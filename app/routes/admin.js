module.exports = function authenticateAdmin (req, res, next) {
    if (res.locals.decoded_token.admin === true) {
        next()
    } else {
        res.status(401).send("Admin authentication failed")
    }
}

