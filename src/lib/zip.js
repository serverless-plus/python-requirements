const fse = require('fs-extra')
const path = require('path')
const get = require('lodash.get')
const set = require('lodash.set')
const BbPromise = require('bluebird')
const JSZip = require('jszip')
const { addTree, writeZip } = require('./zipTree')

BbPromise.promisifyAll(fse)

/**
 * Add the vendor helper to the current service tree.
 * @return {Promise}
 */
function addVendorHelper(servicePath, options) {
  if (options.zip) {
    this.context.debug('Adding Python requirements helper...')

    if (!get(options, 'package.include')) {
      set(options, ['package', 'include'], [])
    }

    options.include.push('unzip_requirements.py')

    return fse.copyAsync(
      path.resolve(__dirname, '../unzip_requirements.py'),
      path.join(servicePath, 'unzip_requirements.py')
    )
  }
}

/**
 * Remove the vendor helper from the current service tree.
 * @return {Promise} the promise to remove the vendor helper.
 */
function removeVendorHelper(servicePath, options) {
  if (options.zip && options.cleanupZipHelper) {
    this.context.debug('Removing Python requirements helper...')
    return fse.removeAsync(path.join(servicePath, 'unzip_requirements.py'))
  }
}

/**
 * Zip up .serverless/requirements or .serverless/[MODULE]/requirements.
 * @return {Promise} the promise to pack requirements.
 */
function packRequirements(servicePath, options) {
  if (options.zip) {
    this.context.debug('Zipping required Python packages...')
    options.include.push('.requirements.zip')
    return addTree(new JSZip(), '.serverless/requirements').then((zip) =>
      writeZip(zip, path.join(servicePath, '.requirements.zip'))
    )
  }
}

module.exports = { addVendorHelper, removeVendorHelper, packRequirements }
