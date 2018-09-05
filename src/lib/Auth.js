const crypto = require('crypto')
const util = require('util')
const { ObjectID } = require('mongodb')

const pbkdf2 = util.promisify(crypto.pbkdf2)
const randomBytes = util.promisify(crypto.randomBytes)

class Auth {
  constructor (userColl, opts) {
    this.opts = opts = opts || {}
    this.users = userColl
    opts.saltlen = opts.saltlen || 32
    opts.iterations = opts.iterations || 25000
    opts.keylen = opts.keylen || 512
    opts.encoding = opts.encoding || 'hex'
    opts.digestAlgorithm = opts.digestAlgorithm || 'sha256' // To get a list of supported hashes use crypto.getHashes()
    opts.passwordValidator = opts.passwordValidator || function (password, cb) { cb(null) }
  }

  async hashPassword (password) {
    const buf = await randomBytes(this.opts.saltlen)
    const salt = buf.toString(this.opts.encoding)
    const rawhash = await this.pbkdf2(password, salt)
    const hash = Buffer.from(rawhash, 'binary').toString(this.opts.encoding)
    return {
      pass: hash,
      salt: salt
    }
  }

  async checkPassword (salt, pass, proposed) {
    const rawhash = await this.pbkdf2(proposed, salt)
    const hash = Buffer.from(rawhash, 'binary').toString(this.opts.encoding)
    return hash === pass
  }

  pbkdf2 (password, salt) {
    return pbkdf2(Buffer.from(password), Buffer.from(salt), this.opts.iterations, this.opts.keylen, this.opts.digestAlgorithm)
  }

  async authUser (username, password) {
    const user = await this.users.findOne({ $or: [{ username: username }, { email: username }] })
    if (!user) return false
    if (!user.salt || !user.password) return false
    const valid = await this.checkPassword(user.salt, user.password, password)
    return valid ? user : false
  }

  async getUser (filter) {
    if (typeof filter === 'string') filter = { _id: filter }
    const user = await this.users.findOne(filter).exec()
    function save () {
      this.users.update({ _id: user.id }, user).exec()
    }
    user.groups = user.groups || []
    if (user) {
      user.addGroup = function (group) {
        user.groups.push(group)
        save()
      }
      user.remGroup = function (group) {
        let ind = user.groups.indexOf(group)
        if (ind === -1) return
        user.groups.splice(ind, 1)
        save()
      }
      user.hasGroup = function (group) {
        return !!~user.groups.indexOf(group)
      }
    }
    return user
  }

  async getUsers (filter) {
    return this.users.find(filter).toArray()
  }

  async getGroups (filter) {
    return Promise.resolve([{ name: 'admin' }])
  }

  async genToken (id) {
    const token = crypto.createHmac('sha256', 'c3a8bf7257511c56fb4eafa8cd9a8de8bf89af48')
      .update(new Date().getTime().toString())
      .update('' + id)
      .digest('hex')
    await this.redis.setex(`auth:${token}`, 60, id.toString())
    return token
  }

  async checkToken (token, noConsume) {
    const authKey = `auth:${token}`
    const id = await this.redis.get(authKey)
    if (!id) {
      return false
    }
    if (!noConsume) {
      const ttl = await this.redis.ttl(authKey)
      if (ttl > 100) {
        await this.redis.expire(authKey, 60)
      }
    }
    const user = await this.users.findOne({ _id: ObjectID(id) })
    if (!user) {
      return false
    }
    await this.redis.set(`userOnline:${user._id}`, Date.now())
    delete user.salt
    user.password = true
    return user
  }
}

module.exports = Auth
