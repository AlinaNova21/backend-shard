module.exports.GET = async (req, res) => {
  const shards = await Promise.all(req.config.shards.map(async s => {
    const { db, redis } = req.shards[s.name]
    const [ rooms, users, lastTicks ] = await Promise.all([
      await db.collection('rooms').find({ status: 'normal' }).count(),
      await db.collection('users').find({ active: { $ne: 0 } }).count(),
      JSON.parse(await redis.get('lastTicks') || '[]')
    ])
    console.log(s.name, 'lastTicks', lastTicks, await redis.get('lastTicks'))
    return {
      name: s.name,
      lastTicks,
      rooms,
      users,
      tick: lastTicks.reduce((a, b) => a + b, 0) / lastTicks.length
    }
  }))
  return {
    ok: 1,
    shards
  }
}
