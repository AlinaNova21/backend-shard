module.exports.GET = (req, res) => ({
  ok: 1,
  protocol: req.PROTOCOL,
  serverData: Object.assign({
    historyChunkSize: 100,
    shards: req.config.shards.map(s => s.name)
  }, req.config.serverData || {})
})
