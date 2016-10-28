/* eslint-disable no-console */
import express from 'express'
import test from 'blue-tape'
import tus from 'tus-js-client-olalonde'
import axios from 'axios'
import { createHash } from 'crypto'
import concat from 'concat-stream'
import eosCb from 'end-of-stream'

import setupMemStore from '../stores/memstore'
import setupFsStore from '../stores/fs-store'
import setupS3Store from '../stores/s3-store'

import tusboy from '../../src'
import { file } from '../common'

const eos = (stream, opts = {}) => new Promise((resolve, reject) => {
  eosCb(stream, opts, err => {
    if (err) return reject(err)
    resolve()
  })
})

const hash = (buf) => createHash('md5').update(buf).digest('hex')

const logger = (req, res, next) => {
  console.log(`${req.method} - ${req.url}`)
  next()
}

const setup = async (store, beforeComplete = () => {}) => {
  const app = express()
  app
    // .use(authenticate)
    .use(logger)
    .use('/:username/avatar', new express.Router({ mergeParams: true })
      .get('/', (req, res, next) => {
        // console.log('get')
        const key = `users/${req.params.username}/avatar-resized`
        const rs = store.createReadStream(key, ({ contentLength, metadata }) => {
          // TODO: aws s3 makes metadata keys lowercase...
          res.set('Content-Type', metadata.contentType)
          res.set('Content-Length', contentLength)
          rs.pipe(res)
        }).on('error', next)
      })
      .use('/upload', tusboy(store, {
        getKey: (req) => {
          // always return same key... last successful completed upload
          // wins.
          const key = `users/${req.params.username}/avatar`
          return key
        },
        beforeComplete,
        afterComplete: async (req, upload) => {
          // console.log('afterComplete')
          // TODO: leading slash doesn't work with minio
          // e.g. /users/.../...
          const key = `users/${req.params.username}/avatar`
          // console.log(`Completed upload ${completedUploadId}`)
          // If you return a promise, the last patch request will
          // block until promise is resolved.
          // e.g you could resize avatar and write it to .../avatar-resized
          const rs = store.createReadStream(key)
          const rsEos = eos(rs, { writable: false })
            // .pipe(resizeImage) actually resize image...
          const resizedKey = `users/${req.params.username}/avatar-resized`
          const { uploadId } = await store.create(resizedKey, {
            metadata: upload.metadata,
            uploadLength: upload.uploadLength,
          })
          await Promise.all([
            store.append(uploadId, rs),
            rsEos, // mostly to catch errors
          ])
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

const testStore = (getStore, type) => {
  let store
  test('setup store', async (t) => {
    t.comment(`setting up ${type} tus store`)
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
      onError: t.error,
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2)
        t.comment(`Uploaded ${bytesUploaded} of ${bytesTotal} bytes ${percentage}%`)
      },
      onSuccess: () => {
        t.comment(`Upload URL: ${upload.url}`)
        t.end()
      },
      retryDelays: [],
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

  test('setup app with beforeComplete', async () => {
    const result = await setup(store, () => {
      throw new Error('stop!')
    })
    baseURL = result.endpoint
    server = result.server
  })

  test('upload avatar (fail)', (t) => {
    const endpoint = `${baseURL}/olalonde/avatar/upload/`
    const upload = new tus.Upload(file('poem.txt').buf, {
      endpoint,
      metadata: {
        contentType: 'text/plain',
      },
      onError: (err) => {
        t.equal(err.originalRequest.status, 500)
        t.end()
      },
      onSuccess: () => {
        t.fail('we should not succeed...')
      },
    })
    upload.start()
  })

  test('make sure key was not overwritten', (t) => {
    const rs = store.createReadStream(
      'users/olalonde/avatar',
      ({ contentLength, metadata }) => {
        // TODO: aws s3 makes metadata keys lowercase...
        rs.pipe(concat((buf) => {
          t.equal(contentLength, file('crow.jpg').size)
          t.equal(metadata.contentType, 'image/jpeg')
          t.deepEqual(buf, file('crow.jpg').buf)
          t.end()
        }))
      }
    ).on('error', t.fail)
  })

  test('close server', (t) => {
    server.close()
    t.end()
  })
}

testStore(setupMemStore, 'mem')
testStore(setupFsStore, 'fs')
if (process.env.TEST_S3) {
  testStore(setupS3Store, 's3')
}
