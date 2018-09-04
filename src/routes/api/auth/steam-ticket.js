const { json } = require('micro')
const appid = 464350
const axios = require('axios')

module.exports.POST = async (req, res) => {
  const { ticket } = await json(req)
  const { data, data: { response: { params: { steamid, result } } } } = await axios.get('https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/', {
    params: {
      appid,
      ticket,
      key: req.config.auth.steam.apiKey
    }
  })
  // req.steam.authenticateUserTicket({ appid, ticket })

  if (result !== 'OK') {
    return res.error('could not authenticate')
  }
  const { db } = req.shards.common
  const users = db.collection('users')
  let user = await users.findOne({ 'steam.id': steamid })
  if (!user) {
    user = {
      steam: { id: steamid },
      cpu: 100,
      cpuAvailable: 0,
      registeredDate: new Date(),
      credits: 0,
      gcl: 0
    }
    console.log('Creating new user')
    for (const { name } of req.config.shards) {
      const { db, redis } = req.shards[name]
      const { insertedId } = await db.collection('users').insertOne(user)
      user._id = insertedId
      await db.collection('users.code').insertOne({
        user: user._id,
        modules: { main: 'module.exports.loop = function(){}' },
        branch: 'default',
        activeWorld: true,
        activeSim: true
      })
      await redis.set(`scrUserMemory:${user._id}`, JSON.stringify({}))
    }
  }
  console.log(`Sign in: ${user.username} (${user._id}), IP=${req.ip}, steamid=${steamid}`)
  const token = await req.auth.genToken(user._id)
  return {
    ok: 1,
    steamid,
    token
  }
}
