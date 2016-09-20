# tusboy

[![Build Status](https://travis-ci.org/blockai/tusboy.svg?branch=master)](https://travis-ci.org/blockai/tusboy)

Express middleware for [tus resumable upload protocol](http://tus.io/).
Name inspired by [busboy](https://github.com/mscdex/busboy).

## Install

```bash
npm install --save tusboy
```

Requires Node v6+

## Usage

See [./test](./test) directory for usage examples.

Boilerplate example usage with S3:

```javascript
import tusboy from 'tusboy'
import s3store from 's3-tus-store'
import aws from 'aws-sdk'

import express, { Router } from 'express'

const store = s3store({
  client: new aws.S3({
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  }),
  bucket: 'my-bucket',
})

const app = express()
app
  // .use(authenticate)
  .get('/:username/avatar', (req, res, next) => {
    const key = `/users/${req.params.username}/avatar`
    store
      .info(key)
      .then(({
        uploadLength,
        uploadMetadata: { contentType },
      }) => {
        res.set('Content-Type', contentType)
        res.set('Content-Length', uploadLength)
        store
          .createReadStream(key)
          .on('error', next)
          .pipe(res)
      })
      .catch(next)
  })
  .use('/:username/avatar/upload', tusboy({
    // Must resolve to { uploadOffset }
    // If uploadLength is known, must resolve to { uploadOffset, uploadLength }

    // HEAD
    info: (req) => {
      const key = `/users/${req.params.username}/avatar`
      return store.info(key)
    },

    // PATCH
    write: (req) => {
      const key = `/users/${req.params.username}/avatar`
      return store.write(key, req).then(({ completed }) => {
         if (completed) {
           // do some post-processing? copy to another key?
           console.log(`upload ${key} completed`)
         }
      })
    },
  }))

app.listen(3000)
```