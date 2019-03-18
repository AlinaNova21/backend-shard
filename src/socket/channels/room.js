const _ = require('lodash')
const { ObjectId } = require('mongodb')

// TODO: This isn't working.

module.exports = async function ({ conns, shards, config }) {
  const roomCache = new Map()
  return {
    handlers: [
      [/^roomsDone$/, async ({ shardName, publish }) => {
        const userRoomCount = {}
        const { redis, db } = shards[shardName]
        const gameTime = parseInt(await redis.get('gameTime'))
        const rooms = new Set()
        conns.forEach(async conn => {
          if (!conn.sub.room) return
          const rooms = _.shuffle(conn.sub.room.values())
          rooms.forEach(room => {
            userRoomCount[conn.user] = userRoomCount[conn.user] || 0
            if (userRoomCount[conn.user] >= config.serverData.roomSubLimit) {
              return conn.publish(`err@room:${room}`, 'subscribe limit reached')
            }
            userRoomCount[conn.user]++
            rooms.add(room)
          })
        })
        Array.from(rooms).forEach(async roomName => {
          const cache = roomCache.get(roomName)
          const room = await db.collection.rooms.findOne({ _id: roomName })
          if (!room) return
          const [objects, flags] = await Promise.all([
            db.collection('rooms.objects').find({ room: roomName }).exec(),
            db.collection('rooms.flags').find({ room: roomName }).exec()
          ])
          objects.forEach(u => {
            u._id = u._id.toString()
          })
          const userIds = objects.reduce((res, obj) => res.add(obj.user), new Set())
          const $in = userIds.values().map(v => v.length === 1 ? v : ObjectId(v))
          const users = await db.collection('users').find({ _id: { $in } }, { username: true, badge: true }).exec()
          users.forEach(u => {
            u._id = u._id.toString()
          })
          const lastObjects = cache.objects || {}
          const lastUsers = cache.users || []
          cache.objects = objects
          cache.users = users
          const userDiff = users.filter(u => !lastUsers.find(lu => lu._id === u._id))
          const objDiff = {}
          lastObjects.forEach(oldObj => {
            const newObj = objects.find(o => o._id === oldObj._id)
            const obj = {}
            if (newObj) {
              for (const key in oldObj) {
                if (typeof newObj[key] === 'undefined') {
                  obj[key] = null
                  continue
                }
                if ((typeof oldObj[key]) !== (typeof newObj[key]) || (oldObj[key] && !newObj[key])) {
                  obj[key] = newObj[key]
                  continue
                }
                if (typeof oldObj[key] === 'object') {
                  obj[key] = {}
                }
              }
            } else {
              objDiff[oldObj._id] = null
            }
          })
        })
      }]
    ],
    async subscribe (conn, room) {
      if (!roomCache.has(room)) {
        roomCache.set(room, { count: 0, objects: {} })
      }
      roomCache.get(room).count++
      while (conn.sub.room.length >= config.serverData.roomSubLimit) {
        const [val] = conn.sub.values()
        conn.sub.room.delete(val)
        conn.publish(`err@room:${val}`, 'subscribe limit reached')
      }
      return true
    },
    async unsubscribe (conn, room) {
      roomCache.get(room).count--
      return true
    }
  }
}
