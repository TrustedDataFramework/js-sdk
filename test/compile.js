#!/usr/bin/env node
const path = require('path')
const child_process = require('child_process')
const fs = require('fs')
const entry = process.env['ENTRY'] || 'main.ts'
const { compileABI } = require('../dist')

const src = path.relative(process.cwd(), entry)

const dst = src.replace(/^(.*)\.ts$/, '$1.wasm')
const abiDist = src.replace(/^(.*)\.ts$/, '$1.abi.json')

const cmd = `asc ${src} -b ${dst} --runtime none --use abort=${path.relative(process.cwd(), path.join(__dirname, '../lib/prelude/abort')).replace(/\\/g, '/')} --sourceMap --debug`
const abi = compileABI(fs.readFileSync(src))
fs.writeFileSync(abiDist, JSON.stringify(abi, null, 2))
console.log(cmd)

child_process.execSync(cmd)