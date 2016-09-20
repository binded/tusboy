/* eslint-disable import/prefer-default-export */

import createError from 'http-errors'

export const tusResumableHeaderMissing = () => createError(412, 'Tus-Resumable Required')

export const invalidHeaders = (headers) => (
  createError(412, 'Precondition Failed', {
    details: { headers },
  })
)

export const invalidHeader = (header, val) => (
  createError(412, 'Precondition Failed', {
    details: { headers: [[header, val]] },
  })
)

export const missingHeader = (header) => invalidHeader(header)

export const entityTooLarge = (msg, props) => createError(413, msg, props)

export const preconditionError = (msg, props) => createError(412, msg, props)

export const offsetMismatch = (actual, expected) => (
  createError(409, `Offset mismatch, got ${actual} but expected ${expected}`)
)

// For store implementations:
export const unknownResource = (key) => (
  createError(404, `Unknown resource: ${key}`)
)

export const concurrentWrite = () => (
  createError(409, 'Concurrent write detected')
)

export const uploadLengthAlreadySet = () => (
  createError(409, 'Upload length is already set')
)
