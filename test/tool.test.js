const tx = {
    "version" : 1634693120,
    "type" : 0,
    "createdAt" : 1596091121,
    "nonce" : 223814,
    "from" : "",
    "gasPrice" : 0,
    "amount" : 20,
    "payload" : "02b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936",
    "to" : "9cbf30db111483e4b84e77ca0e39378fd7605e1b",
    "hash" : "66c434dc4619b988ac975fa89a98c4c707e5d25343297df09a4f91ebc62521be",
}

const tool = require('../index')

test('get signature plain', () => {
    const rlp = tool.getSignaturePlain(tx).toString('hex')
    const encoded = 'f84984616f700080845f226af183036a46808014a102b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936949cbf30db111483e4b84e77ca0e39378fd7605e1b'
    expect(rlp).toBe(encoded);
})



test('get transaction hash', () => {
    const h = tool.getTransactionHash(tx).toString('hex')
    const hash = '66c434dc4619b988ac975fa89a98c4c707e5d25343297df09a4f91ebc62521be'
    expect(h).toBe(hash);
})

test('build payload', () => {
    const p = tool.buildPayload("call", Buffer.from('ffff', 'hex'))
    expect(p[0]).toBe(4)

    let buf = p.slice(1, 1 +4)
    expect(buf.toString('ascii')).toBe('call')

    buf = p.slice(5, p.length)
    expect(buf.toString('hex')).toBe('ffff')
})

