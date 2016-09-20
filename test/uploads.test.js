import test from 'blue-tape'
import express from 'express'
import axios from 'axios'
import { encode } from 'tus-metadata'

import tusboy from '../src'
import { setupFsStore, file } from './common'

let server
let baseURL
let client
let store

test('setup', (t) => {
  store = setupFsStore()
  t.end()
})

const nextId = (() => {
  let i = 0
  return () => {
    const next = i
    i += 1
    return `${next}`
  }
})()


test('start server', (t) => {
  const app = express()
  app.use(tusboy({
    create: (req) => {
      const key = nextId()
      const uploadLength = req.tus.uploadLength
      return store
        .create(key, { uploadLength })
        .then(() => `/${key}`)
    },
    info: (req) => {
      const key = req.params[0].substr(1)
      return store.info(key)
    },
    write: (req) => {
      const key = req.params[0].substr(1)
      return store.write(key, req)
    },
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

test('create', (t) => (
  client
    .post('/', null, {
      headers: {
        'Upload-Length': file('crow.jpg').size,
        'Upload-Metadata': encode({
          contentType: file('crow.jpg').contentType,
        }),
      },
    })
    .then((response) => {
      t.equal(response.headers.location, '/0', 'Location header')
    })
))

test('create', (t) => (
  client
    .post('/', null, {
      headers: {
        'Upload-Length': file('crow.jpg').size,
        'Upload-Metadata': encode({
          contentType: file('crow.jpg').contentType,
        }),
      },
    })
    .then((response) => {
      t.equal(response.headers.location, '/1', 'Location header')
    })
))

test('head', (t) => (
  client
    .head('/1')
    .then((response) => {
      const { headers } = response
      t.equal(headers['cache-control'], 'no-store', 'cache-control')
      t.equal(headers['tus-resumable'], '1.0.0', 'tus-resumable')
      t.equal(
        headers['upload-length'],
        `${file('crow.jpg').size}`,
        'Upload-Length',
      )
    })
))

// TODO: test options

test('patch (first half)', (t) => {
  const halfway = Math.floor(file('crow.jpg').size / 2)
  const rs = file('crow.jpg').rs({ start: 0, end: halfway - 1 })
  return client
    .patch('/1', rs, {
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': 0,
      },
    })
    .then((response) => {
      const { headers } = response
      t.equal(headers['upload-offset'], `${halfway}`, 'Upload-Offset')
    })
})

test('patch (second half)', (t) => {
  const halfway = Math.floor(file('crow.jpg').size / 2)
  const rs = file('crow.jpg').rs({ start: halfway })
  return client
    .patch('/1', rs, {
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': halfway,
      },
    })
    .then((response) => {
      const { headers } = response
      t.equal(headers['upload-offset'], `${file('crow.jpg').size}`, 'Upload-Offset')
    })
})

test((t) => {
  server.close(() => t.end())
})
