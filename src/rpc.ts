import { bin2hex, bin2str, hex2bin, publicKey2Address, toSafeInt, uuidv4 } from "./utils"
import rlp = require("./rlp")
import { AbiInput, Binary, constants, Readable, RLPElement, TX_STATUS } from "./constants"
import { Contract, normalizeParams } from "./contract";
import { Transaction } from "./tx";

export interface Account { 
    address: string 
    nonce: number | bigint
    balance: number | bigint
    createdBy: string
    contractHash: string
    storageRoot: string 
}

export interface TransactionResult {
    transactionHash?: string
    blockHeight?: number | bigint
    blockHash?: string
    gasUsed?: bigint | number
    events?: Readable[] | Record<string, Readable>
    result?: Readable
    fee?: bigint | number
    method?: string
    inputs?: AbiInput[] | Record<string, AbiInput>
}

interface Resp {
    code: WS_CODES
    nonce: number
    body: RLPElement | RLPElement[]
}

interface EventResp extends Resp {
    addr: string
    name: string
    fields: Uint8Array[]
}

interface TransactionResp extends Resp {
    hash: string
    status: TX_STATUS
    reason?: string
    blockHeight?: number | bigint
    blockHash?: string
    gasUsed?: bigint | number
    events?: [Uint8Array, Uint8Array[]][]
    result?: Uint8Array[]
}

export enum WS_CODES {
    NULL,
    EVENT_EMIT,
    EVENT_SUBSCRIBE,
    TRANSACTION_EMIT,
    TRANSACTION_SUBSCRIBE,
    TRANSACTION_SEND,
    ACCOUNT_QUERY,
    CONTRACT_QUERY,
}

export class RPC {
    host: string
    port: number
    private callbacks: Map<number, (resp: TransactionResp | EventResp) => void>
    private id2key: Map<number, string>
    private id2hash: Map<number, string>
    private eventHandlers: Map<string, Set<number>>
    private txObservers: Map<string, Set<number>>
    private cid: number
    private rpcCallbacks: Map<number, (resp: Resp) => void>
    private nonce: number
    private ws: WebSocket
    private uuid: string
    /**
     *
     * @param {string} host  主机名
     * @param {string | number} port  端口号
     */
    constructor(host: string, port?: string | number) {
        this.host = host || 'localhost'
        this.port = typeof port === 'number' ? port : (parseInt(port || '80'))

        this.callbacks = new Map() // id -> function
        this.id2key = new Map()// id -> address:event
        this.id2hash = new Map()  // id -> txhash
        this.eventHandlers = new Map() // address:event -> [id]
        this.txObservers = new Map() // hash -> [id]
        this.cid = 0
        this.rpcCallbacks = new Map() // nonce -> cb
        this.nonce = 0
    }

    private tryConnect(): Promise<void> {
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            return Promise.resolve()
        }

        if (this.ws) {
            const fn = this.ws.onopen || ((e) => { })
            const p = new Promise((rs, rj) => {
                this.ws.onopen = (e) => {
                    fn.call(this.ws, e)
                    rs()
                }
            })
            return <Promise<void>>p
        }

        this.uuid = uuidv4()

        if (typeof WebSocket === 'function') {
            this.ws = new WebSocket(`ws://${this.host}:${this.port || 80}/websocket/${this.uuid}`)
        } else {
            let WS = require('ws')
            this.ws = new WS(`ws://${this.host}:${this.port || 80}/websocket/${this.uuid}`)
        }

        this.ws.onerror = console.error
        this.ws.onmessage = (e) => {
            if (typeof WebSocket !== 'function') {
                this.handleData(e.data)
                return
            }
            const reader = new FileReader();

            reader.onload = () => {
                const arrayBuffer = reader.result
                this.handleData(new Uint8Array(<ArrayBuffer>arrayBuffer))
            };
            reader.readAsArrayBuffer(e.data)
        }
        const p = new Promise((rs, rj) => {
            this.ws.onopen = rs
        }
        )
        return <Promise<void>>p
    }

    private parse(data: Uint8Array): Resp {
        const decoded: RLPElement[] = <RLPElement[]>rlp.decode(data)
        const nonce = rlp.byteArrayToInt(<Uint8Array>decoded[0])
        const code = rlp.byteArrayToInt(<Uint8Array>decoded[1])
        const body = <RLPElement | RLPElement[]>decoded[2]
        switch (code) {
            case WS_CODES.TRANSACTION_EMIT: {
                const ret: TransactionResp = {
                    code: code,
                    nonce: nonce,
                    hash: bin2hex(<Uint8Array>body[0]),
                    status: rlp.byteArrayToInt(<Uint8Array>body[1]),
                    body: body
                }
                if (ret.status === TX_STATUS.DROPPED)
                    ret.reason = bin2str(<Uint8Array>body[2])
                if (ret.status === TX_STATUS.INCLUDED) {
                    const arr = body[2]
                    ret.blockHeight = toSafeInt(arr[0])
                    ret.blockHash = bin2hex(arr[1])
                    ret.gasUsed = toSafeInt(arr[2])
                    ret.result = arr[3]
                    ret.events = arr[4]
                }
                return ret
            }
            case WS_CODES.EVENT_EMIT: {
                let ret: EventResp = {
                    code: code,
                    nonce: nonce,
                    addr: bin2hex(<Uint8Array>body[0]),
                    name: bin2str(<Uint8Array>body[1]),
                    fields: <Uint8Array[]>(body[2]),
                    body: body
                }
                return ret
            }
            default:
                let ret: Resp = {
                    code: code,
                    body: body,
                    nonce: nonce
                }
                return ret
        }
    }

    private handleData(data: Uint8Array) {
        const resp = this.parse(data)

        switch (resp.code) {
            case WS_CODES.TRANSACTION_EMIT: {
                const r = <TransactionResp>resp
                const funcIds = this.txObservers.get(r.hash) || []
                funcIds.forEach(funcId => {
                    const func = this.callbacks.get(funcId)
                    func(r)
                })
                return
            }
            case WS_CODES.EVENT_EMIT: {
                const r = <EventResp>resp
                const funcIds = this.eventHandlers.get(`${r.addr}:${r.name}`) || []
                funcIds.forEach(funcId => {
                    const func = this.callbacks.get(funcId)
                    func(r)
                })
                return
            }
        }

        // when nonce > 0
        if (resp.nonce > 0) {
            const fn = this.rpcCallbacks.get(resp.nonce)
            if (fn)
                fn(<Resp>resp)
            this.rpcCallbacks.delete(resp.nonce)
        }
    }


    private __listen(contract: Contract, event: string, func: (r: Record<string, Readable>) => void) {
        const addr = hex2bin(contract.address)
        this.wsRPC(WS_CODES.EVENT_SUBSCRIBE, addr)
        const id = ++this.cid
        const key = `${contract.address}:${event}`
        this.id2key.set(id, key)
        const fn = (r: EventResp | TransactionResp) => {
            let resp = <EventResp>r
            const abiDecoded = <Record<string, Readable>>contract.abiDecode(resp.name, <Uint8Array[]>resp.fields, 'event')
            func(abiDecoded)
        }
        if (!this.eventHandlers.has(key))
            this.eventHandlers.set(key, new Set())

        this.eventHandlers.get(key).add(id)
        this.callbacks.set(id, fn)
        return id
    }

    /**
     * 监听合约事件
     */
    listen(contract, event): Promise<Record<string, Readable>> {
        return new Promise((rs, rj) => {
            this.__listen(contract, event, rs)
        })
    }

    /**
     * 移除监听器
     * @param {number} id 监听器的 id
     */
    removeListener(id: number): void {
        const key = this.id2key.get(id)
        const h = this.id2hash.get(id)
        this.callbacks.delete(id)
        this.id2key.delete(id)
        this.id2hash.delete(id)
        if (key) {
            const set = this.eventHandlers.get(key)
            set && set.delete(id)
            if (set && set.size === 0)
                this.eventHandlers.delete(key)
        }
        if (h) {
            const set = this.txObservers.get(h)
            set && set.delete(id)
            if (set && set.size === 0)
                this.txObservers.delete(h)
        }
    }

    listenOnce(contract: Contract, event: string): Promise<Record<string, Readable>> {
        const id = this.cid + 1
        return this.listen(contract, event).then((r) => {
            this.removeListener(id)
            return r
        })
    }


    private __observe(h: Binary, cb: (r: TransactionResp) => void) {
        const id = ++this.cid
        let hash = bin2hex(h)

        hash = hash.toLowerCase()
        if (!this.txObservers.has(hash))
            this.txObservers.set(hash, new Set())
        this.id2hash.set(id, hash)
        this.txObservers.get(hash).add(id)

        const fn = (r: TransactionResp) => {
            cb(r)
            switch (r.status) {
                case TX_STATUS.DROPPED:
                case TX_STATUS.CONFIRMED:
                    this.removeListener(id)
                    break
            }
        }
        this.callbacks.set(id, fn)
        return id
    }


    /**
     * 查看合约方法
     */
    viewContract(contract: Contract, method: string, parameters): Promise<Readable | Readable[] | Record<string, Readable>> {
        parameters = normalizeParams(parameters)
        const addr = contract.address
        const params = contract.abiEncode(method, parameters)

        return this.wsRPC(WS_CODES.CONTRACT_QUERY, [
            hex2bin(addr),
            method,
            params
        ]).then(r => contract.abiDecode(method, <Uint8Array[]>r.body))
    }

    /**
     * 发送事务
     * @param tx 事务
     */
    sendTransaction(tx: Transaction | Transaction[]) {
        return this.wsRPC(WS_CODES.TRANSACTION_SEND, [Array.isArray(tx), tx])
    }


    observe(tx: Transaction, status?: TX_STATUS, timeout?: number): Promise<TransactionResult> {
        status = status === undefined ? TX_STATUS.CONFIRMED : status
        return new Promise((resolve, reject) => {
            let success = false
            if (timeout)
                setTimeout(() => {
                    if (success) return
                    reject({ reason: 'timeout' })
                }, timeout)

            let ret: TransactionResult = {}
            let confirmed = false
            let included = false

            this.__observe(tx.getHash(), (r: TransactionResp) => {
                if (r.status === TX_STATUS.PENDING && status === TX_STATUS.PENDING) {
                    resolve({ transactionHash: r.hash })
                    return
                }
                if (r.status === TX_STATUS.DROPPED) {
                    const e = { hash: r.hash, reason: r.reason }
                    reject(e)
                    return
                }
                if (r.status === TX_STATUS.CONFIRMED) {
                    confirmed = true
                    if (status == TX_STATUS.INCLUDED)
                        return
                    if (included) {
                        success = true
                        resolve(ret)
                        return
                    }
                }
                if (r.status === TX_STATUS.INCLUDED) {
                    included = true
                    ret = {
                        blockHeight: r.blockHeight,
                        blockHash: r.blockHash,
                        gasUsed: r.gasUsed,
                    }
                    if (r.result && r.result.length
                        && tx.__abi
                        && tx.isDeployOrCall()
                        && (!tx.isBuiltInCall())) {
                        const decoded = (new Contract('', tx.__abi)).abiDecode(tx.getMethod(), <Uint8Array[]>r.result)
                        ret.result = <Readable>decoded
                    }

                    if (
                        r.events &&
                        r.events.length
                        && tx.__abi) {
                        const events = []
                        for (let e of r.events) {
                            const name = bin2str(e[0])
                            const decoded = (new Contract('', tx.__abi)).abiDecode(name, e[1], 'event')
                            events.push({ name: name, data: decoded })
                        }
                        ret.events = events
                    }

                    ret.transactionHash = tx.getHash()
                    ret.fee = toSafeInt((BigInt(tx.gasPrice) * BigInt(ret.gasUsed)))
                    if (tx.isDeployOrCall() && !tx.isBuiltInCall()) {
                        ret.method = tx.getMethod()
                        ret.inputs = tx.__inputs
                    }

                    if (status == TX_STATUS.INCLUDED) {
                        success = true
                        resolve(ret)
                        return
                    }

                    if (confirmed) {
                        success = true
                        resolve(ret)
                        return
                    }
                }
            })
        })
    }

    private wsRPC(code, data: any): Promise<Resp> {
        this.nonce++
        const n = this.nonce
        const ret: Promise<Resp> = new Promise((rs, rj) => {
            this.rpcCallbacks.set(n, rs)
        })
        this.tryConnect()
            .then(() => {
                const encoded = rlp.encode([n, code, data])
                if (this.ws)
                    this.ws.send(encoded)
            })
        return ret
    }


    sendAndObserve(tx: Transaction | Transaction[], status?: TX_STATUS, timeout?: number): Promise<TransactionResult> {
        let ret
        let sub: Promise<Resp>
        if (Array.isArray(tx)) {
            const arr = []
            sub = this.wsRPC(WS_CODES.TRANSACTION_SUBSCRIBE, tx.map(t => hex2bin(t.getHash())))
            for (const t of tx) {
                arr.push(this.observe(t, status, timeout))
            }
            ret = Promise.all(arr)
        } else {
            sub = this.wsRPC(WS_CODES.TRANSACTION_SUBSCRIBE, hex2bin(tx.getHash()))
            ret = this.observe(tx, status, timeout)
        }
        return sub
            .then(() => this.sendTransaction(tx))
            .then(() => ret)
    }

    /**
     * 查看区块头
     * @param hashOrHeight {string | number} 区块哈希值或者区块高度
     * @returns {Promise<Object>}
     */
    getHeader(hashOrHeight: string | number): Promise<Object> {
        const url = `http://${this.host}:${this.port}/rpc/header/${hashOrHeight}`
        return rpcGet(url)
    }

    /**
     * 查看区块
     * @param hashOrHeight {string | number} 区块哈希值或者区块高度
     * @returns {Promise<Object>}
     */
    getBlock(hashOrHeight: string | number): Promise<Object> {
        const url = `http://${this.host}:${this.port}/rpc/block/${hashOrHeight}`
        return rpcGet(url)
    }

    /**
     * 查看事务
     * @param hash 事务哈希值
     * @returns {Promise<Object>}
     */
    getTransaction(hash: string): Promise<Transaction> {
        const url = `http://${this.host}:${this.port}/rpc/transaction/${hash}`
        return rpcGet(url).then(r => Transaction.clone(r))
    }

    /**
     * 查看账户
     * @param pkOrAddress {string} 公钥或者地址
     * @returns {Promise<Object>}
     */
    getAccount(pkOrAddress):
        Promise<Account> {
        let d = hex2bin(pkOrAddress)
        if (d.length != 20)
            d = hex2bin(publicKey2Address(d))
        return this.wsRPC(WS_CODES.ACCOUNT_QUERY, d)
            .then(resp => {
                const decoded = <Uint8Array[]>resp.body
                const a = {
                    address: bin2hex(decoded[0]),
                    nonce: toSafeInt(decoded[1]),
                    balance: toSafeInt(decoded[2]),
                    createdBy: bin2hex(decoded[3]),
                    contractHash: bin2hex(decoded[4]),
                    storageRoot: bin2hex(decoded[5])
                }
                return a
            })
    }

    /**
     * 获取 nonce
     * @param pkOrAddress {string} 公钥或者地址
     * @returns {Promise<string>}
     */
    getNonce(pkOrAddress) {
        return this.getAccount(pkOrAddress)
            .then(a => a.nonce)
    }

    /**
     * 查看申请加入的地址
     * @param contractAddress 合约地址
     */
    getAuthPending(contractAddress: Binary) {
        return rpcPost(this.host, this.port, `/rpc/contract/${bin2hex(contractAddress)}`, {
            method: 'pending'
        })
    }

    /**
     * 查看已经加入的地址
     * @param contractAddress 合约地址
     */
    getAuthNodes(contractAddress: Binary): Promise<string[]> {
        return <Promise<string[]>>rpcPost(this.host, this.port, `/rpc/contract/${bin2hex(contractAddress)}`, {
            method: 'nodes'
        })
    }

    /**
     * 查看投票数量排名列表
     */
    getPoSNodeInfos() {
        return rpcPost(this.host, this.port, `/rpc/contract/${constants.POS_CONTRACT_ADDR}`, {
            method: 'nodeInfos'
        })
    }

    /**
     * 查看投票
     * @param txHash 投票的事务哈希值
     * @returns { Promise }
     */
    getPoSVoteInfo(txHash) {
        return rpcPost(this.host, this.port, `/rpc/contract/${constants.POS_CONTRACT_ADDR}`, {
            method: 'voteInfo',
            txHash: txHash
        })
    }

    close() {
        if (this.ws) {
            const __ws = this.ws
            this.ws = null
            __ws.close()
        }
    }
}


function rpcGet(url): Promise<Object> {
    if (typeof window !== 'object') {
        const http = require('http')
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
    else {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    const resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        resolve(resp.data)
                    } else {
                        reject(resp.message)
                    }
                }
            };
            xhr.open('GET', url);
            xhr.send()
        })
    }
}

function rpcPost(host, port, path, data): Promise<Object> {
    if (!path.startsWith('/'))
        path = '/' + path
    data = typeof data === 'string' ? data : JSON.stringify(data)
    if (typeof window !== 'object') {
        const http = require('http')
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
    } else {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.onload = function () {
                if (xhr.status !== 200) {
                    reject('server error')
                    return
                }
                const resp = JSON.parse(xhr.responseText);
                if (resp.code === 200)
                    resolve(resp.data)
                else {
                    reject(resp.message)
                }
            }
            xhr.open('POST', `http://${host}:${port}${path}`);
            xhr.setRequestHeader('Content-Type', 'application/json')
            xhr.send(data)
        })
    }
}