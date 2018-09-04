module.exports.GET = async (req, res) => {
  const user = await req.authenticate()
  console.log(req.headers)
  const { shard } = req.query
  if (shard && !req.shards[shard]) return res.error('invalid shard')

  if (shard) {
    return { ok: 1, room: [await getRoom(user, req.shards[shard].db)] }
  } else {
    const ind = Math.floor(Math.random() * req.config.shards.length)
    const { name } = req.config.shards[ind]
    const room = await getRoom(user, req.shards[name].db)
    return { ok: 1, room: [`${name}/${room}`] }
  }
}

async function getRoom (user, db) {
  const rooms = db.collection('rooms')
  if (user) {
    const roomObjects = db.collection('rooms.objects')
    const controllers = await roomObjects.find({ $and: [{ user: '' + user._id }, { type: 'controller' }] }).toArray()
    if (controllers.length) {
      const ind = Math.floor(Math.random() * controllers.length)
      const { room } = controllers[ind]
      return room
    }
  }
  const centerRooms = await rooms.find({ _id: /^[EW]\d*5[NS]\d*5$/, status: 'normal' }).toArray()
  const ind = Math.floor(Math.random() * centerRooms.length)
  const { _id: room } = centerRooms[ind]
  return room
}
