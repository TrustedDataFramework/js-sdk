#!/usr/bin/env node
const t = typeof require === 'function' ? require('../dist') : tdsSDK
const vm = new t.VirtualMachine()
const origin = '9cbf30db111483e4b84e77ca0e39378fd7605e1b'


async function main() {
    const addr1 = (await vm.deploy(origin, './reflect.wasm')).result
    const addr2 = (await vm.deploy(origin, './reflect.wasm')).result
    console.log(await vm.call(origin, addr1, 'proxy', [addr2, 128]))
}

main().catch(console.error)