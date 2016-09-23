/* eslint-disable no-console */
import express from 'express'
import wrapStore from 'keyed-tus-store'
import test from 'blue-tape'

import setupMemStore from '../stores/memstore'
import setupFsStore from '../stores/fs-store'
import setupS3Store from '../stores/s3-store'

import tusboy from '../../src'
import { counter } from '../common'
import integration from './'

const setupServer = async (store) => {
  const nextId = counter()
  const app = express()
  app.use((req, res, next) => {
    // console.log(`${req.method} - ${req.url}`)
    next()
  })
  app.get('/uploads/:uploadId', (req, res, next) => {
    const key = store.decodeKey(req.params.uploadId)
    const rs = store
      .createReadStream(key, ({ contentLength, metadata }) => {
        res.set('Content-Type', metadata.contentType)
        res.set('Content-Length', contentLength)
        rs.pipe(res)
      })
      .on('error', next)
  })
  app.use('/uploads', tusboy(store, {
    getKey: () => `somekey-${nextId()}`,
    /*
    onComplete: (req, upload, uploadId) => {
      const key = store.decodeKey(uploadId)
      console.log(`upload completed, data at ${key}`)
    },
    */
  }))
  return new Promise((resolve) => {
    const server = app.listen(() => {
      const endpoint = `http://localhost:${server.address().port}/uploads`
      resolve({ endpoint, server })
    })
  })
}

const testStore = (getStore) => {
  let server
  const setup = async () => {
    const origStore = await getStore()
    const store = wrapStore(origStore, 'some secret!')
    const result = await setupServer(store)
    const endpoint = result.endpoint
    server = result.server
    return endpoint
  }

  integration({ setup })

  test('teardown', (t) => {
    server.close()
    t.end()
  })
}

const start = () => {
  try {
    testStore(setupMemStore)
    testStore(setupFsStore)
    if (process.env.TEST_S3) {
      testStore(setupS3Store)
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

start()

