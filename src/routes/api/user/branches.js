const { translateModulesFromDb } = require('../../../lib/codeUtils')

module.exports.GET = async (req, res) => {
  const user = await req.authenticate()
  if (!user) return res.error('unauthorized')
  const { shard } = req.query
  if (!req.shards[shard]) return res.error('invalid shard')
  const { db } = req.shards[shard]
  const userCode = db.collection('users.code')

  const list = await userCode.find({ user: '' + user._id }).toArray()
  if (!list.find(b => b.branch === 'default')) {
    await userCode.insert({
      user: '' + user._id,
      branch: 'default',
      modules: { main: '' },
      timestamp: new Date()
    })
    const rec = await userCode.findOne({ user: '' + user._id, branch: 'default' }).exec()
    list.push(rec)
  }
  list.forEach(branch => {
    if (branch.modules) {
      branch.modules = translateModulesFromDb(branch.modules)
    }
  })
  return { list }
}
