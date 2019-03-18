const { decodeTerrain } = require('../../../lib/codeUtils')

module.exports.GET = async (req, res) => {
  const { shard, room, encoded } = req.query
  const { db } = req.shards[shard] || {}
  if (!shard || !db) {
    return res.error('invalid shard')
  }
  const terrain = await db.collection('rooms.terrain').find({ room }).toArray()
  if (terrain.length == 0) {
    return res.error('invalid room')
  }
  if (encoded) {
    return { terrain }
  }
  if (terrain.length == 1 && terrain[0].type == 'terrain') {
    return { terrain: decodeTerrain(terrain[0].terrain, room) }
  }
  return { terrain }
}
