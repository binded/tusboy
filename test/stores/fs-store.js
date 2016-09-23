import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import initFsStore from 'fs-tus-store'

export default async () => {
  const directory = `${__dirname}/../.data`
  rimraf.sync(directory)
  mkdirp.sync(directory)
  return initFsStore({ directory })
}

