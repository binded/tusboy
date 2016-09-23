import tus from 'tus-js-client'
import test from 'blue-tape'
import str from 'string-to-stream'
/* eslint-disable no-console */
import axios from 'axios'

export default async ({
  endpoint,
} = {}) => {
  const baseOptions = {
    endpoint,
    headers: {},
    metadata: {},
    onProgress: () => {},
    fingerprint: () => {},
  }

  let uploadUrl
  test('file upload', (t) => {
    const options = {
      ...baseOptions,
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

  return new Promise((resolve) => {
    test('done', (t) => {
      t.end()
      resolve()
    })
  })
}

