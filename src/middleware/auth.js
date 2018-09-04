const { send } = require('micro')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const BasicStrategy = require('passport-http').BasicStrategy

const Auth = require('../lib/Auth')

module.exports = async (fn) => {
  const auth = new Auth()
  passport.use(new LocalStrategy({
    usernameField: 'email',
    session: false
  }, authUser))
  passport.use(new BasicStrategy({
    session: false
  }, authUser))

  function authUser (username, password, done) {
    auth.authUser(username, password).then((res) => done(null, res)).catch(done)
  }

  passport.serializeUser((u, d) => d(null, u))
  passport.deserializeUser((u, d) => d(null, u))
  const passportInit = passport.initialize()
  return async (req, res) => {
    auth.users = req.shards.common.db.collection('users')
    auth.redis = req.shards.common.redis
    req.auth = auth
    req.authenticate = async (strategy) => {
      const token = req.headers['x-token']
      if (token) {
        const user = await req.auth.checkToken(token, true)
        if (user) {
          res.setHeader('x-token', await req.auth.genToken(user._id))
          return user
        }
      }
      if (strategy) {
        const user = await passportAuth(req, res, strategy)
        if (user) {
          return user
        }
      }
      return false
    }
    res.unauthorized = () => send(res, 401, { error: 'Unauthorized' })
    callMiddleware(req, res, passportInit)
    return fn(req, res)
  }
}

function passportAuth (req, res, strategy) {
  return new Promise((resolve, reject) => {
    passport.authenticate(strategy, (err, user) => {
      if (err) return reject(err)
      resolve(user)
    })(req, res, () => {})
  })
}

function callMiddleware (req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (err) => err ? reject(err) : resolve())
  })
}
