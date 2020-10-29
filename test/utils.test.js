const util = require('../src/utils')

test('decodeHex', () => {
    const arr = util.hex2bin('ff')
    expect(arr[0]).toBe(255)
})

test('f64', () => {
    util.f64ToBytes(1)
})


test('server', () => {
    expect(() => util.createAuthServer(new Uint8Array(32), []))
        .toThrowError()
})