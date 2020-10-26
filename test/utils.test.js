const util = require('../dist/utils')

test('decodeHex', () => {
    const arr = util.hex2bin('ff')
    expect(arr[0]).toBe(255)
})
