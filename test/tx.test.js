const {Transaction} = require('../src/tx')

const tx = Transaction.clone({
    "version" : 1634693120,
    "type" : 0,
    "createdAt" : 1596091121,
    "nonce" : 223814,
    "from" : "",
    "gasPrice" : 0,
    "amount" : 20,
    "payload" : "02b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936",
    "to" : "9cbf30db111483e4b84e77ca0e39378fd7605e1b",
})


test('get signature plain', () => {
    console.log(tx)
    const rlp = Buffer.from(tx.getSignaturePlain()).toString('hex')
    const encoded = 'f84a84616f700080845f226af183036a4680808014a102b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936949cbf30db111483e4b84e77ca0e39378fd7605e1b'
    expect(rlp).toBe(encoded);
    expect(tx.getHash()).toBe('0a58bce7d2a88c5f3a10245a6f9b468d79fac3c6343b89e7e8fa23f5b18cb6bb')
})


