import test from 'blue-tape'
import express from 'express'
import axios from 'axios'

import tusboy from '../src'

let server
let baseURL
let client

// TODO: test options

test('start server', (t) => {
  const app = express()
  app.use(tusboy({
    create: () => {},
    info: () => {},
    write: () => {},
    maxSize: 100000,
  }))
  server = app.listen(() => {
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
      t.equal(err.response.headers['tus-version'], '1.0.0')
      t.equal(err.response.status, 412)
      t.end()
    })
})

test('create (missing upload-length header)', (t) => {
  client
    .post('/')
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

test('close server', (t) => {
  server.close(() => t.end())
})
