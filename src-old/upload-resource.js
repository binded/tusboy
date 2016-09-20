import { PassThrough } from 'stream'
import MeterStream from './utils/meter-stream'
import * as errors from './errors'
import {
  encode as encodeMetadata,
  decode as decodeMetadata,
} from './utils/metadata'

const headerExists = (req, name) => typeof req.get(name) !== 'undefined'

const ensureTrailingSlash = (str) => (
  str[str.length - 1] === '/' ? str : `${str}/`
)

// const tap = fn => (res) => fn(res).then(() => res)

export default (store) => {
  const create = (req, res, next) => {
    const defer = headerExists(req, 'upload-defer-length')
    if (!defer && !headerExists(req, 'upload-length')) {
      return next(errors.preconditionError(
        'Missing Upload-Length header'
      ))
    }
    if (defer && headerExists(req, 'upload-length')) {
      return next(errors.preconditionError(
        'Choose one of Upload-Length OR Upload-Defer-Length'
      ))
    }
    if (defer && !store.extensions.includes('creation-defer-length')) {
      return next(errors.preconditionError(
        'Store does not support creation-defer-length extension'
      ))
    }
    const uploadLength = defer ? null : parseInt(req.get('upload-length'), 10)
    const maxSize = store.maxSize
    if (uploadLength !== null && uploadLength > maxSize) {
      res.set('Tus-Max-Size', maxSize)
      return next(errors.entityTooLarge(
        `Upload-length (${uploadLength}) exceeds max upload size (${maxSize})`
      ), { maxSize, uploadLength })
    }

    const metadata = decodeMetadata(req.get('upload-metadata'))

    const opts = { defer, metadata, uploadLength }
    return store.create(opts, req)
      .then(({ key }) => {
        res.status(201)
        res.set('Location', `${ensureTrailingSlash(req.path)}${store.encodeKey(key, req)}`)
        res.end()
      })
      .catch(next)
  }

  const head = (req, res, next) => {
    // The Server MUST prevent the client and/or proxies from caching
    // the response by adding the Cache-Control: no-store header to the
    // response.
    res.set('Cache-Control', 'no-store')
    store
      .stats(store.decodeKey(req.params.encodedKey, req))
      .then((upload) => {
        if (!upload) {
          //  If the resource is not found, the Server SHOULD return
          //  either the 404 Not Found, 410 Gone or 403 Forbidden status
          //  without the Upload-Offset header.
          return next()
        }
        const { offset = 0, uploadLength, metadata, defer } = upload
        if (defer) {
          //  As long as the length of the upload is not known, the Server
          //  MUST set Upload-Defer-Length: 1 in all responses to HEAD requests.
          res.set('Upload-Defer-Length', '1')
        } else {
          // If the size of the upload is known, the Server MUST include
          // the Upload-Length header in the response
          res.set('Upload-Length', uploadLength)
        }
        // If an upload contains additional metadata, responses to HEAD
        // requests MUST include the Upload-Metadata header and its value as
        // specified by the Client during the creation.
        const encodedMetadata = encodeMetadata(metadata)
        if (encodedMetadata !== '') {
          res.set('Upload-Metadata', encodeMetadata(metadata))
        }

        // The Server MUST always include the Upload-Offset header in the
        // response for a HEAD request, even if the offset is 0, or the upload
        // is already considered completed.
        res.set('Upload-Offset', offset)
        res.end()
      })
      .catch(next)
  }

  const patch = (req, res, next) => {
    // The request MUST include a Upload-Offset header
    if (!headerExists(req, 'upload-offset')) {
      return next(errors.missingHeader('upload-offset'))
    }

    // The request MUST include a Content-Type header
    if (!headerExists(req, 'content-type')) {
      return next(errors.missingHeader('content-type'))
    }

    // All PATCH requests MUST use Content-Type: application/offset+octet-stream
    if (req.get('content-type') !== 'application/offset+octet-stream') {
      return next(errors.invalidHeader('content-type', req.get('content-type')))
    }

    const offset = parseInt(req.get('upload-offset'), 10)

    const key = store.decodeKey(req.params.encodedKey, req)

    return store
      .stats(key, req)
      .then((upload) => {
        if (!upload) throw errors.unknownResource()
        // If the offsets do not match, the Server MUST respond with the
        // 409 Conflict status without modifying the upload resource.
        if (upload.offset !== offset) {
          throw errors.offsetMismatch(offset, upload.offset)
        }
        if (headerExists(req, 'upload-length')) {
          // Upload-Length header set but upload-length is already known
          if (!upload.defer) throw errors.uploadLengthAlreadySet()
          if (!store.extensions.includes('creation-defer-length')) {
            throw errors.preconditionError(
              'got upload-length header but creation-defer-length extension is not supported'
            )
          }
          const uploadLength = parseInt(req.get('upload-length'), 10)
          return store
            .setUploadLength(key, uploadLength)
            .then(() => ({
              ...upload,
              uploadLength,
            }))
        }
        return upload
      })
      .then((upload) => {
        const maxStreamSize = upload.uploadLength - upload.offset
        const readStream = req.pipe(new MeterStream(maxStreamSize))
        let destroyed = false
        readStream.on('error', () => {
          // stream size exceeded, abort request
          destroyed = true
          req.destroy()
        })

        // we pipe through passthrough so overflow error not visible
        // from store
        return store
          .write(key, readStream.pipe(new PassThrough()))
          .then((newOffset) => {
            if (destroyed) return
            //  It MUST include the Upload-Offset header containing the new offset.
            res.set('Upload-Offset', newOffset)
            // The Server MUST acknowledge successful PATCH requests
            // with the 204 No Content status.
            res.status(204)
            res.end()
          })
      })
      .catch(next)
  }

  return { create, head, patch }
}
