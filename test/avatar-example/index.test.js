/* eslint-disable no-console */
import express from 'express'
import test from 'blue-tape'
import tus from 'tus-js-client-olalonde'
import axios from 'axios'
import { createHash } from 'crypto'

import getMemStore from '../stores/memstore'
// import getFsStore from '../stores/fs-store'

import tusboy from '../../src'
import { file } from '../common'

const hash = (buf) => createHash('md5').update(buf).digest('hex')

const logger = (req, res, next) => {
  console.log(`${req.method} - ${req.url}`)
  next()
}

const setup = async (store) => {
  const app = express()
  app
    // .use(authenticate)
    .use(logger)
    .use('/:username/avatar', new express.Router({ mergeParams: true })
      .get('/', (req, res, next) => {
        const key = `/users/${req.params.username}/avatar-resized`
        const rs = store.createReadStream(key, ({ contentLength, metadata }) => {
          res.set('Content-Type', metadata.contentType)
          res.set('Content-Length', contentLength)
          rs.pipe(res)
        }).on('error', next)
      })
      .use('/upload', tusboy(store, {
        getKey: (req) => {
          // always return same key... last successful completed upload
          // wins.
          const key = `/users/${req.params.username}/avatar`
          return key
        },
        onComplete: async (req, upload, completedUploadId) => {
          const key = `/users/${req.params.username}/avatar`
          console.log(`Completed upload ${completedUploadId}`)
          // If you return a promise, the last patch request will
          // block until promise is resolved.
          // e.g you could resize avatar and write it to .../avatar-resized
          const rs = store.createReadStream(key)
            // .pipe(resizeImage) actually resize image...
          const resizedKey = `/users/${req.params.username}/avatar-resized`
          const { uploadId } = await store.create(resizedKey, {
            metadata: upload.metadata,
            uploadLength: upload.uploadLength,
          })
          await store.append(uploadId, rs)
        },
      }))
    )
  return new Promise((resolve) => {
    const server = app.listen(() => {
      const endpoint = `http://localhost:${server.address().port}`
      resolve({ endpoint, server })
    })
  })
}

const testStore = (getStore) => {
  let store
  test('setup store', async () => {
    store = await getStore()
  })

  let baseURL
  let server
  test('setup app', async () => {
    const result = await setup(store)
    baseURL = result.endpoint
    server = result.server
  })

  test('upload avatar', (t) => {
    const endpoint = `${baseURL}/olalonde/avatar/upload/`
    const upload = new tus.Upload(file('crow.jpg').buf, {
      endpoint,
      metadata: {
        contentType: 'image/jpeg',
      },
      // uploadSize: 'hello world'.length,
      onError: t.error,
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2)
        t.comment(`Uploaded ${bytesUploaded} of ${bytesTotal} bytes ${percentage}%`)
      },
      onSuccess: () => {
        t.comment(`Upload URL: ${upload.url}`)
        t.end()
      },
    })
    upload.start()
  })

  test('download "resized" avatar', async (t) => {
    const res = await axios.get(`${baseURL}/olalonde/avatar`, {
      responseType: 'arraybuffer',
    })
    t.deepEqual(hash(res.data), hash(file('crow.jpg').buf))
    t.equal(res.headers['content-type'], 'image/jpeg')
  })

  test('close server', (t) => {
    server.close()
    t.end()
  })
}

(async () => {
  try {
    testStore(getMemStore)
    // testStore(getFsStore)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()

