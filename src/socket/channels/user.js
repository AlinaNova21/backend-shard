const { translateModulesFromDb } = require('../../lib/codeUtils')

module.exports = async function ({ conns, shards, config }) {
  // const { user, type, ...args } = parsePath(path)

  return {
    handlers: [
      [/^user:(.+?)\/cpu$/, async ({ shardName, publish, channel, data }) => {
        publish(channel, JSON.parse(data))
      }],
      [/^user:(.+?)\/message$/, async ({ shardName, publish, channel, data }) => {
        publish(channel, JSON.parse(data))
      }],
      [/^user:(.+?)\/newMessage$/, async ({ shardName, publish, channel, data }) => {
        publish(channel, JSON.parse(data))
      }],
      [/^user:(.+?)\/set-active-branch$/, async ({ shardName, publish, channel, data }) => {
        publish(channel, JSON.parse(data))
      }],
      [/^user:(.+?)\/console$/, async ({ shardName, publish, channel, data }) => {
        const consoleData = JSON.parse(data)
        delete consoleData.userId
        publish(channel, consoleData)
      }],
      [/^user:(.+?)\/code$/, async ({ shardName, publish, match: [channel, id], data }) => {
        data = JSON.parse(data)
        const codeData = await shards.common.db.collection('users.code').findOne({ _id: id })
        const payload = {
          branch: codeData.branch,
          modules: translateModulesFromDb(codeData.modules),
          timestamp: codeData.timestamp,
          hash: data.hash
        }
        publish(channel, payload)
      }],
      [/^roomsDone$/, async ({ shardName }) => {
        const { redis, db } = shards[shardName]
        conns.forEach(async conn => {
          if (!conn.sub.user) return
          const paths = []
          const money = []
          conn.sub.user.forEach(path => {
            const { user, type, args } = parsePath(path)
            if (type === 'memory') {
              paths.push([path, args[0], user])
            }
            if (type === 'money') {
              money.push([path, user])
            }
          })
          if (paths.length) {
            try {
              const user = paths[0][2]
              const memory = JSON.parse(await redis.get(`userMemory:${user}`))
              paths.forEach(([channel, path]) => {
                let val = memory
                path = path.split('.')
                while (path.length && val) {
                  val = memory[path.shift()]
                }
                if (val) {
                  conn.publish(channel, val.toString())
                }
              })
            } catch (e) {}
          }
          if (money.length) {
            money.forEach(async ([channel, user]) => {
              const { money } = await db.collection('users').find({ _id: user }, { money: 1 })
              conn.publish(channel, (money / 1000) || 0)
            })
          }
        })
      }]
    ],
    async subscribe (conn, path) {
      const { user } = parsePath(path)
      return conn.user._id.toString() === user
    },
    async unsubscribe (conn, path) {
      return true
    }
  }
}

function parsePath (path) {
  const [user, type, ...args] = path.split('/')
  return { user, type, args }
}
