const { json } = require('micro')

module.exports.POST = async (req, res) => {
  const user = await req.authenticate()
  const { username, email } = await json(req)
  const $set = {
    username,
    usernameLower: username.toLowerCase()
  }

  if (email) {
    if (!/^[\w\d\-.+&]+@[\w\d\-.&]+\.[\w\d\-.&]{2,}$/.test(email)) {
      return res.error('invalid email')
    }
    $set.email = email.toLowerCase()
  }

  if (user.username) {
    return res.error('username already set')
  }
  if (!/^[a-zA-Z0-9_-]{3,}$/.test(username)) {
    return res.error('invalid username')
  }

  const existing = await req.shards.common.db.collection('users').findOne({ usernameLower: username.toLowerCase() })
  if (existing) {
    return res.error('invalid username')
  }
  for (const { name } of req.config.shards) {
    await req.shards[name].db.collection('users').updateOne({ _id: user._id }, { $set })
  }
  return {}
}
