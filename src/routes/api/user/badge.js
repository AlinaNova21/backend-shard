const { json } = require('micro')

module.exports.POST = async (req, res) => {
  const user = await req.authenticate('basic')
  if (!user) return res.error('unauthorized')
  const { badge: { type, param, color1, color2, color3, flip } = {} } = await json(req)

  if (typeof param !== 'number' || param < -100 || param > 100) {
    return res.error('invalid params')
  }

  const colorRegex = /^#[a-f0-9]{6}/i
  if (!colorRegex.test(color1) || !colorRegex.test(color2) || !colorRegex.test(color3)) {
    return res.error('invalid params')
  }

  if (typeof type === 'number') {
    if (type < 1 || type > 24) {
      return res.error('invalid params')
    }
  } else {
    if (!user.customBadge || type.path1 !== user.customBadge.path1 || type.path2 !== user.customBadge.path2) {
      return res.error('invalid params')
    }
  }

  const { db } = req.shards.common
  const users = db.collection('users')

  const badge = { type, color1, color2, color3, param, flip: !!flip }
  return users.updateOne({ _id: user._id }, { $set: { badge } })
}
