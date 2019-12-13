# Configure document

## Complete configuration

```yml
# serverless.yml

MyComponent:
  component: @yugasun/py-requirements
  inputs:
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
    pythonBin: 'python',
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
    vendor: ''
```

## Configuration description

Main param description

| Name                       | Required | Default               | Description |
| -------------------------- | -------- | --------------------- | ----------- |
| slim                       | false    | `false`,              |             |
| slimPatterns               | false    | `false`,              |             |
| slimPatternsAppendDefaults | false    | `true`,               |             |
| zip                        | false    | `false`,              |             |
| cleanupZipHelper           | false    | `true`,               |             |
| invalidateCaches           | false    | `false`,              |             |
| fileName                   | false    | `'requirements.txt'`, |             |
| usePipenv                  | false    | `true`,               |             |
| usePoetry                  | false    | `true`,               |             |
| runtime                    | false    | `'python3.6'`,        |             |
| pythonBin                  | false    | `'python'`,           |             |
| dockerizePip               | false    | `false`,              |             |
| dockerSsh                  | false    | `false`,              |             |
| dockerImage                | false    | `null`,               |             |
| dockerFile                 | false    | `null`,               |             |
| dockerEnv                  | false    | `false`,              |             |
| dockerBuildCmdExtraArgs    | false    | `[]`,                 |             |
| dockerRunCmdExtraArgs      | false    | `[]`,                 |             |
| dockerExtraFiles           | false    | `[]`,                 |             |
| useStaticCache             | false    | `true`,               |             |
| useDownloadCache           | false    | `true`,               |             |
| cacheLocation              | false    | `false`,              |             |
| staticCacheMaxVersions     | false    | `0`,                  |             |
| pipCmdExtraArgs            | false    | `[]`,                 |             |
| noDeploy                   | false    | `[]`,                 |             |
| vendor                     | false    | `'`'                  |             |
