const { json } = require('micro')

module.exports.POST = async (req, res) => {
  req.body = await json(req)
  const user = await req.authenticate(['local', 'basic'])
  if (!user) return res.error('unauthorized')
  const token = await req.auth.genToken(user._id)
  return { ok: 1, token }
}
