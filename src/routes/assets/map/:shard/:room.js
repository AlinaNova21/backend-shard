const fs = require('fs')
const util = require('util')
const path = require('path')
const axios = require('axios')

const readFile = util.promisify(fs.readFile)

module.exports.GET = async (req, res) => {
  const { shard, room } = req.params
  try {
    const { dir, http } = req.shards[shard].config.assets
    if (dir) {
      return await readFile(path.join(dir, `map/${room}`))
    }
    if (http) {
      return await axios.get(`${http}/map/${room}`)
    }
    return null
  } catch (e) {
    return res.error('not found', 404)
  }
}
