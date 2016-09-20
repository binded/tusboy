export const ERRORS = {
  MISSING_OFFSET: {
    status_code: 403,
    body: 'Upload-Offset header required\n',
  },
  INVALID_CONTENT_TYPE: {
    status_code: 403,
    body: 'Content-Type header required\n',
  },
  FILE_NOT_FOUND: {
    status_code: 404,
    body: 'The file for this url was not found\n',
  },
  INVALID_OFFSET: {
    status_code: 409,
    body: 'Upload-Offset conflict\n',
  },
  FILE_NO_LONGER_EXISTS: {
    status_code: 410,
    body: 'The file for this url no longer exists\n',
  },
  INVALID_LENGTH: {
    status_code: 412,
    body: 'Upload-Length or Upload-Defer-Length header required\n',
  },
  UNKNOWN_ERROR: {
    status_code: 500,
    body: 'Something went wrong with that request\n',
  },
  FILE_WRITE_ERROR: {
    status_code: 500,
    body: 'Something went wrong receiving the file\n',
  },
}

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

export const ALLOWED_METHODS = [
  'POST',
  'HEAD',
  'PATCH',
  'OPTIONS',
]
export const MAX_AGE = 86400
export const ALLOWED_HEADERS = HEADERS
export const EXPOSED_HEADERS = HEADERS
export const TUS_RESUMABLE = '1.0.0'
export const TUS_VERSIONS = ['1.0.0']
