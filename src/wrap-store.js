// Validate / clean up store implementation

// 1. makes sure store implements required methods
// 2. detects which extensions store supports by checking which methods
//    are implemented
// 3. returns a new object made of known methods from the store
//    and an extensions property
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
  }
  const missingMethods = schema.required
    .filter(name => typeof store[name] !== 'function')

  if (missingMethods.length) {
    throw new Error(
      `store is missing ${missingMethods.join(',')} methods`
    )
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

  return Object.assign(
    { extensions },
    ...allMethods.map(name => ({ [name]: store[name].bind(store) })),
  )
}

