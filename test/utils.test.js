const util = require('../dist/utils')

test('decodeHex', () => {
    const arr = util.decodeHex('ff')
    expect(arr[0]).toBe(255)
})