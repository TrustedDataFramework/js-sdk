const BN = require('bn.js')
const RLP = require('rlp')
const sm3 = require('@salaku/sm-crypto').sm3
const sm2 = require('@salaku/sm-crypto').sm2
const http = require('http')

function getNonce(host, port, pkOrAddress) {
    return new Promise((resolve, reject) => {
        http.get(
            `http://${host}:${port}/rpc/account/${pkOrAddress}`, (res) => {
                let data = ""

                res.on("data", d => {
                    data += d
                })
                res.on("end", () => {
                    const d = JSON.parse(data)
                    resolve(d.data.nonce)
                })
            })
            .on('error', reject)
    })
}

/**
 * 生成合约地址
 * @param pk 合约创建者的公钥
 * @param nonce 事务的 nonce
 * @returns {string} 合约的地址
 */
function getContractAddress(pk, nonce) {
    nonce = nonce ? nonce : 0
    let buf = RLP.encode([pk, nonce])
    buf = Buffer.from(sm3(buf), 'hex')
    return buf.slice(buf.length - 20, buf.length).toString('hex')
}

/**
 * 获得事务签名原文
 * @param tx 事务
 * @returns {Buffer}
 */
function getSignaturePlain(tx) {
    const arr = [
        tx['version'] ? asBigInteger(tx['version']) : 0,
        tx['type'] ? asBigInteger(tx['type']) : 0,
        tx['createdAt'] ? asBigInteger(tx['createdAt']) : 0,
        tx['nonce'] ? asBigInteger(tx['nonce']) : 0,
        tx['from'] ? asBuffer(tx['from']) : null,
        tx['gasPrice'] ? asBigInteger(tx['gasPrice']) : 0,
        tx['amount'] ? asBigInteger(tx['amount']) : 0,
        tx['payload'] ? asBuffer(tx['payload']) : null,
        tx['to'] ? asBuffer(tx['to']) : null,
    ]
    return RLP.encode(arr)
}

/**
 * 获取事务哈希值
 * @param tx 事务
 * @returns {Buffer}
 */
function getTransactionHash(tx) {
    const buf = getSignaturePlain(tx)
    return Buffer.from(sm3(buf), 'hex')
}

/**
 * 私钥转公钥
 * @param sk {string} 私钥
 * @returns {string}
 */
function privateKey2PublicKey(sk) {
    if (sk instanceof Buffer)
        sk = sk.toString('hex')
    return sm2.compress(sm2.getPKFromSK(sk))
}

/**
 * 公钥转地址
 * @param pk 公钥
 * @returns {string}
 */
function publicKey2Address(pk) {
    const buf = Buffer.from(sm3(pk), 'hex')
    return buf.slice(buf.length - 20, buf.length).toString('hex')
}

/**
 * 对事务作出签名
 * @param tx 事务
 * @param sk 私钥
 */
function sign(tx, sk) {
    tx.signature =
        sm2.doSignature(
            getSignaturePlain(tx),
            sk,
            { userId: 'userid@soie-chain.com', der: false, hash: true }
        )
}

/**
 * 构造合约调用的 payload，或者查看合约的
 * @param method {string} 调用的方法名
 * @param args 调用的额外参数
 * @returns {Buffer}
 */
function buildPayload(method, args) {
    const m = Buffer.from(method, 'ascii')
    const l = Buffer.from([m.length])
    const a = args ? args : Buffer.from([])
    return Buffer.concat([l, m, a])
}


module.exports = {
    getSignaturePlain: getSignaturePlain,
    getTransactionHash: getTransactionHash,
    sign: sign,
    buildPayload: buildPayload,
    publicKey2Address: publicKey2Address,
    privateKey2PublicKey: privateKey2PublicKey,
    getContractAddress: getContractAddress,
    getNonce: getNonce
}


function asBigInteger(x) {
    if (typeof x === 'string')
        return new BN(x, 10)
    return x
}


function asBuffer(x) {
    if (typeof x === 'string')
        return Buffer.from(x, 'hex')
    if (x instanceof ArrayBuffer)
        return Buffer.from(new Uint8Array(x))
    if (x instanceof Uint8Array)
        return Buffer.from(x)
    return x
}
