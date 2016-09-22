// Full integration tests using the tus-js-client client
import express from 'express'
import { memstore } from 'abstract-tus-store'

import tusboy from '../src'
import integration from './integration'
import { counter } from './common'

const nextId = counter()

const setup = async () => {
  const store = memstore()
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

letsgo()
