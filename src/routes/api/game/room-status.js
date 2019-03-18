module.exports.GET = async (req, res) => {
  const { shard, room } = req.query
  const { db } = req.shards[shard] || {}
  if (!shard || !db) {
    return res.error('invalid shard')
  }
  const { status, novice, respawnArea, openTime } = await db.collection('rooms').findOne({ _id: room })
	return {
		room: status ? { status, novice, respawnArea, openTime } : null
	}
}
