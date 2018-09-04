const { EventEmitter } = require('events')

class PubSub {
  constructor (pub, sub) {
    this.ee = new EventEmitter()
    this.subscribed = {}
    sub.on('message', (channel, message) => {
      this.ee.emit(channel, message)
    })
    sub.on('pmessage', (pattern, channel, message) => {
      this.ee.emit(channel, message)
      this.ee.emit(pattern, channel, message)
    })
  }
  publish (channel, data) {
    this.pub.publish(channel, data)
    return q.when()
  }
  subscribe (channel, cb) {
    if (!this.subscribed[channel]) {
      if (channel.match(/[?*]/)) { this.sub.psubscribe(channel) } else { this.sub.subscribe(channel) }
      this.subscribed[channel] = true
    }
    this.ee.on(channel, cb)
    return q.when()
  }
  once (channel, cb) {
    if (!this.subscribed[channel]) {
      if (channel.match(/[?*]/)) { this.sub.psubscribe(channel) } else { this.sub.subscribe(channel) }
      this.subscribed[channel] = true
    }
    this.ee.once(channel, cb)
    return q.when()
  }
}
module.exports = PubSub
