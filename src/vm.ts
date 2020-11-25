import { normalizeAddress, bin2hex, bin2str, hex2bin, encodeBE, toSafeInt, decodeBE, toBigN, convert } from "./utils"
import { ABI, getContractAddress, normalizeParams, compileABI } from "./contract"
import { Binary, AbiInput, Digital, ZERO, Readable, constants } from "./constants"
import { ContextHost, DBHost, EventHost, Log, Reflect, Transfer, AbstractHost } from './hosts'

import * as rlp from './rlp'
import { ABI_DATA_TYPE } from "./constants"
import { sm3 } from '@salaku/sm-crypto'
import { TransactionResult } from "./rpc"

const utf8Decoder = new TextDecoder()
const utf8Encoder = new TextEncoder()

export enum TransactionType {
    COIN_BASE,
    TRANSFER,
    CONTRACT_DEPLOY,
    CONTRACT_CALL
}

// 合约调用上下文

export interface CallContext {
    /**
     * 事务版本号
     */
    version: number

    /**
     * 事务构造时间
     */
    createdAt: number

    /**
     * 事务的 gas 限制
     */
    gasLimit: bigint

    /**
     * 事务的 gas 单价
     */
    gasPrice: bigint

    /**
     * 事务的签名
     */
    signature: ArrayBuffer


    /**
     * 事务的类型
     */
    type: TransactionType

    /**
     * 当前调用者，可能是用户地址或者合约地址
     */
    sender: ArrayBuffer

    /**
     * 事务的 to
     */
    to: ArrayBuffer

    /**
     * 当前调用的 amount
     */
    amount: bigint

    /**
     * 事务的 amount
     */
    txAmount: bigint

    /**
     * 事务的 nonce
     */
    nonce: number

    /**
     * 事务的 from 对应的地址
     */
    origin: ArrayBuffer

    /**
     * 事务的哈希值
     */
    txHash: ArrayBuffer

    /**
     * 当前执行的合约的地址
     */
    contractAddress: ArrayBuffer

    /**
     * 当前调用的链上数据是否处于只读状态
     */
    readonly: boolean

    events: { name: string, data: any }[]
}


/**
 * 通过虚拟机部署、调用合约时注入的参数
 */
export interface TransactionOptions {
    /**
     * 事务版本号
     */
    version?: Digital

    /**
     * 事务构造的时间戳(秒)
     */
    createdAt?: Digital

    /**
     * gas 使用限制
     */
    gasLimit?: Digital

    /**
     * gas 单价
     */
    gasPrice?: Digital

    /**
     * 事务签名
     */
    signature?: Binary

    /**
     * 可以预设事务哈希值
     */
    hash?: Binary

    /**
     * 事务的 to
     */
    to?: Binary
}


/**
 * 虚拟机实例
 */
export interface VMInstance extends WebAssembly.Instance {
    exports: {
        memory: WebAssembly.Memory
        __malloc: (size: bigint) => bigint
        __peek: (ptr: bigint, t: bigint) => bigint
        __change_t: (t: bigint, ptr: bigint, size: bigint) => bigint
        init?: Function
    }
}

export class WasmInterface {
    constructor(readonly ins: VMInstance) {

    }

    loadN(offset: number | bigint, length: number | bigint): ArrayBuffer {
        let view = new DataView(this.ins.exports.memory.buffer)
        return view.buffer.slice(Number(offset), Number(offset) + Number(length))
    }

    put(offset: number | bigint, data: ArrayBuffer): void {
        new Uint8Array(this.ins.exports.memory.buffer).set(new Uint8Array(data), Number(offset))
    }


    peek(offset: number | bigint, type: ABI_DATA_TYPE): string | bigint | ArrayBuffer {
        const startAndLen = this.ins.exports.__peek(BigInt(offset), BigInt(type))
        const len = Number(startAndLen & BigInt(0xffffffff))
        const start = Number(startAndLen >> BigInt(32))
        let bin = this.loadN(start, len)
        switch (type) {
            case ABI_DATA_TYPE.string: {
                return utf8Decoder.decode(bin)
            }
            case ABI_DATA_TYPE.u256:
                return decodeBE(bin)
            case ABI_DATA_TYPE.bytes:
            case ABI_DATA_TYPE.address:
                return bin
        }
    }

    malloc(x: string | bigint | ArrayBuffer | Uint8Array | number | boolean, type: ABI_DATA_TYPE): number | bigint {
        let bin: ArrayBuffer
        if (typeof x === 'boolean')
            x = x ? 1 : 0
        if (typeof x === 'string') {
            switch (type) {
                case ABI_DATA_TYPE.bytes:
                case ABI_DATA_TYPE.address:
                    bin = hex2bin(x).buffer
                    break
                case ABI_DATA_TYPE.string:
                    bin = utf8Encoder.encode(x).buffer
                    break
                case ABI_DATA_TYPE.u256:
                    bin = encodeBE(toBigN(x)).buffer
                    break
                case ABI_DATA_TYPE.u64:
                case ABI_DATA_TYPE.i64:
                    return BigInt((convert(x, type)))
                case ABI_DATA_TYPE.f64:
                    return parseFloat(x)
            }
        }
        if (typeof x === 'bigint' || typeof x === 'number') {
            switch (type) {
                case ABI_DATA_TYPE.bytes:
                case ABI_DATA_TYPE.address:
                    throw new Error(`cannot convert ${x} to bytes or address`)
                case ABI_DATA_TYPE.string:
                    bin = utf8Encoder.encode(x.toString()).buffer
                    break
                case ABI_DATA_TYPE.u256:
                    bin = encodeBE(x).buffer
                    break
                case ABI_DATA_TYPE.u64:
                case ABI_DATA_TYPE.i64:
                    return BigInt(x)
                case ABI_DATA_TYPE.f64:
                    return Number(x)
            }
        }
        if (x instanceof ArrayBuffer) {
            bin = x
            switch (type) {
                case ABI_DATA_TYPE.bytes:
                case ABI_DATA_TYPE.address:
                    break
                default:
                    throw new Error(`cannot convert binary to ${ABI_DATA_TYPE[type]}`)
            }
        }
        if (x instanceof Uint8Array) {
            bin = x.buffer
            switch (type) {
                case ABI_DATA_TYPE.bytes:
                case ABI_DATA_TYPE.address:
                    break
                default:
                    throw new Error(`cannot convert binary to ${ABI_DATA_TYPE[type]}`)
            }
        }
        let len = bin.byteLength
        const p0 = this.ins.exports.__malloc(BigInt(len))
        this.put(p0, bin)
        const ptr = this.ins.exports.__change_t(BigInt(type), p0, BigInt(bin.byteLength))
        return Number(ptr)
    }
}


export function isZero(n: number | bigint): boolean {
    return n === 0 || n === BigInt(0)
}

/**
 * virtual machine for chrome debugging 
 */
export class VirtualMachine {
    // current block height
    height = 0

    // parent block hash
    parentHash: ArrayBuffer

    // current block hash
    hash: ArrayBuffer = (new Uint8Array(32)).buffer

    // contract address -> wasm file url
    contractCode: Map<string, string> = new Map()

    // cache for abi
    abiCache: Map<string, ABI[]> = new Map()

    // nonce
    nonceMap: Map<string, number> = new Map()

    // balance
    balanceMap: Map<string, bigint> = new Map()

    // unix epoch seconds, block created at & transaction created at
    now: number

    storage: Map<string, Map<string, ArrayBuffer>> = new Map()

    hosts: Map<string, Function> = new Map()

    map2Array<V>(m: Map<string, V>): [Uint8Array, V][] {
        const ret = []
        m.forEach((v, k) => ret.push([hex2bin(k), v]))
        return ret
    }

    dump(): ArrayBuffer {
        const storageArray = this.map2Array(this.storage)
        const enc: [Uint8Array, [Uint8Array, ArrayBuffer][]][] = storageArray.map(x => [x[0], this.map2Array(x[1])])
        const arr = [
            this.height, this.parentHash, this.hash, this.map2Array(this.contractCode),
            this.map2Array(this.nonceMap), this.map2Array(this.balanceMap),
            this.now, enc
        ]
        return rlp.encode(arr)
    }

    static fromDump(dumped: ArrayBuffer | Uint8Array): VirtualMachine {
        const decoded = rlp.decode(dumped)
        const vm = new VirtualMachine()
        vm.height = rlp.byteArrayToInt(<Uint8Array>decoded[0])
        vm.parentHash = (<Uint8Array>decoded[1]).buffer
        vm.hash = (decoded[2] as Uint8Array).buffer;
        (decoded[3] as any[]).forEach((arr: [Uint8Array, Uint8Array]) => {
            vm.contractCode.set(bin2hex(arr[0]), bin2str(arr[1]))
        });

        (decoded[4] as any[]).forEach((arr: [Uint8Array, Uint8Array]) => {
            vm.nonceMap.set(bin2hex(arr[0]), rlp.byteArrayToInt(arr[1]))
        });

        (decoded[5] as any[]).forEach((arr: [Uint8Array, Uint8Array]) => {
            vm.balanceMap.set(bin2hex(arr[0]), toBigN(arr[1]))
        });

        vm.now = rlp.byteArrayToInt(<Uint8Array>decoded[6]);

        (decoded[7] as any[]).forEach((arr: [Uint8Array, [Uint8Array, Uint8Array][]]) => {
            const k = bin2hex(arr[0])
            if (!vm.storage.has(k))
                vm.storage.set(k, new Map())
            const m: Map<string, ArrayBuffer> = vm.storage.get(k);
            (arr[1]).forEach((kv) => {
                m.set(bin2hex(kv[0]), kv[1].buffer)
            })
        })

        return vm
    }

    constructor() {
        if (typeof WebAssembly !== 'object')
            throw new Error('webassembly not available here')
        this.nextBlock()
    }


    normParams(abi: ABI, params?: AbiInput | AbiInput[] | Record<string, AbiInput>): AbiInput[] {
        let p = normalizeParams(params)
        if (Array.isArray(p))
            return p
        const ret = []
        abi.inputs.forEach(i => {
            ret.push(params[i.name])
        })
        return ret
    }

    alloc(address: Binary, amount: Digital): void {
        this.balanceMap.set(normalizeAddress(address), toBigN(amount))
    }

    // 模拟区块的生成
    nextBlock(): void {
        this.height++
        this.parentHash = this.hash
        this.hash = hex2bin(sm3(rlp.encode(this.height))).buffer
        this.now = Math.floor((new Date()).valueOf() / 1000)
    }

    addBalance(addr: Binary, amount?: Digital) {
        let hex = normalizeAddress(addr)
        let balance: bigint = this.balanceMap.get(hex) || ZERO
        balance = balance + toBigN(amount || ZERO)
        this.balanceMap.set(hex, balance)
    }

    subBalance(addr: Binary, amount?: Digital) {
        let hex = normalizeAddress(addr)
        let balance: bigint = this.balanceMap.get(hex) || ZERO
        let a = toBigN(amount || ZERO)
        if (balance < a)
            throw new Error(`the balance of ${hex} is not enough`)
        balance = balance - a
        this.balanceMap.set(hex, balance)
    }

    increaseNonce(sender: Binary): number {
        let senderHex = normalizeAddress(sender)
        const n = (this.nonceMap.get(senderHex) || 0) + 1
        this.nonceMap.set(senderHex, n)
        return n
    }


    optionsToContext(opts: TransactionOptions, sender: Binary, contractAddr: Binary, amount: Digital, deploy: boolean = false): CallContext {
        const senderAddr = hex2bin(normalizeAddress(sender)).buffer
        const contractAddrBin = hex2bin(normalizeAddress(contractAddr)).buffer
        const n = this.nonceMap.get(bin2hex(sender)) || 0
        return {
            version: <number>toSafeInt(opts.version || constants.POA_VERSION),
            createdAt: <number>toSafeInt(opts.createdAt || this.now),
            gasLimit: toBigN(opts.gasLimit || 0),
            gasPrice: toBigN(opts.gasPrice || 0),
            signature: hex2bin(opts.signature || new Uint8Array(64)).buffer,
            type: null,
            sender: senderAddr,
            amount: toBigN(amount),
            nonce: n,
            origin: senderAddr,
            txHash: hex2bin(opts.hash || this.getTxHash(senderAddr, n)).buffer,
            contractAddress: contractAddrBin,
            readonly: false,
            txAmount: toBigN(amount),
            to: hex2bin(opts.to || (deploy ? '' : contractAddrBin)).buffer,
            events: []
        }
    }


    /**
     * 发送事务调用合约
     * @param sender 事务发送着
     * @param addr 合约地址
     * @param method 调用的方法
     * @param params 调用参数
     * @param amount 事务的 amount
     * @param opts
     */
    async call(sender: Binary, addr: Binary, method: string, params: AbiInput | AbiInput[] | Record<string, AbiInput> = [], amount: Digital = 0, opts: TransactionOptions = {}): Promise<TransactionResult> {
        this.increaseNonce(sender)
        const ctx = this.optionsToContext(opts, sender, addr, amount)
        ctx.type = TransactionType.CONTRACT_CALL
        const ret = await this.callInternal(method, ctx, params)
        this.nextBlock()
        return ret
    }


    /**
     * 查看合约
     * @param addr 
     * @param method 
     * @param params 
     */
    async view(addr: Binary, method: string, params: AbiInput | AbiInput[] | Record<string, AbiInput> = []): Promise<Readable> {
        const ctx = <CallContext>{
            readonly: true,
            contractAddress: hex2bin(addr).buffer
        }
        const ret = await this.callInternal(method, ctx, params)
        return ret.result
    }

    private async createInstance(file: string, env: any): Promise<VMInstance>{
        if (typeof WebAssembly.instantiateStreaming === 'function' && typeof fetch === 'function') {
            return <VMInstance>(await WebAssembly.instantiateStreaming(fetch(file), {
                env: env
            })).instance
        }
        const fs = require('fs')
        return <VMInstance> (await WebAssembly.instantiate(fs.readFileSync(file), {env: env})).instance
    }

    private async callInternal(method: string, ctx?: CallContext, params?: AbiInput | AbiInput[] | Record<string, AbiInput>): Promise<TransactionResult> {
        // 1. substract amount
        if (!ctx.readonly) {
            this.subBalance(ctx.sender, ctx.amount)
            this.addBalance(ctx.contractAddress, ctx.amount)
        }
        ctx.type = method === 'init' ? TransactionType.CONTRACT_DEPLOY : TransactionType.CONTRACT_CALL
        const file = this.contractCode.get(bin2hex(ctx.contractAddress))
        const abi = await this.fetchABI(file)

        let mem = new WebAssembly.Memory({ initial: 10, maximum: 65535 })
        const env = {
            memory: mem,
            _nop: () => undefined
        }

        const hosts: AbstractHost[] = [
            new Log(this), new EventHost(this, ctx), new DBHost(this, ctx),
            new ContextHost(this, ctx), new Reflect(this),
            new Transfer(this, ctx)
        ]

        hosts.forEach(h => {
            env[h.name()] = (...args: (number | bigint)[]) => {
                return h.execute(args)
            }
        })

        this.hosts.forEach((v, k) => {
            env[k] = v
        })

        let instance = await this.createInstance(file, env)

        hosts.forEach(h => {
            h.setIns(instance)
        })

        if (typeof instance.exports[method] !== 'function') {
            throw new Error(`call internal failed: ${method} not found`)
        }

        const wai = new WasmInterface(instance)
        const a = abi.filter(x => x.type === 'function' && x.name === method)[0]
        const arr = this.normParams(a, params)
        const args = []
        for (let i = 0; i < a.inputs.length; i++) {
            const t = ABI_DATA_TYPE[a.inputs[i].type]
            args.push(wai.malloc(arr[i], t))
        }
        let ret = instance.exports[method].apply(instance.exports, args)

        const txHash = ctx.readonly ? null : bin2hex(ctx.txHash)
        const r: TransactionResult = {
            transactionHash: txHash,
            blockHeight: this.height,
            blockHash: bin2hex(this.hash),
            gasUsed: 0,
            events: ctx.events,
            fee: 0,
            method: method
        }

        if (a.outputs && a.outputs.length)
            r.result = this.extractRet(instance, ret, ABI_DATA_TYPE[a.outputs[0].type])
        return r
    }

    extractRet(ins: VMInstance, offset: number | bigint, type: ABI_DATA_TYPE): Readable {
        let wai = new WasmInterface(ins)
        switch (type) {
            case ABI_DATA_TYPE.bool:
                return Number(offset) !== 0
            case ABI_DATA_TYPE.i64:
                return toSafeInt(offset)
            case ABI_DATA_TYPE.u64: {
                // 即使webassembly 返回类型是 uint, bigint 也会出现小于 0 的情况，需要自行转换
                if (offset < 0) {
                    let buf = new ArrayBuffer(8)
                    new DataView(buf).setBigInt64(0, BigInt(offset))
                    return toSafeInt(buf)
                }
                return toSafeInt(offset)
            }
            case ABI_DATA_TYPE.f64: {
                return <number>offset
            }
            case ABI_DATA_TYPE.string: {
                let peeked = wai.peek(offset, type)
                return <string>peeked
            }
            case ABI_DATA_TYPE.address:
            case ABI_DATA_TYPE.bytes: {
                let peeked = <ArrayBuffer>wai.peek(offset, type)
                return bin2hex(peeked)
            }
            case ABI_DATA_TYPE.u256: {
                return <bigint>wai.peek(offset, type)
            }
        }
    }

    private getTxHash(origin: ArrayBuffer, nonce: number): ArrayBuffer {
        return hex2bin(sm3(rlp.encode([origin, nonce]))).buffer
    }


    // 合约部署
    async deploy(sender: Binary, wasmFile: string, parameters: AbiInput | AbiInput[] | Record<string, AbiInput> = [], amount: Digital = 0, opts: TransactionOptions = {}): Promise<TransactionResult> {
        let senderAddress = normalizeAddress(sender)
        const n = this.increaseNonce(sender)
        const contractAddress = getContractAddress(senderAddress, n)
        const ctx = this.optionsToContext(opts, sender, contractAddress, amount)
        ctx.type = TransactionType.CONTRACT_DEPLOY
        const abi = await this.fetchABI(wasmFile)
        this.abiCache.set(contractAddress, abi)
        this.contractCode.set(contractAddress, wasmFile)

        const a = abi.filter(x => x.type === 'function' && x.name === 'init')[0]

        let ret
        // try to execute init function
        if (a) {
            ret = await this.callInternal('init', ctx, parameters)
        }
        this.nextBlock()
        return ret
    }

    // 根据文件名规范获取 abi
    async fetchABI(wasmFile: string): Promise<ABI[]> {
        let f = wasmFile.replace(/^(.*)\.wasm$/, '$1.abi.json')
        if (this.abiCache.has(f))
            return this.abiCache.get(f)

        if (typeof fetch === 'function') {
            const resp = await fetch(f)
            const buf = await resp.arrayBuffer()
            const ret = JSON.parse(bin2str(buf))
            this.abiCache.set(f, ret)
            return ret
        }

        const fs = require('fs')
        const ret = JSON.parse(fs.readFileSync(f, 'utf-8'))
        this.abiCache.set(f, ret)
        return ret
    }
}