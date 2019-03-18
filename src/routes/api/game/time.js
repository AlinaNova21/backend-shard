module.exports.GET = async (req, res) => {
  const { shard } = req.query
  const { redis } = req.shards[shard] || {}
  if (!shard || !redis) {
    return res.error('invalid shard')
  }
	return {
		time: +(await redis.get('gameTime'))
	}
}
