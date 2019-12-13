# python-requirements

[![NPM downloads](http://img.shields.io/npm/dm/@yugasun/python-requirements.svg?style=flat-square)](http://www.npmtrends.com/@yugasun/python-requirements)

> Notice: This project is a rewrite from [serverless-python-requirements](https://github.com/UnitedIncome/serverless-python-requirements) which is a serverless plugin.

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
  component: '@yugasun/python-requirements'
  inputs:
    codeUri: ./
    include:
      - handler.py
    dockerizePip: true
    zip: true
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
