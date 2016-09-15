import { Router } from 'express'
import methodOverride from 'method-override'
import cors from 'cors'

import wrapStore from './wrap-store'
import errorHandler from './error-handler'
import validateHeadersObject from './utils/validate-headers'
import initUploadResource from './upload-resource'
import * as errors from './errors'
import * as constants from './constants'

export { errors }

const router = () => new Router()

// TODO: optional locking with redis if store doesn't support natively?

// Skip middleware if req.method is OPTIONS
const skipOptions = (middleware) => (req, res, next) => {
  if (req.method === 'OPTIONS') return next()
  middleware(req, res, next)
}

// The Tus-Resumable header MUST be included in every request and
// response except for OPTIONS requests. The value MUST be the version
// of the protocol used by the Client or the Server.
const validateTusResumableHeader = skipOptions((req, res, next) => {
  if (typeof req.get('Tus-Resumable') === 'undefined') {
    return next(errors.tusResumableHeaderMissing())
  }
  next()
})

const validateHeaderSyntax = skipOptions((req, res, next) => {
  // Validate all required headers to adhere to the tus protocol
  const invalidHeaders = validateHeadersObject(req.headers)
  if (invalidHeaders.length) {
    return next(errors.invalidHeaders(invalidHeaders))
  }
  next()
})

const setTusHeader = (req, res, next) => {
  res.set('Tus-Resumable', constants.TUS_RESUMABLE)
  next()
}

const setCorsHeaders = cors({
  origin: true,
  exposedHeaders: constants.EXPOSED_HEADERS,
  preflightContinue: true,
})

const setTusExtensionHeader = (extensions) => {
  if (!extensions.length) {
    return (req, res, next) => next()
  }
  return (req, res, next) => {
    res.set('Tus-Extension', extensions.join(','))
    next()
  }
}

// Handle preflight requests
const preflightHandler = cors({
  methods: constants.ALLOWED_METHODS,
  allowedHeaders: constants.ALLOWED_HEADERS,
  maxAge: constants.MAX_AGE,
})

// TODO: wrapStore
export default (unwrappedStore, {
  handleErrors = true,
  maxSize = Infinity,
  onUploadCompleted = () => {},
} = {}) => {
  const store = wrapStore(unwrappedStore)
  const opts = { maxSize, onUploadCompleted }
  const uploadResource = initUploadResource(store, opts)
  const route = router()
    .use(methodOverride('X-HTTP-Method-Override'))
    .use(setTusHeader)
    .use(validateTusResumableHeader)
    .use(validateHeaderSyntax)
    .options('*', setTusExtensionHeader(store.extensions))
    .options('*', preflightHandler)
    .use(setCorsHeaders)
    .post('/', uploadResource.create)
    .head('/:key', uploadResource.head)
    .patch('/:key', uploadResource.patch)

  if (handleErrors) route.use(errorHandler)

  return route
}
