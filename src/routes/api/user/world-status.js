module.exports.GET = async (req, res) => {
  const user = await req.authenticate('basic')
  const { shard } = req.query
  if (false && user) {
    if (!req.shards[shard]) return res.error('invalid shard')
    const { db } = req.shards[shard]
    const roomObjects = db.collection('rooms.objects')
    const count = await roomObjects.count({ user: user._id })
    if (!count) return { status: 'empty' }

    const objects = await roomObjects.find({ user: '' + user._id, type: { $in: ['spawn', 'controller'] } }).exec()
    const spawns = !!objects.find(o => o.type === 'spawn' && objects.find(c => c.type === 'controller' && c.user === o.user && c.room === o.room))
    return {
      status: spawns ? 'normal' : 'lost'
    }
  }
  return { ok: 1, status: 'normal' }
}
