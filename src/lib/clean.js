const BbPromise = require('bluebird')
const fse = require('fs-extra')
const path = require('path')
const glob = require('glob-all')
const { getUserCachePath } = require('./shared')

BbPromise.promisifyAll(fse)

/**
 * clean up .requirements and .requirements.zip and unzip_requirements.py
 * @return {Promise}
 */
async function cleanup(servicePath, options) {
  const artifacts = ['.requirements']
  if (options.zip) {
    artifacts.push('.requirements.zip')
    artifacts.push('unzip_requirements.py')
  }

  return BbPromise.all(
    artifacts.map((artifact) => fse.removeAsync(path.join(servicePath, artifact)))
  )
}

/**
 * Clean up static cache, remove all items in there
 * @return {Promise}
 */
async function cleanupCache(servicePath, options) {
  const cacheLocation = getUserCachePath(options)
  if (fse.existsSync(cacheLocation)) {
    if (this.context) {
      this.context.debug(`Removing static caches at: ${cacheLocation}`)
    }

    // Only remove cache folders that we added, just incase someone accidentally puts a weird
    // static cache location so we don't remove a bunch of personal stuff
    const promises = []
    glob
      .sync([path.join(cacheLocation, '*slspyc/')], { mark: true, dot: false })
      .forEach((file) => {
        promises.push(fse.removeAsync(file))
      })
    return BbPromise.all(promises)
  }
  if (this.serverless) {
    this.context.debug(`No static cache found`)
  }
  return BbPromise.resolve()
}

module.exports = { cleanup, cleanupCache }
