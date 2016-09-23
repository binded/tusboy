# tusboy

[![Build Status](https://travis-ci.org/blockai/tusboy.svg?branch=master)](https://travis-ci.org/blockai/tusboy)

WORK IN PROGRESS!

Express middleware for [tus resumable upload protocol](http://tus.io/).
Uses [abstract-tus-store](https://github.com/blockai/abstract-tus-store).
Name inspired by [busboy](https://github.com/mscdex/busboy).

[![tus-store-compatible](https://github.com/blockai/abstract-tus-store/raw/master/badge.png)](https://github.com/blockai/abstract-tus-store)

## Install

```bash
npm install --save tusboy
```

Requires Node v6+

## Usage

See [./test](./test) directory for usage examples.

Boilerplate example usage with s3-tus-store:

```javascript
import tusboy from 'tusboy'
import s3store from 's3-tus-store'
import aws from 'aws-sdk'
import { Passthrough } from 'stream'

import express from 'express'

const bucket = 'my-bucket'
const client = new aws.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY
})
const store = s3store({ client, bucket })

const app = express()
app
  // .use(authenticate)
  .use('/:username/avatar', new express.Router({ mergeParams: true })
    .get('/', (req, res, next) => {
      const key = = `/users/${req.params.username}/avatar-resized`
      const rs = store.createReadStream(key, ({ contentLength, metadata }) => {
        rs.set('Content-Type', metadata.contentType)
        rs.set('Content-Length', contentLength)
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
      onComplete: async (req, upload, uploadId) => {
        const key = `/users/${req.params.username}/avatar-resized`
        console.log(`Completed upload ${uploadId}`)
        // If you return a promise, the last patch request will
        // block until promise is resolved.
        // e.g you could resize avatar and write it to .../avatar-resized
        const rs = store.createReadStream(key)
          // .pipe(resizeImage) actually resize image...
        const resizedKey = `/users/${req.params.username}/avatar-resized`
        const uploadId = await store.create(resizedKey, {
          metadata: upload.metadata,
          uploadLength: upload.uploadLength,
        })
        return store.append(resizedUploadId, rs)
      },
    }))
  )

app.listen(3000)
```