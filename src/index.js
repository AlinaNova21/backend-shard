const fs = require('fs')
const path = require('path')
const Redis = require('redis')
const util = require('util')
const sockjs = require('sockjs')
const YAML = require('yamljs')

const PROTOCOL = 13

const AuthMiddleware = require('./middleware/auth')
const SteamMiddleware = require('./middleware/steam')

const { MongoClient, ObjectId } = require('mongodb')
const { default: serve, send } = require('micro')

const PubSub = require('./PubSub')

const match = require('fs-router')(path.join(__dirname, '/routes'))

const readFile = util.promisify(fs.readFile)
let sock

async function setup (fn) {
  const config = YAML.parse(await readFile('./config.yml', 'utf8'))

  const shards = await Promise.all(config.shards.map(async config => {
    const redisClient = Redis.createClient(config.redis)
    const pub = Redis.createClient(config.redis)
    const sub = Redis.createClient(config.redis)
    const { uri, ...mongoConfig } = config.mongo
    const mongo = await MongoClient.connect(uri, Object.assign({
      promiseLibrary: Promise,
      useNewUrlParser: true
    }, mongoConfig))
    const pubsub = new PubSub(pub, sub)
    const redis = {}
    // const wrappedFunctions = [ 'get', 'mget', 'set', 'setex', 'expire', 'ttl', 'del', 'hmget', 'hmset', 'hget', 'hset', 'hgetall', 'incr' ]
    for (const k in redisClient) {
      if (typeof redisClient[k] === 'function') {
        redis[k] = util.promisify(redisClient[k]).bind(redisClient)
      }
    }
    return { config, redis, pubsub, mongo, db: await mongo.db() }
  }))

  return async (req, res) => {
    req.PROTOCOL = PROTOCOL
    req.sock = sock
    req.config = config
    req.shards = shards.reduce((l, v) => { l[v.config.name] = v; return l }, {})
    req.shards.common = shards[0]
    res.error = (error, code = 200) => send(res, code, { error })
    return fn(req, res)
  }
}

const middleware = [
  AuthMiddleware,
  setup
]

async function runMiddleware (fn) {
  let ret = fn
  for (const mfn of middleware) {
    ret = await mfn(ret)
  }
  return ret
}

module.exports = runMiddleware(async (req, res) => {
  const start = Date.now()
  const matched = match(req)
  if (matched) {
    const ret = await matched(req, res)
    const dur = Date.now() - start
    if (req.url.startsWith('/api')) {
      console.log(`${req.method} ${req.url} ${dur}ms ${res.statusCode}`)
      console.log(ret)
      if (typeof ret === 'object' && !ret.error) {
        ret.ok = 1
      }
    }
    return ret
  }
  const dur = Date.now() - start
  console.log(`${req.method} ${req.url} ${dur}ms 404`)
  send(res, 404, { error: 'Not Found' })
})

async function run () {
  const handler = await module.exports
  const server = serve(handler)
  sock = sockjs.createServer()
  sock.installHandlers(server, { prefix: '/socket' })
  require('./socket')(sock, PROTOCOL)
  const { HOST = '0.0.0.0', PORT = 3000 } = process.env
  server.listen(parseInt(PORT), () => console.log(`Listening on ${HOST}:${PORT}`))
}

run().catch(console.error)
