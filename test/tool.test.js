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

test('read key store', () => {
    const ks = {
        "publicKey": "03a7f9d6c7d4b8f43e66b5c79a2ab4067d81b89ceaf1d3a2078a71e829020b3f59",
        "crypto": {
            "cipher": "sm4-128-ecb",
            "cipherText": "9bc5cdb736ebc5ee7db721ebdecd158796ea82d02f11bdbccb15a0b783e9dc47",
            "iv": "35aaa95c092f0a4a9d3c90a1ca15253d",
            "salt": "54f65f0dca0452d39b1523dcbe00894dc63793d522bfcb9316aa7878ce7d32aa"
        },
        "id": "e6819c35-27d7-4f68-9b5b-9980ea3e57cb",
        "version": "1",
        "mac": "5be73ea36c52df22e1bf0d57bd850ec7bfe9226f73da7387d91855adcb439351",
        "kdf": "sm2-kdf",
        "address": "0ddf6310588078f7c68c740f151a18aded7946d5"
    }
    expect(tool.readKeyStore(ks, '123456'))
        .toBe('626cb1df7c489a09243ecb4d7f12ffad61cd1b7863331ac7de7364810616e14a')
})


test('generate key store', () => {
    console.log(JSON.stringify(tool.createKeyStore('123456')))
})
