#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const child_process = require('child_process')

// build typescript
child_process.execSync('tsc')

console.log('build typescript success')

// bundle webpack
child_process.execSync('webpack --env prod')

console.log('bundle success')


function resolve(p){
    return path.relative(process.cwd(), path.join(__dirname, p))
}

const libDir = resolve('lib')
// build .d.ts for files in lib
for(let f of fs.readdirSync(libDir)){
    if(!/.*\.ts$/.test(f))
        continue
    f = path.join(libDir, f)
    const cmd = `asc ${f} -b ${f.replace(/(.*)\.ts$/, '$1.wasm')}` 
    console.log(cmd)
    child_process.execSync(cmd)
}

