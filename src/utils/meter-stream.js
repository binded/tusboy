import { Transform } from 'stream'

class MeterSream extends Transform {
  constructor(maxSize = Infinity) {
    super()
    this.maxSize = maxSize
    this.byteCount = 0
  }
  _transform(chunk, encoding, cb) {
    if (this.maxSize === Infinity) return cb(null, chunk)
    this.byteCount += chunk.length
    if (this.byteCount > this.maxSize) {
      const err = new Error(`Stream exceeded specified max of ${this.maxSize} bytes.`)
      return cb(err)
    }
    cb(null, chunk)
  }
}

export default (maxSize) => new MeterSream(maxSize)
