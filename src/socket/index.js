module.exports = (server, PROTOCOL) => {
  server.on('connection', conn => {
    console.log('Socket Connection')
    conn.write('time ' + new Date().getTime())
    conn.write('protocol ' + PROTOCOL)
    conn.on('data', data => {
      console.log('socket', data)
    })
  })
}
