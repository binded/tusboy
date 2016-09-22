import test from 'blue-tape'
import express from 'express'
import axios from 'axios'
import { encode } from 'tus-metadata'
import { createHash } from 'crypto'
import { memstore } from 'abstract-tus-store'

import tusboy from '../src'
import { file, counter } from './common'

const md5 = (buf) => createHash('md5').update(buf).digest()

let server
let baseURL
let client

const store = memstore()

const nextId = counter()

test('start server', (t) => {
  const app = express()
  app.use('/uploads', tusboy(store, {
    getKey: () => `${nextId()}`,
  }))
  app.get('/files/:key', (req, res, next) => {
    const rs = store
      .createReadStream(req.params.key, ({ contentLength, metadata }) => {
        res.set('Content-Type', metadata.contentType)
        res.set('Content-Length', contentLength)
        rs.pipe(res)
      })
      .on('error', next)
  })
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

let uploadUrl0
test('create', (t) => (
  client
    .post('/uploads', null, {
      headers: {
        'Upload-Length': file('crow.jpg').size,
        'Upload-Metadata': encode({
          contentType: file('crow.jpg').contentType,
        }),
      },
    })
    .then((response) => {
      t.equal(typeof response.headers.location, 'string', 'Location header')
      uploadUrl0 = response.headers.location
    })
))

let uploadUrl1
test('create', (t) => (
  client
    .post('/uploads', null, {
      headers: {
        'Upload-Length': file('crow.jpg').size,
        'Upload-Metadata': encode({
          contentType: file('crow.jpg').contentType,
        }),
      },
    })
    .then((response) => {
      uploadUrl1 = response.headers.location
      t.equal(typeof uploadUrl1, 'string', 'Location header')
      t.notEqual(uploadUrl0, uploadUrl1)
    })
))

test('head', (t) => (
  client
    .head(uploadUrl1)
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
  const rs = file('crow.jpg').rs({ start: 0, end: halfway })
  return client
    .patch(uploadUrl1, rs, {
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': 0,
      },
    })
    .then((response) => {
      const { headers } = response
      t.equal(headers['upload-offset'], `${halfway + 1}`, 'Upload-Offset')
    })
})

test('patch (wrong offset)', (t) => {
  const halfway = Math.floor(file('crow.jpg').size / 2)
  const rs = file('crow.jpg').rs()
  client
    .patch(uploadUrl1, rs, {
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': halfway - 10,
      },
    })
    .catch(({ response }) => {
      t.equal(response.status, 409)
      t.end()
    })
})

test('patch (second half)', (t) => {
  const halfway = Math.floor(file('crow.jpg').size / 2)
  const rs = file('crow.jpg').rs({ start: halfway + 1 })
  return client
    .patch(uploadUrl1, rs, {
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': halfway + 1,
      },
    })
    .then((response) => {
      const { headers } = response
      t.equal(headers['upload-offset'], `${file('crow.jpg').size}`, 'Upload-Offset')
    })
})

test('read file', (t) => (
  client
    .get('/files/1', {
      responseType: 'arraybuffer',
    })
    .then((response) => {
      t.equal(response.headers['content-type'], 'image/jpeg')
      t.equal(response.headers['content-length'], `${file('crow.jpg').size}`)
      t.deepEqual(md5(response.data), md5(file('crow.jpg').buf))
    })
))

test((t) => {
  server.close(() => t.end())
})
