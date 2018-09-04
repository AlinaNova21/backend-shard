const { json } = require('micro')
module.exports.POST = async (req, res) => {
  // const user = await req.authenticate('basic')
  // if (!user) return res.error('unauthorized')
  const { shard, statName, rooms } = await json(req)
  const [ , stat, interval ] = statName.match(/^(.*?)(\d+)$/) || []
  if (!Array.isArray(rooms) || !stat || !interval) {
    return res.error('invalid params')
  }

  const stats = {}
  const userIDs = new Set()

  const { db, redis } = req.shards[shard]

  if (!db || !redis) {
    return res.error('invalid shard')
  }

  const gameTime = parseInt(await redis.get('gameTime'))

  const roomResults = await db.collection('rooms').find({ _id: { $in: rooms } }).toArray()
  roomResults.forEach(({ _id, status, novice, openTime }) => {
    stats[_id] = { status, novice, openTime }
  })

  const controllers = await db.collection('rooms.objects').find({ room: { $in: rooms }, type: 'controller' }).toArray()
  controllers.forEach(({ room, user, level, reservation, sign, safeMode }) => {
    if (user) {
      stats[room].own = { user, level }
      userIDs.add(user)
    }
    if (reservation) {
      stats[room].own = { user: reservation.user, level: 0 }
      userIDs.add(user)
    }
    if (sign) {
      stats[room].sign = sign
      userIDs.add(user)
    }
    if (safeMode > gameTime) {
      stats[room].safeMode = true
    }
  })

  const minerals = await db.collection('rooms.objects').find({ room: { $in: rooms }, type: 'mineral' }).toArray()
  minerals.forEach(({ room, mineralType: type, density }) => {
    stats[room].minerals0 = { type, density }
  })

  const userRecords = await db.collection('users').find({ _id: { $in: Array.from(userIDs.values()) } }, { _id: true, username: true, badge: true }).toArray()
  const users = {}
  userRecords.forEach(user => {
    users[user._id] = user
  })
  return {
    gameTime,
    stats,
    statsMax: {},
    users
  }
}
