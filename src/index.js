import { Router } from 'express'
import tusHeaderParser from 'tus-header-parser'
import methodOverride from 'method-override'
import cors from 'cors'
import w from 'express-async-wrap'

import * as constants from './constants'
import * as errors from './errors'

import errorHandler from './handlers/error'
import options from './handlers/options'
import head from './handlers/head'
import patch from './handlers/patch'
import post from './handlers/post'

// TODO
const detectExtensions = (store) => {
  const extensions = [
    'create',
    () => { if (store.del) return 'delete' },
  ].filter(ele => typeof ele === 'string')
  return extensions
}

// TODO (use semver module?)
const versionSupported = (/* versionStr */) => true

const setTusResumableHeader = (req, res, next) => {
  res.set('Tus-Resumable', constants.TUS_VERSION)
  next()
}

// The Tus-Resumable header MUST be included in every request and
// response except for OPTIONS requests. The value MUST be the version
// of the protocol used by the Client or the Server.
const assertTusResumableHeader = (req, res, next) => {
  if (!('tusResumable' in req.tus)) {
    res.set('Tus-Version', constants.TUS_VERSION)
    return next(errors.preconditionError('Tus-Resumable header missing'))
  } else if (!versionSupported(req.tus.tusResumable)) {
    res.set('Tus-Version', constants.TUS_VERSION)
    return next(errors.preconditionError('Tus-Resumable version not supported'))
  }
  next()
}

const setCorsHeaders = cors({
  origin: true,
  exposedHeaders: constants.EXPOSED_HEADERS,
})

export default (store, opts = {}) => {
  const { handleErrors = true } = opts
  const extensions = detectExtensions(store)
  const router = new Router({ mergeParams: true })
  router
    .use(methodOverride('X-HTTP-Method-Override'))
    .use(tusHeaderParser())
    .options('*', options(extensions))
    .use(setCorsHeaders)
    .use(setTusResumableHeader)
    .use(assertTusResumableHeader)
    .post('/', w(post(store, opts)))
    .head('/:uploadId', w(head(store, opts)))
    .patch('/:uploadId', w(patch(store, opts)))

  if (handleErrors) router.use(errorHandler)

  return router
}
