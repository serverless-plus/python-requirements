# python-requirements

## Introduction

Serverless Python Requirements Component

## Content

1. [Install](#1-install)
2. [Create](#2-create)
3. [Configure](#3-configure)
4. [Deploy](#4-deploy)
5. [Remove](#5-Remove)

### 1. Install

Install the Serverless Framework globally:

```shell
$ npm install -g serverless
```

### 2. Create

Just create the following simple boilerplate:

```shell
$ touch serverless.yml
```
### 3. Configure

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

- [More Options](./docs/configure.md)

### 4. Deploy

```shell
$ sls --debug
```

&nbsp;

### 5. Remove

```shell
$ sls remove --debug
```

### More Components

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
