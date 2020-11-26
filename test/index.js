#!/usr/bin/env node
const t = typeof require === 'function' ? require('../dist') : tdsSDK
const vm = new t.VirtualMachine()
const rlp = t.rlp
const origin = '9cbf30db111483e4b84e77ca0e39378fd7605e1b'
const amount = 1234567890

async function main() {
    const u256Addr = t.getContractAddress(origin, 1)
    await vm.deploy(origin, './u256.wasm')
    const MAX_U256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    // 随机测试四则运算

    async function testArithmetic(n, method, skip) {
        let count = 0
        for (let i = 0; i < n; i++) {
            const x = method === 'mul' ? BigInt('0x' + t.bin2hex(t.randomBytes(16))) : BigInt('0x' + t.bin2hex(t.randomBytes(32)))
            const y = method === 'mul' ? BigInt('0x' + t.bin2hex(t.randomBytes(16))) : BigInt('0x' + t.bin2hex(t.randomBytes(32)))
            let expectZ

            switch (method) {
                case 'add':
                    expectZ = x + y
                    break
                case 'sub':
                    expectZ = x - y
                    break
                case 'mul':
                    expectZ = x * y
                    break
                case 'div':
                    expectZ = x / y
                    break
                case 'mod':
                    expectZ = x % y
                    break
            }
            if (skip(x, y, expectZ)) {
                continue
            }

            const z = await vm.view(u256Addr, method, [x, y])
            if (z !== expectZ) {
                console.error(`test failed method = ${method}, x = ${x}, y = ${y}`)
            }
            count++
        }
        console.info(`${count} random tests passed for ${method}`)
    }

    const N = 1000
    await testArithmetic(N, 'add', (x, y, z) => z > MAX_U256)
    await testArithmetic(N, 'sub', (x, y, z) => x < y)
    await testArithmetic(N, 'mul', (x, y, z) => z > MAX_U256)
    await testArithmetic(N, 'div', (x, y, z) => y == BigInt(0))
    await testArithmetic(N, 'mod', (x, y, z) => y == BigInt(0))


    console.log(await vm.view(u256Addr, 'getOne'))
    vm.alloc(origin, amount)
    vm.now = 123456789
    vm.parentHash = t.hex2bin('9cbf30db111483e4b84e77ca0e39378fd7605e1b')
    await vm.deploy(origin, './context.wasm', [], amount, {
        version: 1234,
        createdAt: 12345,
        gasLimit: 12345678,
        gasPrice: 123456789,
        signature: 'aabbccddeeff',
        hash: 'aabbccddeeff',
        to: '9cbf30db111483e4b84e77ca0e39378fd7605e1b',
        signature: '9cbf30db111483e4b84e77ca0e39378fd7605e1b',
        hash: '9cbf30db111483e4b84e77ca0e39378fd7605e1b'
    })
    await vm.deploy(origin, './db.wasm')
}

main().catch(console.error)