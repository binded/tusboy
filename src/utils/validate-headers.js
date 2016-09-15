import * as constants from '../constants'

// min <= n <= max
const numberBetween = (min, max = Infinity) => (n) => (
  !isNaN(n) && parseInt(n, 10) >= min && parseInt(n, 10) <= max
)
const isPositiveNumber = numberBetween(0, Infinity)

const validators = new Map([
  // All PATCH requests MUST use Content-Type: application/offset+octet-stream
  // TODO: only for PATCH requests
  // ['content-type', v => v === 'application/offset+octet-stream'],
  ['location', () => true],
  ['tus-extension', () => true],
  ['tus-max-size', () => true],
  ['tus-resumable', v => constants.TUS_RESUMABLE === v],
  ['tus-version', v => constants.TUS_VERSIONS.includes(v)],
  // Always must be equal to 1
  ['upload-defer-length', v => parseInt(v, 10) === 1],
  ['upload-length', numberBetween(1, Infinity)],

  // The Upload-Metadata request and response header MUST consist of one
  // or more comma-separated key-value pairs. The key and value MUST be
  // separated by a space. The key MUST NOT contain spaces and commas and
  // MUST NOT be empty. The key SHOULD be ASCII encoded and the value MUST
  // be Base64 encoded. All keys MUST be unique.
  ['upload-metadata', (v) => {
    const keypairs = v.split(',').map(str => str.trim())
    const hasInvalidKeyPair = keypairs.some(
      (keypair) => keypair.split(' ').length !== 2
    )
    return !hasInvalidKeyPair
  }],
  ['upload-offset', isPositiveNumber],
  ['x-http-method-override', () => true],
  ['x-requested-with', () => true],
])

const validate = (name, value) => {
  const validator = validators.get(name.toLowerCase())
  if (!validator) return true
  return validator(value)
}

// Returns empty array if no validation errors
// Returns array of invalid [header, value] pairs
export default (headers = {}) => Object
  .keys(headers)
  .map(headerName => [headerName, headers[headerName]])
  .map(([name, value]) => [name, value, validate(name, value)])
  .filter(([,, isValid]) => !isValid)
  .map(([name, value]) => ([name, value]))
