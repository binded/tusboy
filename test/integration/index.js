// Full integration tests using the tus-js-client client
import tus from 'tus-js-client-olalonde'
import test from 'blue-tape'
import str from 'string-to-stream'
import axios from 'axios'
import { RandomStream } from 'common-streams'
import concat from 'concat-stream'
import { createHash } from 'crypto'

const hash = (buf) => createHash('md5').update(buf).digest('hex')

export default async ({
  setup,
} = {}) => {
  let endpoint

  test('setup', async () => {
    const e = await setup()
    endpoint = e
  })

  const baseOptions = {
    headers: {},
    metadata: {},
    onProgress: () => {},
    fingerprint: () => {},
  }

  let uploadUrl
  test('file upload - no interruption', (t) => {
    const options = {
      ...baseOptions,
      endpoint,
      headers: {
        Custom: 'blargh',
      },
      metadata: {
        foo: 'hello',
        bar: 'world',
        nonlatin: 'słońce',
      },
    }
    const file = str('hello world')
    const upload = new tus.Upload(file, {
      ...options,
      uploadSize: 'hello world'.length,
      onError: t.error,
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2)
        t.comment(`Uploaded ${bytesUploaded} of ${bytesTotal} bytes ${percentage}%`)
      },
      onSuccess: () => {
        t.comment(`Upload URL: ${upload.url}`)
        uploadUrl = upload.url
        t.end()
      },
    })
    upload.start()
  })

  test('download uploaded file', async (t) => {
    const response = await axios.get(uploadUrl)
    const data = response.data
    t.equal(data, 'hello world')
  })

  test('file upload - with interruptions', (t) => {
    (async () => {
      const mb = 1024 * 1024
      // we need this to be at least 5mb to test with s3 backed store :/
      const minChunkSize = 5 * mb
      const uploadSize = 15 * mb

      const buf = await new Promise((resolve) => {
        new RandomStream(uploadSize).pipe(concat((b) => {
          resolve(b)
        }))
      })

      const upload = new tus.Upload(buf, {
        ...baseOptions,
        endpoint,
        uploadSize,
        chunkSize: minChunkSize,
        onError: t.error,
        onChunkComplete: (chunkSize, bytesAccepted, bytesTotal) => {
          t.comment(`${chunkSize} chunk size, ${bytesAccepted} bytes accepted of ${bytesTotal}`)
        },
        onSuccess: async () => {
          t.comment(`Upload URL: ${upload.url}`)
          const { data } = await axios.get(upload.url, {
            responseType: 'arraybuffer',
          })
          t.deepEqual(hash(data), hash(buf))
          t.end()
        },
      })
      upload.start()
    })()
  })

  return new Promise((resolve) => {
    test('done', (t) => {
      t.end()
      resolve()
    })
  })
}

