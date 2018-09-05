const { EventEmitter } = require('events')

class PubSub {
  constructor (pub, sub) {
    this.ee = new EventEmitter()
    this.subscribed = {}
    this.sub = sub
    this.pub = pub
    sub.on('message', (channel, message) => {
      this.ee.emit(channel, message)
    })
    sub.on('pmessage', (pattern, channel, message) => {
      this.ee.emit(channel, message)
      this.ee.emit(pattern, channel, message)
    })
  }
  async publish (channel, data) {
    this.pub.publish(channel, data)
  }
  async subscribe (channel, cb) {
    if (!this.subscribed[channel]) {
      if (channel.match(/[?*]/)) { this.sub.psubscribe(channel) } else { this.sub.subscribe(channel) }
      this.subscribed[channel] = true
    }
    this.ee.on(channel, cb)
  }
  async once (channel, cb) {
    if (!this.subscribed[channel]) {
      if (channel.match(/[?*]/)) { this.sub.psubscribe(channel) } else { this.sub.subscribe(channel) }
      this.subscribed[channel] = true
    }
    this.ee.once(channel, cb)
  }
}
module.exports = PubSub
