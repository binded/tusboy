// Validate / clean up store implementation

const isFunction = (fn) => typeof fn === 'function'

// 1. throws if store doesn't implement required methods
// 2. detects which extensions store supports based on implemented methods
// 3. creates new object that proxies store and adds .extensions &
//    .maxSize props
export default (store) => {
  const schema = {
    required: ['write', 'stats'],
    extensions: [
      /* [extensionName, [method1, ...], [dependsOnExtensionName, ...]] */
      ['creation', ['create']],
      ['creation-defer-length', ['setDeferredUploadLength']],
      ['expiration', ['uploadsExpire']],
      /*
        what is checksum meant to solve? maybe doesn't need to be
        implemented at store level
        ['checksum', ['checksumWrite', 'checksumAlgorithms']],
        ['checksum-trailer', ['checksumWriteDelayed'], ['checksum']],
      */
      ['termination', ['del']],
      ['concatenation', ['concat']],
      ['concatenation-unfinished', ['concat', 'concatUnfinished']],
    ],
    base: {
      encodeKey: encodedKey => encodedKey,
      decodeKey: key => key,
    },
  }
  const missingMethods = schema.required
    .filter(name => !isFunction(store[name]))

  if (missingMethods.length) {
    throw new Error(
      `store is missing ${missingMethods.join(',')} methods`
    )
  }
  if (isFunction(store.checksumAlgorithms)) {
    // The Server MUST support at least the SHA1 checksum algorithm
    // identified by sha1.
    if (!store.checksumAlgorithms().includes('sha1')) {
      throw new Error(
        `store is missing ${missingMethods.join(',')} methods`
      )
    }
  }

  const supportedExtensions = schema.extensions
    .filter(([, methods]) => (
      methods.every(name => typeof store[name] === 'function')
    ))

  const extraMethods = supportedExtensions
    .map(([, methods]) => methods)
    .reduce((arr, methods) => [...arr, ...methods], [])

  const allMethods = [
    ...schema.required,
    ...extraMethods,
  ]

  const extensions = supportedExtensions.map(([extName]) => extName)

  const maxSize = store.maxSize || Infinity

  return Object.assign(
    {},
    schema.base,
    { extensions, maxSize },
    ...allMethods.map(name => ({ [name]: store[name].bind(store) })),
  )
}

