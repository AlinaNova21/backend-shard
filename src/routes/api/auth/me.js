module.exports.GET = async (req, res) => {
  const user = await req.authenticate()
  if (!user) return res.error('unauthorized', 401)
  return user
}
