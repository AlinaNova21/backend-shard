const { json } = require('micro')
const { translateModulesFromDb, translateModulesToDb } = require('../../../lib/codeUtils')
module.exports.POST = async (req, res) => {
  const user = await req.authenticate('basic')
  if (!user) return res.error('unauthorized')
  const body = await json(req)
  if (JSON.stringify(body.modules).length > 2 * 1024 * 1024) {
    return res.error('code length exceeds 2 MB limit')
  }
  body.modules = translateModulesToDb(body.modules)
  const { branch } = body
  const query = getCodeQuery(user._id, branch)

  const { db, redis, pubsub } = req.shards.common
  const users = db.collection('users')
  const userCode = db.collection('users.code')

  await users.update({ _id: user._id }, { $set: { active: 10000 } }).exec()
  const { modified } = await userCode.update(query, {
    $set: {
      modules: body.modules,
      timestamp: new Date().getTime()
    }
  })
  if (!modified) {
    return res.error('branch does not exist')
  }
  await redis.del(`scrScriptCachedData:${user._id}`)
  const code = await userCode.findOne(query)
  pubsub.publish(`user:${user._id}/code`, JSON.stringify({ id: '' + code._id, hash: body._hash }))
  return { timestamp: Date.now() }
}

module.exports.GET = async (req, res) => {
  const user = await req.authenticate()
  if (!user) return res.error('unauthorized')
  const { branch = '$activeWorld' } = req.query
  const query = getCodeQuery(user._id, branch)

  const { db } = req.shards.common
  const userCode = db.collection('users.code')

  const data = userCode.findOne(query)
  if (!data) {
    return res.error('no code')
  }

  return {
    branch: data.branch,
    modules: translateModulesFromDb(data.modules)
  }
}

function getCodeQuery (user, branch) {
  if (branch[0] === '$') {
    const activeName = branch.substring(1)
    return { $and: [{ user }, { [activeName]: true }] }
  } else {
    return { $and: [{ user }, { branch }] }
  }
}
