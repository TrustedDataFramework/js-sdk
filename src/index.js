const BN = require('bn.js')
const RLP = require('rlp')
const sm3 = require('@salaku/sm-crypto').sm3
const sm2 = require('@salaku/sm-crypto').sm2
const http = require('http')


function rpcGet(url) {
    return new Promise((resolve, reject) => {
        http.get(
            url, (res) => {
                let data = ""

                res.on("data", d => {
                    data += d
                })
                res.on("end", () => {
                    const d = JSON.parse(data)
                    if(d.code === 200){
                        resolve(d.data)
                        return
                    }
                    reject(d.message)
                })
            })
            .on('error', reject)
    })
}

/**
 *
 * @param host {string} 节点主机名
 * @param port {string | number} 节点端口
 * @param address {string} 合约的地址
 * @param method {string} 查看的方法
 * @param args {Buffer} 额外的参数，字节数组
 * @returns {Promise<string>}
 */
function viewContract(host, port, address, method, args){
    const parameters = buildPayload(method, args)
    const url = `http://${host}:${port}/rpc/contract/${address}?parameters=${parameters.toString('hex')}`
    return rpcGet(url)
}

/**
 * 发送事务
 * @param host {string} 节点主机名
 * @param port {string | number} 节点端口
 * @param tx 事务
 * @returns {Promise<Object>}
 */
function sendTransaction(host, port, tx){
    const data = typeof tx === 'string' ? tx : JSON.stringify(tx)
    return new Promise((resolve, reject) => {
        const opt = {
            host: host,
            port: port,
            path: '/rpc/transaction',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }
        const req = http.request(
            opt, (res) => {
                let data = ""

                res.on("data", d => {
                    data += d
                })
                res.on("end", () => {
                    const d = JSON.parse(data)
                    if(d.code === 200){
                        resolve(d.data)
                        return
                    }
                    reject(d.message)
                })
            })
            .on('error', reject)

        req.write(data)
        req.end()
    })
}

/**
 * 查看区块头
 * @param host {string} 节点主机名
 * @param port {string | number} 节点端口
 * @param hashOrHeight {string | number} 区块哈希值或者区块高度
 * @returns {Promise<Object>}
 */
function getHeader(host, port, hashOrHeight){
    const url = `http://${host}:${port}/rpc/header/${hashOrHeight}`
    return rpcGet(url)
}

/**
 * 查看区块
 * @param host {string} 节点主机名
 * @param port {string | number} 节点端口
 * @param hashOrHeight {string | number} 区块哈希值或者区块高度
 * @returns {Promise<Object>}
 */
function getBlock(host, port, hashOrHeight){
    const url = `http://${host}:${port}/rpc/block/${hashOrHeight}`
    return rpcGet(url)
}

/**
 * 查看事务
 * @param host {string} 节点主机名
 * @param port {string | number} 节点端口
 * @param hash 事务哈希值
 * @returns {Promise<Object>}
 */
function getTransaction(host, port, hash){
    const url = `http://${host}:${port}/rpc/transaction/${hash}`
    return rpcGet(url)
}

/**
 * 查看账户
 * @param host {string} 节点主机名
 * @param port {string | number} 节点端口
 * @param pkOrAddress {string} 公钥或者地址
 * @returns {Promise<Object>}
 */
function getAccount(host, port, pkOrAddress) {
    const url = `http://${host}:${port}/rpc/account/${pkOrAddress}`
    return rpcGet(url)
}

/**
 * 获取 nonce
 * @param host {string} 节点主机名
 * @param port {string | Number} 节点端口
 * @param pkOrAddress {string} 公钥或者地址
 * @returns {Promise<Number>}
 */
function getNonce(host, port, pkOrAddress) {
    return getAccount(host, port, pkOrAddress)
        .then(a => a.nonce)
}

/**
 * 生成合约地址
 * @param pk {string | Buffer} 合约创建者的公钥
 * @param nonce {number} 事务的 nonce
 * @returns {string} 合约的地址
 */
function getContractAddress(pk, nonce) {
    if(typeof pk === 'string')
        pk = Buffer.from(pk, 'hex')
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
    getNonce: getNonce,
    sendTransaction: sendTransaction,
    getTransaction: getTransaction,
    getBlock: getBlock,
    getHeader: getHeader,
    viewContract: viewContract
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
