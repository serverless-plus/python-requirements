const { Component } = require('@serverless/core')
const BbPromise = require('bluebird')
const fse = require('fs-extra')
const path = require('path')
const { addVendorHelper, removeVendorHelper, packRequirements } = require('./lib/zip')
const { installAllRequirements } = require('./lib/pip')
const { pipfileToRequirements } = require('./lib/pipenv')
const { pyprojectTomlToRequirements } = require('./lib/poetry')
const { cleanup } = require('./lib/clean')

BbPromise.promisifyAll(fse)

class RequmentsComponent extends Component {
  /**
   * get the custom.pythonRequirements contents, with defaults set
   * @return {Object}
   */
  initOptions(inputs = {}) {
    const options = Object.assign(
      {
        slim: false,
        slimPatterns: false,
        slimPatternsAppendDefaults: true,
        zip: false,
        layer: false,
        cleanupZipHelper: true,
        invalidateCaches: false,
        fileName: 'requirements.txt',
        usePipenv: true,
        usePoetry: true,
        runtime: 'python3.6',
        pythonBin: process.platform === 'win32' ? 'python.exe' : inputs.runtime || 'python',
        dockerizePip: false,
        dockerSsh: false,
        dockerImage: null,
        dockerFile: null,
        dockerEnv: false,
        dockerBuildCmdExtraArgs: [],
        dockerRunCmdExtraArgs: [],
        dockerExtraFiles: [],
        useStaticCache: true,
        useDownloadCache: true,
        cacheLocation: false,
        staticCacheMaxVersions: 0,
        pipCmdExtraArgs: [],
        noDeploy: [],
        vendor: '',
        include: []
      },
      inputs
    )
    if (options.dockerizePip === 'non-linux') {
      options.dockerizePip = process.platform !== 'linux'
    }
    if (options.dockerizePip && process.platform === 'win32') {
      options.pythonBin = 'python'
    }
    if (!options.dockerizePip && (options.dockerSsh || options.dockerImage || options.dockerFile)) {
      if (!this.warningLogged) {
        this.context.debug(
          'WARNING: You provided a docker related option but dockerizePip is set to false.'
        )
        this.warningLogged = true
      }
    }
    if (options.dockerImage && options.dockerFile) {
      throw new Error(
        'Python Requirements: you can provide a dockerImage or a dockerFile option, not both.'
      )
    } else if (!options.dockerFile) {
      // If no dockerFile is provided, use default image
      const defaultImage = `lambci/lambda:build-${options.runtime}`
      options.dockerImage = options.dockerImage || defaultImage
    }
    return options
  }

  async default(inputs = {}) {
    this.context.status('Installing Python Requirements...')

    const options = this.initOptions(inputs)

    const servicePath = path.join(process.cwd(), inputs.codeUri || '.')

    this.state = {
      servicePath,
      options
    }

    const clean = async () => {
      await cleanup.call(this, servicePath, options)
      await removeVendorHelper.call(this, servicePath, options)
    }

    const install = async () => {
      await pipfileToRequirements.call(this, servicePath, options)
      await pyprojectTomlToRequirements.call(this, servicePath, options)
      await addVendorHelper.call(this, servicePath, options)
      await installAllRequirements.call(this, servicePath, options)
      await packRequirements.call(this, servicePath, options)
    }

    const invalidateCaches = async () => {
      if (inputs.invalidateCaches) {
        return clean.call(this, servicePath, options)
      }
      return BbPromise.resolve()
    }
    // await clean()
    await install()
    await invalidateCaches()

    // push requirements folder to options.include
    options.include.push(path.join(servicePath, '.serverless/requirements'))

    await this.save()

    return {
      include: options.include
    }
  }

  // eslint-disable-next-line
  async remove() {
    this.context.status('Removing')

    const { servicePath, options } = this.state

    await cleanup.call(this, servicePath, options)
    await removeVendorHelper.call(this, servicePath, options)

    this.state = {}
    await this.save()
    return {}
  }
}

module.exports = RequmentsComponent
