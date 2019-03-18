const fs = require('fs')
const path = require('path')
const Redis = require('redis')
const util = require('util')
const sockjs = require('sockjs')
const YAML = require('yamljs')

const PROTOCOL = 13

const AuthMiddleware = require('./middleware/auth')

const { MongoClient } = require('mongodb')
const { default: serve, send } = require('micro')

const PubSub = require('./lib/PubSub')

const match = require('fs-router')(path.join(__dirname, '/routes'))

const readFile = util.promisify(fs.readFile)

async function setup () {
  const config = YAML.parse(await readFile('./config.yml', 'utf8'))

  const shardArray = await Promise.all(config.shards.map(async config => {
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
  const shards = shardArray.reduce((l, v) => { l[v.config.name] = v; return l }, {})
  shards.common = shardArray[0]
  return {
    config,
    shards
  }
}

async function base (fn, config, shards) {
  return async (req, res) => {
    req.PROTOCOL = PROTOCOL
    res.error = (error, code = 200) => send(res, code, { error })
    return fn(req, res)
  }
}

const middleware = [
  AuthMiddleware,
  base
]

async function runMiddleware (fn) {
  let ret = fn
  for (const mfn of middleware) {
    ret = await mfn(ret)
  }
  return ret
}

const mainHandler = runMiddleware(async (req, res) => {
  const start = Date.now()
  const matched = match(req)
  if (matched) {
    const ret = await matched(req, res)
    const dur = Date.now() - start
    console.log(`${req.method} ${req.url} ${dur}ms ${res.statusCode}`)
    if (req.url.startsWith('/api')) {
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
  const { shards, config } = await setup()
  const handler = async (fn) => {
    return (req, res) => {
      req.sock = sock
      req.config = config
      req.shards = shards
      return fn(req, res)
    }
  }
  const sock = sockjs.createServer()
  const server = serve(await handler(await mainHandler))
  sock.installHandlers(server, { prefix: '/socket' })
  require('./socket')(sock, PROTOCOL, shards, config)
  const { HOST = '0.0.0.0', PORT = 3000 } = process.env
  server.listen(parseInt(PORT), () => console.log(`Listening on ${HOST}:${PORT}`))
}

run().catch(console.error)
