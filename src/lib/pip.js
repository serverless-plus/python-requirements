const fse = require('fs-extra')
const rimraf = require('rimraf')
const path = require('path')
const { spawnSync } = require('child_process')
const { quote } = require('shell-quote')
const { buildImage, getBindPath, getDockerUid } = require('./docker')
const { getStripCommand, getStripMode, deleteFiles } = require('./slim')
const {
  checkForAndDeleteMaxCacheVersions,
  sha256Path,
  getRequirementsWorkingPath,
  getUserCachePath
} = require('./shared')

/**
 * Omit empty commands.
 * In this context, a "command" is a list of arguments. An empty list or falsy value is ommitted.
 * @param {string[][]} many commands to merge.
 * @return {string[][]} a list of valid commands.
 */
function filterCommands(commands) {
  return commands.filter((cmd) => Boolean(cmd) && cmd.length > 0)
}

/**
 * Render zero or more commands as a single command for a Unix environment.
 * In this context, a "command" is a list of arguments. An empty list or falsy value is ommitted.
 *
 * @param {string[][]} many commands to merge.
 * @return {string[]} a single list of words.
 */
function mergeCommands(commands) {
  const cmds = filterCommands(commands)
  if (cmds.length === 0) {
    throw new Error('Expected at least one non-empty command')
  } else if (cmds.length === 1) {
    return cmds[0]
  } else {
    // Quote the arguments in each command and join them all using &&.
    const script = cmds.map(quote).join(' && ')
    return ['/bin/sh', '-c', script]
  }
}

/**
 * get requirements from requirements.txt
 * @param {string} source
 * @return {string[]}
 */
function getRequirements(source) {
  const requirements = fse
    .readFileSync(source, { encoding: 'utf-8' })
    .replace(/\\\n/g, ' ')
    .split(/\r?\n/)

  return requirements.reduce((acc, req) => {
    req = req.trim()
    if (!req.startsWith('-r')) {
      return [...acc, req]
    }
    source = path.join(path.dirname(source), req.replace(/^-r\s+/, ''))
    return [...acc, ...getRequirements(source)]
  }, [])
}

/** create a filtered requirements.txt without anything from noDeploy
 *  then remove all comments and empty lines, and sort the list which
 *  assist with matching the static cache.  The sorting will skip any
 *  lines starting with -- as those are typically ordered at the
 *  start of a file ( eg: --index-url / --extra-index-url ) or any
 *  lines that start with -f or -i,  Please see:
 * https://pip.pypa.io/en/stable/reference/pip_install/#requirements-file-format
 * @param {string} source requirements
 * @param {string} target requirements where results are written
 * @param {Object} options
 */
function filterRequirementsFile(source, target, options) {
  const noDeploy = new Set(options.noDeploy || [])
  const requirements = getRequirements(source)
  var prepend = []
  const filteredRequirements = requirements.filter((req) => {
    req = req.trim()
    if (req.startsWith('#')) {
      // Skip comments
      return false
    } else if (req.startsWith('--') || req.startsWith('-f') || req.startsWith('-i')) {
      // If we have options (prefixed with --) keep them for later
      prepend.push(req)
      return false
    } else if (req === '') {
      return false
    }
    return !noDeploy.has(req.split(/[=<> \t]/)[0].trim())
  })
  filteredRequirements.sort() // Sort remaining alphabetically
  // Then prepend any options from above in the same order
  for (const item of prepend.reverse()) {
    if (item && item.length > 0) {
      filteredRequirements.unshift(item)
    }
  }
  fse.writeFileSync(target, filteredRequirements.join('\n') + '\n')
}

/**
 * Just generate the requirements file in the .serverless folder
 * @param {string} requirementsPath
 * @param {string} targetFile
 * @param {Object} context
 * @param {string} servicePath
 * @param {Object} options
 * @return {undefined}
 */
function generateRequirementsFile(requirementsPath, targetFile, context, servicePath, options) {
  if (options.usePoetry && fse.existsSync(path.join(servicePath, 'pyproject.toml'))) {
    filterRequirementsFile(
      path.join(servicePath, '.serverless/requirements.txt'),
      targetFile,
      options
    )
    context.debug(`Parsed requirements.txt from pyproject.toml in ${targetFile}...`)
  } else if (options.usePipenv && fse.existsSync(path.join(servicePath, 'Pipfile'))) {
    filterRequirementsFile(
      path.join(servicePath, '.serverless/requirements.txt'),
      targetFile,
      options
    )
    context.debug(`Parsed requirements.txt from Pipfile in ${targetFile}...`)
  } else {
    filterRequirementsFile(requirementsPath, targetFile, options)
    context.debug(`Generated requirements from ${requirementsPath} in ${targetFile}...`)
  }
}

function pipAcceptsSystem(pythonBin) {
  // Check if pip has Debian's --system option and set it if so
  const pipTestRes = spawnSync(pythonBin, ['-m', 'pip', 'help', 'install'])
  if (pipTestRes.error) {
    if (pipTestRes.error.code === 'ENOENT') {
      throw new Error(`${pythonBin} not found! Try the pythonBin option.`)
    }
    throw pipTestRes.error
  }
  return pipTestRes.stdout.toString().indexOf('--system') >= 0
}

/**
 * Convert path from Windows style to Linux style, if needed.
 * @param {string} path
 * @return {string}
 */
function dockerPathForWin(pathStr) {
  if (process.platform === 'win32') {
    return pathStr.replace(/\\/g, '/')
  }
  return pathStr
}

/**
 * Install requirements described from requirements in the targetFolder into that same targetFolder
 * @param {string} targetFolder
 * @param {Object} context
 * @param {Object} options
 * @return {undefined}
 */
function installRequirements(targetFolder, context, options) {
  const targetRequirementsTxt = path.join(targetFolder, 'requirements.txt')

  context.debug(`Installing requirements from ${targetRequirementsTxt} ...`)

  const dockerCmd = []
  const pipCmd = [options.pythonBin, '-m', 'pip', 'install']

  if (Array.isArray(options.pipCmdExtraArgs) && options.pipCmdExtraArgs.length > 0) {
    options.pipCmdExtraArgs.forEach((cmd) => {
      const parts = cmd.split(/\s+/, 2)
      pipCmd.push(...parts)
    })
  }

  const pipCmds = [pipCmd]
  const postCmds = []
  // Check if we're using the legacy --cache-dir command...
  if (options.pipCmdExtraArgs.indexOf('--cache-dir') > -1) {
    if (options.dockerizePip) {
      throw 'Error: You can not use --cache-dir with Docker any more, please\n' +
        '         use the new option useDownloadCache instead.  Please see:\n' +
        '         https://github.com/yugasun/py-requirements#caching'
    } else {
      context.debug('==================================================')
      context.debug(
        'Warning: You are using a deprecated --cache-dir inside\n' +
          '            your pipCmdExtraArgs which may not work properly, please use the\n' +
          '            useDownloadCache option instead.  Please see: \n' +
          '            https://github.com/yugasun/py-requirements#caching'
      )
      context.debug('==================================================')
    }
  }

  if (!options.dockerizePip) {
    // Push our local OS-specific paths for requirements and target directory
    pipCmd.push('-t', dockerPathForWin(targetFolder), '-r', dockerPathForWin(targetRequirementsTxt))
    // If we want a download cache...
    if (options.useDownloadCache) {
      const downloadCacheDir = path.join(getUserCachePath(options), 'downloadCacheslspyc')
      context.debug(`Using download cache directory ${downloadCacheDir}`)
      fse.ensureDirSync(downloadCacheDir)
      pipCmd.push('--cache-dir', downloadCacheDir)
    }

    if (pipAcceptsSystem(options.pythonBin)) {
      pipCmd.push('--system')
    }
  }
  // If we are dockerizing pip
  if (options.dockerizePip) {
    // Push docker-specific paths for requirements and target directory
    pipCmd.push('-t', '/var/task/', '-r', '/var/task/requirements.txt')

    // Build docker image if required
    let { dockerImage } = options
    if (options.dockerFile) {
      context.debug(`Building custom docker image from ${options.dockerFile}...`)
      dockerImage = buildImage(options.dockerFile, options.dockerBuildCmdExtraArgs)
    }
    context.debug(`Docker Image: ${dockerImage}`)

    // Prepare bind path depending on os platform
    const bindPath = dockerPathForWin(getBindPath(context, targetFolder))

    dockerCmd.push('docker', 'run', '--rm', '-v', `${bindPath}:/var/task:z`)
    if (options.dockerSsh) {
      // Mount necessary ssh files to work with private repos
      dockerCmd.push(
        '-v',
        `${process.env.HOME}/.ssh/id_rsa:/root/.ssh/id_rsa:z`,
        '-v',
        `${process.env.HOME}/.ssh/known_hosts:/root/.ssh/known_hosts:z`,
        '-v',
        `${process.env.SSH_AUTH_SOCK}:/tmp/ssh_sock:z`,
        '-e',
        'SSH_AUTH_SOCK=/tmp/ssh_sock'
      )
    }

    // If we want a download cache...
    const dockerDownloadCacheDir = '/var/useDownloadCache'
    if (options.useDownloadCache) {
      const downloadCacheDir = path.join(getUserCachePath(options), 'downloadCacheslspyc')
      context.debug(`Using download cache directory ${downloadCacheDir}`)
      fse.ensureDirSync(downloadCacheDir)
      // This little hack is necessary because getBindPath requires something inside of it to test...
      // Ugh, this is so ugly, but someone has to fix getBindPath in some other way (eg: make it use
      // its own temp file)
      fse.closeSync(fse.openSync(path.join(downloadCacheDir, 'requirements.txt'), 'w'))
      const windowsized = getBindPath(context, downloadCacheDir)
      // And now push it to a volume mount and to pip...
      dockerCmd.push('-v', `${windowsized}:${dockerDownloadCacheDir}:z`)
      pipCmd.push('--cache-dir', dockerDownloadCacheDir)
    }

    if (options.dockerEnv) {
      // Add environment variables to docker run cmd
      options.dockerEnv.forEach(function(item) {
        dockerCmd.push('-e', item)
      })
    }

    if (process.platform === 'linux') {
      // Use same user so requirements folder is not root and so --cache-dir works
      if (options.useDownloadCache) {
        // Set the ownership of the download cache dir to root
        pipCmds.unshift(['chown', '-R', '0:0', dockerDownloadCacheDir])
      }
      // Install requirements with pip
      // Set the ownership of the current folder to user
      pipCmds.push(['chown', '-R', `${process.getuid()}:${process.getgid()}`, '/var/task'])
    } else {
      // Use same user so --cache-dir works
      dockerCmd.push('-u', getDockerUid(bindPath))
    }

    for (const pathStr of options.dockerExtraFiles) {
      pipCmds.push(['cp', pathStr, '/var/task/'])
    }

    if (process.platform === 'linux') {
      if (options.useDownloadCache) {
        // Set the ownership of the download cache dir back to user
        pipCmds.push([
          'chown',
          '-R',
          `${process.getuid()}:${process.getgid()}`,
          dockerDownloadCacheDir
        ])
      }
    }

    if (Array.isArray(options.dockerRunCmdExtraArgs)) {
      dockerCmd.push(...options.dockerRunCmdExtraArgs)
    } else {
      throw new Error('dockerRunCmdExtraArgs option must be an array')
    }

    dockerCmd.push(dockerImage)
  }

  // If enabled slimming, strip so files
  switch (getStripMode(options)) {
    case 'docker':
      pipCmds.push(getStripCommand(options, '/var/task'))
      break
    case 'direct':
      postCmds.push(getStripCommand(options, dockerPathForWin(targetFolder)))
      break
  }

  const spawnArgs = { shell: true }
  if (process.env.SLS_DEBUG) {
    spawnArgs.stdio = 'inherit'
  }
  let mainCmds = []
  if (dockerCmd.length) {
    dockerCmd.push(...mergeCommands(pipCmds))
    mainCmds = [dockerCmd]
  } else {
    mainCmds = pipCmds
  }
  mainCmds.push(...postCmds)

  context.debug(`Running ${quote(dockerCmd)}...`)

  filterCommands(mainCmds).forEach(([cmd, ...args]) => {
    const res = spawnSync(cmd, args)
    if (res.error) {
      if (res.error.code === 'ENOENT') {
        const advice = cmd.indexOf('python') > -1 ? 'Try the pythonBin option' : 'Please install it'
        throw new Error(`${cmd} not found! ${advice}`)
      }
      throw res.error
    }
    if (res.status !== 0) {
      throw new Error(`STDOUT: ${res.stdout}\n\nSTDERR: ${res.stderr}`)
    }
  })
  // If enabled slimming, delete files in slimPatterns
  if (options.slim === true || options.slim === 'true') {
    deleteFiles(options, targetFolder)
  }
}

/**
 * Copy everything from vendorFolder to targetFolder
 * @param {string} vendorFolder
 * @param {string} targetFolder
 * @param {Object} context
 * @return {undefined}
 */
function copyVendors(vendorFolder, targetFolder, context) {
  // Create target folder if it does not exist
  fse.ensureDirSync(targetFolder)

  context.debug(`Copying vendor libraries from ${vendorFolder} to ${targetFolder}...`)

  fse.readdirSync(vendorFolder).map((file) => {
    const source = path.join(vendorFolder, file)
    const dest = path.join(targetFolder, file)
    if (fse.existsSync(dest)) {
      rimraf.sync(dest)
    }
    fse.copySync(source, dest)
  })
}

/**
 * This checks if requirements file exists.
 * @param {string} servicePath
 * @param {Object} options
 * @param {string} fileName
 */
function requirementsFileExists(servicePath, options, fileName) {
  if (options.usePoetry && fse.existsSync(path.join(servicePath, 'pyproject.toml'))) {
    return true
  }

  if (options.usePipenv && fse.existsSync(path.join(servicePath, 'Pipfile'))) {
    return true
  }

  if (fse.existsSync(fileName)) {
    return true
  }

  return false
}

/**
 * This evaluates if requirements are actually needed to be installed, but fails
 * gracefully if no req file is found intentionally.  It also assists with code
 * re-use for this logic pertaining to individually packaged functions
 * @param {string} servicePath
 * @param {string} modulePath
 * @param {Object} options
 * @param {Object} funcOptions
 * @param {Object} context
 * @return {string}
 */
function installRequirementsIfNeeded(servicePath, modulePath, options, funcOptions, context) {
  // Our source requirements, under our service path, and our module path (if specified)
  const fileName = path.join(servicePath, modulePath, options.fileName)

  // Skip requirements generation, if requirements file doesn't exist
  if (!requirementsFileExists(servicePath, options, fileName)) {
    return false
  }

  let requirementsTxtDirectory
  // Copy our requirements to another path in .serverless (incase of individually packaged)
  if (modulePath && modulePath !== '.') {
    requirementsTxtDirectory = path.join(servicePath, '.serverless', modulePath)
  } else {
    requirementsTxtDirectory = path.join(servicePath, '.serverless')
  }
  fse.ensureDirSync(requirementsTxtDirectory)
  const slsReqsTxt = path.join(requirementsTxtDirectory, 'requirements.txt')

  generateRequirementsFile(fileName, slsReqsTxt, context, servicePath, options)

  // If no requirements file or an empty requirements file, then do nothing
  if (!fse.existsSync(slsReqsTxt) || fse.statSync(slsReqsTxt).size == 0) {
    context.debug(`Skipping empty output requirements.txt file from ${slsReqsTxt}`)
    return false
  }

  // Then generate our MD5 Sum of this requirements file to determine where it should "go" to and/or pull cache from
  const reqChecksum = sha256Path(slsReqsTxt)

  // Then figure out where this cache should be, if we're caching, if we're in a module, etc
  const workingReqsFolder = getRequirementsWorkingPath(
    reqChecksum,
    requirementsTxtDirectory,
    options
  )

  // Check if our static cache is present and is valid
  if (fse.existsSync(workingReqsFolder)) {
    if (
      fse.existsSync(path.join(workingReqsFolder, '.completed_requirements')) &&
      workingReqsFolder.endsWith('_slspyc')
    ) {
      context.debug(`Using static cache of requirements found at ${workingReqsFolder} ...`)
      // We'll "touch" the folder, as to bring it to the start of the FIFO cache
      fse.utimesSync(workingReqsFolder, new Date(), new Date())
      return workingReqsFolder
    }
    // Remove our old folder if it didn't complete properly, but _just incase_ only remove it if named properly...
    if (workingReqsFolder.endsWith('_slspyc') || workingReqsFolder.endsWith('.requirements')) {
      rimraf.sync(workingReqsFolder)
    }
  }

  // Ensuring the working reqs folder exists
  fse.ensureDirSync(workingReqsFolder)

  // Copy our requirements.txt into our working folder...
  fse.copySync(slsReqsTxt, path.join(workingReqsFolder, 'requirements.txt'))

  // Then install our requirements from this folder
  installRequirements(workingReqsFolder, context, options)

  // Copy vendor libraries to requirements folder
  if (options.vendor) {
    copyVendors(options.vendor, workingReqsFolder, context)
  }

  // Then touch our ".completed_requirements" file so we know we can use this for static cache
  if (options.useStaticCache) {
    fse.closeSync(fse.openSync(path.join(workingReqsFolder, '.completed_requirements'), 'w'))
  }
  return workingReqsFolder
}

/**
 * pip install the requirements to the requirements directory
 * @return {undefined}
 */
function installAllRequirements(servicePath, options) {
  // First, check and delete cache versions, if enabled
  checkForAndDeleteMaxCacheVersions(options, this.context)

  const reqsInstalledAt = installRequirementsIfNeeded(servicePath, '', options, {}, this.context)
  // Add symlinks into .serverless for so it's easier for injecting and for users to see where reqs are
  const symlinkPath = path.join(servicePath, '.serverless', `requirements`)
  // Only do if we didn't already do it
  if (reqsInstalledAt && !fse.existsSync(symlinkPath) && reqsInstalledAt != symlinkPath) {
    // Windows can't symlink so we have to use junction on Windows
    if (process.platform == 'win32') {
      fse.symlink(reqsInstalledAt, symlinkPath, 'junction')
    } else {
      fse.symlink(reqsInstalledAt, symlinkPath)
    }
  }
}

module.exports = { installAllRequirements }
