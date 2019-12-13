const fse = require('fs-extra')
const path = require('path')
const { spawnSync } = require('child_process')
const { EOL } = require('os')

/**
 *
 * @param requirementBuffer
 * @returns Buffer with editable flags remove
 */
function removeEditableFlagFromRequirementsString(requirementBuffer) {
  const flagStr = '-e '
  const lines = requirementBuffer.toString('utf8').split(EOL)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(flagStr)) {
      lines[i] = lines[i].substring(flagStr.length)
    }
  }
  return Buffer.from(lines.join(EOL))
}

/**
 * pipenv install
 */
async function pipfileToRequirements(servicePath, options) {
  if (!options.usePipenv || !fse.existsSync(path.join(servicePath, 'Pipfile'))) {
    return
  }

  this.context.debug('Generating requirements.txt from Pipfile...')

  const res = spawnSync('pipenv', ['lock', '--requirements', '--keep-outdated'], {
    cwd: servicePath
  })
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      throw new Error(`pipenv not found! Install it with 'pip install pipenv'.`)
    }
    throw new Error(res.error)
  }
  if (res.status !== 0) {
    throw new Error(res.stderr)
  }
  fse.ensureDirSync(path.join(servicePath, '.serverless'))
  fse.writeFileSync(
    path.join(servicePath, '.serverless/requirements.txt'),
    removeEditableFlagFromRequirementsString(res.stdout)
  )
}

module.exports = { pipfileToRequirements }
