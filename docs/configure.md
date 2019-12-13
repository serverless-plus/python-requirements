# Configure document

## Complete configuration

```yml
# serverless.yml

MyComponent:
  component: '@yugasun/python-requirements'
  inputs:
    codeUri: ./
    include: []
    slim: false
    slimPatterns: false
    slimPatternsAppendDefaults: true
    zip: false
    layer: false
    cleanupZipHelper: true
    invalidateCaches: false
    fileName: 'requirements.txt'
    usePipenv: true
    usePoetry: true
    runtime: 'python3.6'
    pythonBin: 'python'
    dockerizePip: false
    dockerSsh: false
    dockerImage: null
    dockerFile: null
    dockerEnv: false
    dockerBuildCmdExtraArgs: []
    dockerRunCmdExtraArgs: []
    dockerExtraFiles: []
    useStaticCache: true
    useDownloadCache: true
    cacheLocation: false
    staticCacheMaxVersions: 0
    pipCmdExtraArgs: []
    noDeploy: []
    vendor: ''
```

## Configuration description

Main param description

| Name                       | Required | Default              | Description                                                                                                                                                                 |
| -------------------------- | -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| codeUri                       | false    | `process.cwd()`              |  Specify source code path |
| include                       | false    | `[]`              | include files for cloud function zip |
| slim                       | false    | `false`              | Whether strip the .so files, remove **pycache** and dist-info directories as well as .pyc and .pyo files. (Works on non 'win32' environments)                               |
| slimPatterns               | false    | `false`              | To specify additional directories to remove from the installed packages                                                                                                     |
| slimPatternsAppendDefaults | false    | `true`               | To overwrite the default patterns set the option slimPatternsAppendDefaults to false                                                                                        |
| zip                        | false    | `false`              | zip the requirements and extract them on the fly (see handler.py)                                                                                                           |
| cleanupZipHelper           | false    | `true`               | clean zip helper file                                                                                                                                                       |
| invalidateCaches           | false    | `false`              | If you are using your own Python library, you have to cleanup .requirements on any update. You can use the following option to cleanup .requirements everytime you package. |
| fileName                   | false    | `'requirements.txt'` | Some pip workflows involve using requirements files not named requirements.txt.                                                                                             |
| usePipenv                  | false    | `true`               | If you include a Pipfile and have pipenv installed instead of a requirements.txt this will use pipenv lock -r to generate them.                                             |
| usePoetry                  | false    | `true`               | If you include a pyproject.toml and have poetry installed instead of a requirements.txt this will use poetry export --without-hashes -f requirements.txt to generate them   |
| runtime                    | false    | `'python3.6'`        | function runtime                                                                                                                                                            |
| pythonBin                  | false    | `'python'`           | python bin name                                                                                                                                                             |
| dockerizePip               | false    | `false`              | call `pip install` inside a container - useful for packages that have native dependencies (scipy et-al)                                                                     |
| dockerSsh                  | false    | `false`              | The dockerSsh option will mount your $HOME/.ssh/id_rsa and $HOME/.ssh/known_hosts as a volume in the docker container                                                       |
| dockerImage                | false    | `null`               | docker image name                                                                                                                                                           |
| dockerFile                 | false    | `null`               | Use your own docker image by Dockerfile                                                                                                                                     |
| dockerEnv                  | false    | `false`              | pass environment variables to docker                                                                                                                                        |
| dockerBuildCmdExtraArgs    | false    | `[]`                 | extra arguments to be passed to docker build during the build step                                                                                                          |
| dockerRunCmdExtraArgs      | false    | `[]`                 | extra arguments to be passed to docker run during the build step                                                                                                            |
| dockerExtraFiles           | false    | `[]`                 | extra files passed to docker container                                                                                                                                      |
| useStaticCache             | false    | `true`               | use caches output of pip after compiling everything for your requirements file                                                                                              |
| useDownloadCache           | false    | `true`               | use download cache that will cache downloads that pip needs to compile the packages                                                                                         |
| cacheLocation              | false    | `false`              | specify where in your system that this plugin caches                                                                                                                        |
| staticCacheMaxVersions     | false    | `0`                  | how many max static caches to store                                                                                                                                         |
| pipCmdExtraArgs            | false    | `[]`                 | extra arguments supported by pip to be passed to pip                                                                                                                        |
| noDeploy                   | false    | `[]`                 | omit a package from deployment                                                                                                                                              |
| vendor                     | false    | `'`'                 | Store certain libraries in a directory and use the vendor option, and the plugin will copy them along with all the other dependencies to install                            |
