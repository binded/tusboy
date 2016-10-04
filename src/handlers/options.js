import cors from 'cors'
import { ALLOWED_HEADERS, ALLOWED_METHODS, MAX_AGE } from '../constants'

const tusExtension = (extensions = []) => {
  if (!extensions.length) {
    return (req, res, next) => next()
  }
  return (req, res, next) => {
    res.set('Tus-Extension', extensions.join(','))
    next()
  }
}

const corsPreflight = (extraMethods) => cors({
  methods: [...ALLOWED_METHODS, ...extraMethods],
  allowedHeaders: ALLOWED_HEADERS,
  maxAge: MAX_AGE,
})

export default (extensions, extraMethods = []) => ([
  tusExtension(extensions),
  corsPreflight(extraMethods),
])
