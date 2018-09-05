const Auth = require('../lib/Auth')

module.exports = async (server, PROTOCOL, shards, config) => {
  const auth = new Auth()
  auth.users = shards.common.db.collection('users')
  auth.redis = shards.common.redis
  const conns = new Set()
  const moduleOpts = { conns, shards, config }
  const modules = {
    roomMap2: await require('./channels/roomMap2')(moduleOpts)
  }

  for (const { name } of config.shards) {
    const { pubsub } = shards[name]
    pubsub.subscribe('*', async (channel, data) => {
      for (const modName in modules) {
        const mod = modules[modName]
        if (!mod.handlers) continue
        const publish = (channel, data) => {
          conns.forEach(conn => {
            if (!conn.sub[modName]) return
            if (!conn.sub[modName].has(channel)) return
            conn.publish(channel, data)
          })
        }
        mod.handlers.forEach(([regex, fn]) => {
          const m = channel.match(regex)
          if (m) {
            fn({ shardName: name, publish, match: m, channel, data })
          }
        })
      }
    })
  }

  const commands = {
    async gzip (conn, val) {
      conn.gzip = val === 'on'
    },
    async auth (conn, token) {
      const user = await conn.auth.checkToken(token, true)
      if (user) {
        conn.user = user
        await conn.shards.common.redis.set(`userOnline:${user._id}`, Date.now())
        const newToken = await conn.auth.genToken(user._id)
        console.log(`auth ok`)
        conn.write(`auth ok ${newToken}`)
      } else {
        console.log(`auth failed`)
        conn.write(`auth failed`)
      }
    },
    async subscribe (conn, channel) {
      const [modName, path] = channel.split(':')
      const mod = modules[modName]
      if (mod) {
        if (!mod.subscribe || mod.subscribe(conn, path)) {
          conn.sub[modName] = conn.sub[modName] || new Set()
          conn.sub[modName].add(path)
        }
      }
    },
    async unsubscribe (conn, channel) {
      const [modName, path] = channel.split(':')
      const mod = modules[modName]
      if (mod) {
        if (!mod.unsubscribe || mod.unsubscribe(conn, path)) {
          conn.sub[modName] = conn.sub[modName] || new Set()
          conn.sub[modName].delete(path)
        }
      }
    }
  }

  server.on('connection', conn => {
    conns.add(conn)
    conn.on('close', () => {
      console.log('socket closed')
      conns.delete(conn)
    })
    conn.publish = (channel, data) => {
      console.log(channel, data)
      conn.write(JSON.stringify([channel, data]))
    }

    conn.sub = {}
    conn.shards = shards
    conn.config = config
    conn.auth = auth
    conn.gzip = false
    console.log('Socket Connection')
    conn.write('time ' + new Date().getTime())
    conn.write('protocol ' + PROTOCOL)
    conn.on('data', data => {
      console.log('socket', data)
      const [cmd, ...args] = data.split(' ')
      commands[cmd](conn, ...args).catch((err) => console.error(cmd, ...args, err))
    })
  })
}
