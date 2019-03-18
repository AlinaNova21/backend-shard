module.exports = async function ({ conns, shards, config }) {
  return {
    handlers: [
      [/^roomsDone$/, async ({ shardName }) => {
        const { redis } = shards[shardName]
        const rooms = {}
        conns.forEach(conn => {
          if (!conn.sub.roomMap2) return
          conn.sub.roomMap2.forEach(path => {
            const { shard, room } = parsePath(path)
            if (shard !== shardName) return
            rooms[room] = rooms[room] || []
            rooms[room].push(conn)
          })
        })
        const roomsToFetch = Object.keys(rooms)
        // console.log('fetching', roomsToFetch.length)
        if (!roomsToFetch.length) return
        const data = await redis.mget(roomsToFetch.map(r => `mapView:${r}`))
        for (const index in data) {
          const roomName = roomsToFetch[index]
          const mapView = JSON.parse(data[index] || '{}')
          rooms[roomName].forEach(conn => conn.publish(`roomMap2:${shardName}/${roomName}`, mapView))
        }
      }]
    ],
    async subscribe (conn, path) {
      const { shard, room } = parsePath(path)
      const view = JSON.parse(await shards[shard].redis.get(`mapView:${room}`) || '{}')
      conn.publish(`roomMap2:${path}`, view)
      return true
    },
    async unsubscribe (conn, path) {
      return true
    }
  }
}

function parsePath (path) {
  const [shard, room] = path.split('/')
  return { shard, room }
}
