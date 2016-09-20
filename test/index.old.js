import test from 'blue-tape'
import http from 'http'
import express from 'express'
import axios from 'axios'
import concat from 'concat-stream'

import initTus, { errors } from '../src'

let server
let baseURL
let client

class MockStore {
  constructor(opts) {
    Object.assign(this, opts)
    this.extensions = []
    this.uploadResources = []
  }
  create({ metadata, uploadLength }) {
    const key = this.uploadResources.length
    this.uploadResources.push({
      metadata,
      uploadLength,
      key,
      offset: 0,
      data: new Buffer([]),
    })
    return Promise.resolve({ key })
  }
  stats(key) {
    return Promise.resolve(this.uploadResources[key])
  }
  write(key, readStream) {
    const uploadResource = this.uploadResources[key]
    if (!uploadResource) {
      return Promise.reject(errors.unknownResource(key))
    }
    if (uploadResource.locked) {
      return Promise.reject(errors.concurrentWrite())
    }
    uploadResource.locked = true
    return new Promise((resolve) => {
      readStream.pipe(concat((buf) => {
        if (!buf) return resolve(uploadResource.offset)
        uploadResource.data = Buffer.concat([uploadResource.data, buf])
        uploadResource.offset = uploadResource.data.length
        resolve(uploadResource.offset)
      }))
    })
    .then(result => {
      uploadResource.locked = false
      return result
    })
    .catch(err => {
      uploadResource.locked = false
      throw err
    })
  }
}

test('start server', (t) => {
  const app = express()
  app.use(initTus(new MockStore({
    maxSize: 100000,
  })))
  server = http.createServer(app)
  server.listen(() => {
    baseURL = `http://localhost:${server.address().port}`
    client = axios.create({
      baseURL,
      headers: {
        'Tus-Resumable': '1.0.0',
      },
    })
    t.end()
  })
})

test('missing Tus-Resumable error', (t) => {
  axios
    .get(baseURL)
    .catch((err) => {
      t.equal(err.response.status, 412)
      t.equal(err.response.data.message, 'Tus-Resumable Required')
      t.end()
    })
})

test('invalid headers', (t) => {
  client
    .get('/', {
      headers: {
        'upload-Offset': 'not a number',
        'upload-length': -10,
        'tus-version': '1337',
      },
    })
    .catch((err) => {
      t.equal(err.response.status, 412)
      const data = err.response.data
      t.equal(data.message, 'Precondition Failed')
      t.deepEqual(data.details, {
        headers: [
          ['upload-offset', 'not a number'],
          ['upload-length', '-10'],
          ['tus-version', '1337'],
        ],
      })
      t.end()
    })
})

test('create (missing upload-length header)', (t) => {
  client.post('/')
    .catch((err) => {
      t.equal(err.response.status, 412)
      t.equal(err.response.data.message, 'Missing Upload-Length header')
      t.end()
    })
})

test('create (too large)', (t) => {
  client.post('/', null, { headers: { 'upload-length': 200000 } })
    .catch((err) => {
      t.equal(err.response.headers['tus-max-size'], '100000')
      t.equal(err.response.status, 413)
      t.ok(err.response.data.message.match(/exceeds max upload size/))
      t.end()
    })
})

test('create', (t) => (
  client.post('/', null, { headers: { 'upload-length': 100 } })
    .then((response) => {
      t.equal(response.headers.location, '/0')
    })
))

test('head (404)', (t) => {
  client.head('/devnull')
    .catch(({ response }) => {
      t.equal(response.status, 404)
      t.end()
    })
})

test('head', (t) => (
  client.head('/0')
    .then((response) => {
      t.equal(response.headers['upload-length'], '100')
      t.equal(response.headers['upload-offset'], '0')
      t.equal(response.headers['upload-metadata'], undefined)
    })
))

test('patch (wrong content type)', (t) => {
  client
    .patch('/0', 'somedata', {
      headers: { 'content-type': 'text/plain' },
    })
    .catch((err) => {
      t.equal(err.response.status, 412)
      t.end()
    })
})

test('patch (missing offset)', (t) => {
  client
    .patch('/0', 'somedata!!', {
      headers: { 'content-type': 'application/offset+octet-stream' },
    })
    .catch((err) => {
      t.equal(err.response.status, 412)
      t.end()
    })
})

test('patch (invalid offset)', (t) => {
  client
    .patch('/0', 'somedata!!', {
      headers: {
        'content-type': 'application/offset+octet-stream',
        'upload-offset': '1',
      },
    })
    .catch((err) => {
      t.equal(err.response.status, 409)
      t.end()
    })
})

test('patch (success)', (t) => (
  client
    .patch('/0', 'somedata!!', {
      headers: {
        'content-type': 'application/offset+octet-stream',
        'upload-offset': '0',
      },
    })
    .then((response) => {
      t.equal(response.status, 204)
      t.equal(response.headers['upload-offset'], `${'somedata!!'.length}`)
    })
))

test('patch (keep uploading until the end)', (t) => (
  client
    .patch('/0', Buffer.alloc(100 - 'somedata!!'.length), {
      headers: {
        'content-type': 'application/offset+octet-stream',
        'upload-offset': 'somedata!!'.length,
      },
    })
    .then((response) => {
      t.equal(response.status, 204)
      t.equal(response.headers['upload-offset'], '100')
    })
))

test('patch (uploading over upload-length)', (t) => {
  client
    .patch('/0', 'a', {
      headers: {
        'content-type': 'application/offset+octet-stream',
        'upload-offset': '100',
      },
    })
    .catch((err) => {
      t.equal(err.message, 'socket hang up')
      t.end()
    })
})

test('close server', (t) => {
  server.close(() => t.end())
})
