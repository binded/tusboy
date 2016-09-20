import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import fsStore from 'fs-tus-store'
import kitchenfile from 'kitchenfile'

export const file = kitchenfile(__dirname, 'files')

/* eslint-disable import/prefer-default-export */
export const setupFsStore = () => {
  const directory = `${__dirname}/.data`
  rimraf.sync(directory)
  mkdirp.sync(directory)
  return fsStore({ directory })
}
