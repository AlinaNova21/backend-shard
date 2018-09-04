const badge = require('../../../lib/badge')
const badgeCache = {}

module.exports.GET = async (req, res) => {
  const username = req.query.username.toLowerCase()
  if (!badgeCache[username] || badgeCache[username].time < Date.now() - 60 * 60 * 1000) {
    const user = await req.shards.common.db.collection('users').findOne({ usernameLower: username })
    badgeCache[username] = {
      time: Date.now(),
      svg: user.badge
        ? badge.getBadgeSvg(user.badge)
        : `<svg xmlns="http://www.w3.org/2000/svg"></svg>`
    }
  }
  res.setHeader('content-type', 'image/svg+xml')
  return badgeCache[username].svg
}
