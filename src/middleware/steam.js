const SteamAPI = require('steamapi')

module.exports = async (fn) => {
  const steam = new SteamAPI(process.env.STEAM_KEY)
  return async (req, res) => {
    req.steam = steam
    return fn(req, res)
  }
}
