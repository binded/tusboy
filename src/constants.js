const HEADERS = [
  'Content-Type',
  'Location',
  'Tus-Extension',
  'Tus-Max-Size',
  'Tus-Resumable',
  'Tus-Version',
  'Upload-Defer-Length',
  'Upload-Length',
  'Upload-Metadata',
  'Upload-Offset',
  'X-HTTP-Method-Override',
  'X-Requested-With',
]
export const MAX_AGE = 86400
export const ALLOWED_HEADERS = HEADERS
export const EXPOSED_HEADERS = HEADERS

export const ALLOWED_METHODS = [
  'POST',
  'HEAD',
  'PATCH',
  'OPTIONS',
]

export const TUS_VERSION = '1.0.0'
