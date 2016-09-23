// Full integration tests using the tus-js-client client
import express from 'express'
import { memstore } from 'abstract-tus-store'
import wrapStore from 'keyed-tus-store'

import tusboy from '../src'
import integration from './integration'
import { counter } from './common'

const nextId = counter()

const setup = async () => {
  const store = wrapStore(memstore(), 'some secret!')
  const app = express()
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

const letsgo = async () => {
  const { endpoint, server } = await setup()
  await integration({ endpoint })
  server.close()
}

letsgo().catch((err) => {
  /* eslint-disable no-console */
  console.error(err)
  process.exit(1)
})
