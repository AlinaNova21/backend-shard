module.exports.GET = async (req, res) => {
  const { username } = req.query
  const user = await req.shards.common.db.collection('users').findOne({ usernameLower: username.toLowerCase() })
  return {
    error: user ? 'exists' : undefined
  }
}
