module.exports = function authenticateAdmin (req, res, next) {
    console.log(res.locals.decoded_token)
    if (res.locals.decoded_token.admin === 1) {
        next()
    } else {
        res.status(401).send("Admin authentication failed")
    }
}

