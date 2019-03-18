const fs = require('fs')
const util = require('util')
const path = require('path')
const axios = require('axios')

const readFile = util.promisify(fs.readFile)

module.exports.GET = async (req, res) => {
	let [,,, shard, zoom, room ] = req.url.split('/')
	if (room) {
		room = `${zoom}/${room}`
	} else {
		room = zoom
	}
	room = room.split('?')[0]
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

module.exports.path = '/assets/map/.*/?.*'
