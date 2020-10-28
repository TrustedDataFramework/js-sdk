const util = require('../src/utils')

test('decodeHex', () => {
    const arr = util.hex2bin('ff')
    expect(arr[0]).toBe(255)

})


test('server', () => {
    expect(() => util.createAuthServer(new Uint8Array(32), []))
        .toThrowError()
})