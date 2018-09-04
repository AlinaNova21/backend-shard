module.exports.GET = async (req, res) => {
  const { email } = req.query
  const user = await req.shards.common.db.collection('users').findOne({ email })
  return {
    error: user ? 'exists' : undefined
  }
}
