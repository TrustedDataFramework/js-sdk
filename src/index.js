const BN = require('bn.js')
const RLP = require('rlp')
const sm3 = require('@salaku/sm-crypto').sm3
const sm2 = require('@salaku/sm-crypto').sm2
const http = require('http')
const child_process = require('child_process');

class RPC {
    constructor(host, port) {
        this.host = host
        this.port = port
    }

    /**
     * 查看合约方法
     * @param address {string} 合约的地址
     * @param method {string} 查看的方法
     * @param parameters {Buffer} 额外的参数，字节数组
     * @returns {Promise<string>}
     */
    viewContract(address, method, parameters) {
        return viewContract(this.host, this.port, address, method, parameters)
    }

    /**
     * 发送事务
     * @param tx 事务
     * @returns {Promise<Object>}
     */
    sendTransaction(tx) {
        return sendTransaction(this.host, this.port, tx)
    }

    /**
     * 查看区块头
     * @param hashOrHeight {string | number} 区块哈希值或者区块高度
     * @returns {Promise<Object>}
     */
    getHeader(hashOrHeight) {
        return getHeader(this.host, this.port, hashOrHeight)
    }

    /**
     * 查看区块
     * @param hashOrHeight {string | number} 区块哈希值或者区块高度
     * @returns {Promise<Object>}
     */
    getBlock(hashOrHeight) {
        return getBlock(this.host, this.port, hashOrHeight)
    }

    /**
     * 查看事务
     * @param hash 事务哈希值
     * @returns {Promise<Object>}
     */
    getTransaction(hash) {
        return getTransaction(this.host, this.port, hash)
    }

    /**
     * 查看账户
     * @param pkOrAddress {string} 公钥或者地址
     * @returns {Promise<Object>}
     */
    getAccount(pkOrAddress) {
        return getAccount(this.host, this.port, pkOrAddress)
    }

    /**
     * 获取 nonce
     * @param pkOrAddress {string} 公钥或者地址
     * @returns {Promise<Number>}
     */
    getNonce(pkOrAddress) {
        return this.getAccount(pkOrAddress)
            .then(a => a.nonce)
    }

    /**
     * 查看申请加入的地址
     * @param contractAddress 合约地址
     * @returns {Promise<[]>}
     */
    getAuthPending(contractAddress) {
        return rpcPost(this.host, this.port, `/rpc/contract/${contractAddress}`, {
            method: 'pending'
        })
    }

    /**
     * 查看已经加入的地址
     * @param contractAddress 合约地址
     * @returns {Promise<[]>}
     */
    getAuthNodes(contractAddress) {
        return rpcPost(this.host, this.port, `/rpc/contract/${contractAddress}`, {
            method: 'nodes'
        })
    }
}

class TransactionBuilder {
    /**
     *
     * @param version {number | string} 事务版本号
     * @param sk {string | Buffer} 私钥
     * @param gasPrice {number} 油价，油价 * 油 = 手续费
     */
    constructor(version, sk, gasPrice) {
        this.version = version
        this.sk = sk
        this.gasPrice = gasPrice || 0
    }

    /**
     * 创建转账事务（未签名）
     * @param amount 转账金额
     * @param to 转账接收者
     * @returns {{createdAt: number, amount: (*|number), payload: (*|string), from: string, to: *, type: *, version: (number|string), gasPrice: number}}
     */
    buildTransfer(amount, to) {
        return this.buildCommon(constants.TRANSFER, amount, '', to)
    }

    /**
     * 构造部署合约的事务 （未签名）
     * @param payload {string | Buffer} 编译后的合约字节码
     * @param amount {number}
     * @returns {{createdAt: number, amount: (*|number), payload: (*|string), from: string, to: *, type: *, version: (number|string), gasPrice: number}}
     */
    buildDeploy(payload, amount) {
        if (typeof payload !== 'string')
            payload = payload.toString('hex')
        return this.buildCommon(constants.DEPLOY, amount, payload, '')
    }

    /**
     * 构造合约调用事务
     * @param addr {string} 合约地址
     * @param payload {string | Buffer} 合约 payload 内容，用 buildPayload 构造
     * @param amount {number} 金额
     * @returns {{createdAt: number, amount: (*|number), payload: (*|string), from: string, to: *, type: *, version: (number|string), gasPrice: number}}
     */
    buildContractCall(addr, payload, amount) {
        if (typeof payload !== 'string')
            payload = payload.toString('hex')
        return this.buildCommon(constants.CONTRACT_CALL, amount, payload, addr)
    }

    /**
     * 创建事务（未签名）
     * @param type {number} 事务类型
     * @param amount {number} 金额
     * @param payload {string}
     * @param to {string} 接收者的地址
     * @returns {{createdAt: number, amount: (*|number), payload: (*|string), from: string, to: *, type: *, version: (number|string), gasPrice: number}}
     */
    buildCommon(type, amount, payload, to) {
        return {
            version: this.version,
            type: type,
            createdAt: Math.floor((new Date()).valueOf() / 1000),
            from: privateKey2PublicKey(this.sk),
            gasPrice: this.gasPrice,
            amount: amount || 0,
            payload: payload || '',
            to: to
        }
    }

    /**
     * 构造加入请求事务（未签名）
     * @param address {string} 合约地址
     * @returns {{createdAt: number, amount: (*|number), payload: (*|string), from: string, to: *, type: *, version: (number|string), gasPrice: number}}
     */
    buildAuthJoin(address) {
        const payload = '00'
        return this.buildCommon(constants.CONTRACT_CALL, 0, payload, address)
    }

    /**
     * 构造同意加入的请求（未签名）
     * @param contractAddress {string} 合约地址
     * @param approvedAddress {string} 同意加入的地址
     * @returns {{createdAt: number, amount: (*|number), payload: (*|string), from: string, to: *, type: *, version: (number|string), gasPrice: number}}
     */
    buildAuthApprove(contractAddress, approvedAddress) {
        const payload = '01' + approvedAddress
        return this.buildCommon(constants.CONTRACT_CALL, 0, payload, contractAddress)
    }

    /**
     * 构造退出事务（未签名）
     * @param contractAddress {string} 合约地址
     * @returns {{createdAt: number, amount: (*|number), payload: (*|string), from: string, to: *, type: *, version: (number|string), gasPrice: number}}
     */
    buildAuthExit(contractAddress) {
        const payload = '02' + privateKey2PublicKey(this.sk)
        return this.buildCommon(constants.CONTRACT_CALL, 0, payload, contractAddress)
    }

    /**
     * 对事务作出签名
     * @param tx 事务
     */
    sign(tx) {
        sign(tx, this.sk)
    }
}

const constants = {
    POA_VERSION: 1634693120,
    POW_VERSION: 7368567,
    POS_VERSION: 7368563,
    COINBASE: 0,
    TRANSFER: 1,
    DEPLOY: 2,
    CONTRACT_CALL: 3,
    PEER_AUTHENTICATION_ADDR: "0000000000000000000000000000000000000003",
    POA_AUTHENTICATION_ADDR: "0000000000000000000000000000000000000004",
    POS_AUTHENTICATION_ADDR: "0000000000000000000000000000000000000005"
}

/**
 * 编译合约
 * @param ascPath {string} 编译器路径，一般在 node_modules/.bin/asc 下面
 * @param src {string} 源文件路径
 * @returns {Promise<Buffer>}
 */
function compileContract(ascPath, src) {
    return new Promise((resolve, reject) => {
        child_process.exec(
            ascPath + ' ' + conf.source + ' --optimize -b', // 执行的命令
            { encoding: 'buffer' },
            (err, stdout, stderr) => {
                if (err) {
                    // err.code 是进程退出时的 exit code，非 0 都被认为错误
                    // err.signal 是结束进程时发送给它的信号值
                    reject(stderr.toString('ascii'))
                }
                resolve(stdout)
            }
        );
    })
}

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
                    if (d.code === 200) {
                        resolve(d.data)
                        return
                    }
                    reject(d.message)
                })
            })
            .on('error', reject)
    })
}

function rpcPost(host, port, path, data) {
    data = typeof data === 'string' ? tx : JSON.stringify(data)
    return new Promise((resolve, reject) => {
        const opt = {
            host: host,
            port: port,
            path: path,
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
                    if (d.code === 200) {
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
 * 查看合约方法
 * @param host {string} 节点主机名
 * @param port {string | number} 节点端口
 * @param address {string} 合约的地址
 * @param method {string} 查看的方法
 * @param parameters {Buffer} 额外的参数，字节数组
 * @returns {Promise<string>}
 */
function viewContract(host, port, address, method, parameters) {
    const args = buildPayload(method, parameters)
    const url = `http://${host}:${port}/rpc/contract/${address}?args=${args.toString('hex')}`
    return rpcGet(url)
}

/**
 * 发送事务
 * @param host {string} 节点主机名
 * @param port {string | number} 节点端口
 * @param tx 事务
 * @returns {Promise<Object>}
 */
function sendTransaction(host, port, tx) {
    const data = typeof tx === 'string' ? tx : JSON.stringify(tx)
    return rpcPost(host, port, '/rpc/transaction', data)
}

/**
 * 查看区块头
 * @param host {string} 节点主机名
 * @param port {string | number} 节点端口
 * @param hashOrHeight {string | number} 区块哈希值或者区块高度
 * @returns {Promise<Object>}
 */
function getHeader(host, port, hashOrHeight) {
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
function getBlock(host, port, hashOrHeight) {
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
function getTransaction(host, port, hash) {
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
    if (typeof pk === 'string')
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
 * @param parameters {string | Buffer} 调用的额外参数
 * @returns {Buffer}
 */
function buildPayload(method, parameters) {
    const m = Buffer.from(method, 'ascii')
    const l = Buffer.from([m.length])
    if (typeof parameters === 'string')
        parameters = Buffer.from(parameters, 'hex')
    const a = parameters ? parameters : Buffer.from([])
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
    viewContract: viewContract,
    compileContract: compileContract,
    constants: constants,
    TransactionBuilder: TransactionBuilder,
    RPC: RPC
}

/**
 * string 转 BN
 * @param {string | number} x
 * @returns {BN}
 */
function asBigInteger(x) {
    if (typeof x === 'string')
        return new BN(x, 10)
    return x
}

/**
 * hex string 转 buffer
 * @param {string | ArrayBuffer | Uint8Array } x
 * @returns {Buffer}
 */
function asBuffer(x) {
    if (typeof x === 'string')
        return Buffer.from(x, 'hex')
    if (x instanceof ArrayBuffer)
        return Buffer.from(new Uint8Array(x))
    if (x instanceof Uint8Array)
        return Buffer.from(x)
    return x
}
