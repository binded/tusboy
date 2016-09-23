/* eslint-disable no-console */
import express from 'express'
import wrapStore from 'keyed-tus-store'

import getMemStore from './stores/memstore'
import getFsStore from './stores/fs-store'

import tusboy from '../src'
import integration from './integration'
import { counter } from './common'

const setup = async (store) => {
  const nextId = counter()
  const app = express()
  app.use((req, res, next) => {
    console.log(`${req.method} - ${req.url}`)
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
  }))
  return new Promise((resolve) => {
    const server = app.listen(() => {
      const endpoint = `http://localhost:${server.address().port}/uploads`
      resolve({ endpoint, server })
    })
  })
}

const testStore = async (getStore) => {
  const origStore = await getStore()
  const store = wrapStore(origStore, 'some secret!')
  const { endpoint, server } = await setup(store)
  await integration({ endpoint })
  server.close()
}

const start = async () => {
  try {
    testStore(getMemStore)
    testStore(getFsStore)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

start()

