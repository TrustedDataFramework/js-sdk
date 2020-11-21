import { normalizeAddress, bin2hex, bin2str, hex2bin, encodeBE, toSafeInt, decodeBE, toBigN, convert } from "./utils"
import { ABI, getContractAddress, normalizeParams } from "./contract"
import { Binary, AbiInput, Digital, ZERO, Readable } from "./constants"
import { CallContext, ContextHost, DBHost, EventHost, Log, Reflect, Transfer, AbstractHost } from './hosts'

import * as rlp from './rlp'
import { ABI_DATA_TYPE } from "./constants"
import { sm3 } from '@salaku/sm-crypto'

const utf8Decoder = new TextDecoder()
const utf8Encoder = new TextEncoder()

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
        const lenAndStart = this.ins.exports.__peek(BigInt(offset), BigInt(type))
        const len = Number(lenAndStart >> BigInt(32))
        const start = Number(lenAndStart & BigInt(0xffffffff))
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

    malloc(x: string | bigint | ArrayBuffer | Uint8Array | number | boolean, type: ABI_DATA_TYPE): number | bigint{
        let bin: ArrayBuffer
        if(typeof x === 'boolean')
            x = x ? 1 : 0
        if (typeof x === 'string') {
            switch(type){
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
                    return toSafeInt(BigInt((convert(x, type))))
                case ABI_DATA_TYPE.f64:
                    return parseFloat(x)        
            }
        }
        if (typeof x === 'bigint' || typeof x === 'number') {
            bin = encodeBE(x).buffer
            switch(type){
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
                    return toSafeInt(x)
                case ABI_DATA_TYPE.f64:
                    return Number(x)   
            }            
        }
        if (x instanceof ArrayBuffer) {
            bin = x
            switch(type){
                case ABI_DATA_TYPE.bytes:
                case ABI_DATA_TYPE.address:
                    break
                default:
                    throw new Error(`cannot convert binary to ${ABI_DATA_TYPE[type]}`)      
            }              
        }
        if (x instanceof Uint8Array){
            bin = x.buffer
            switch(type){
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

    /**
     * 发送事务调用合约
     * @param sender 事务发送着
     * @param addr 合约地址
     * @param method 调用的方法
     * @param params 调用参数
     * @param amount 事务的 amount
     */
    call(sender: Binary, addr: Binary, method: string, params?: AbiInput | AbiInput[] | Record<string, AbiInput>, amount?: Digital): Promise<Readable> {
        let origin = hex2bin(normalizeAddress(sender)).buffer
        const n = this.increaseNonce(sender)
        return this.callInternal(method, {
            type: null,
            sender: origin,
            to: hex2bin(normalizeAddress(addr)).buffer,
            amount: toBigN(amount || ZERO),
            nonce: n,
            origin: origin,
            txHash: hex2bin(sm3(rlp.encode([origin, n]))).buffer,
            contractAddress: hex2bin(normalizeAddress(addr)).buffer,
            readonly: false
        }, params)
    }

    private async callInternal(method: string, ctx?: CallContext, params?: AbiInput | AbiInput[] | Record<string, AbiInput>): Promise<Readable> {
        // 1. substract amount
        this.subBalance(ctx.sender, ctx.amount)
        this.addBalance(ctx.contractAddress, ctx.amount)
        ctx.type = method === 'init' ? 16 : 17
        const file = this.contractCode.get(bin2hex(ctx.contractAddress))
        const abi = await this.fetchABI(file)

        let mem = new WebAssembly.Memory({ initial: 10, maximum: 65535 })
        const env = {
            memory: mem,
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

        let instance = <VMInstance>(await WebAssembly.instantiateStreaming(fetch(file), {
            env: env
        })).instance

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
            args.push(wai.malloc(arr[i], t), t)
        }
        let ret = instance.exports[method].apply(window, args)
        if (a.outputs && a.outputs.length)
            return this.extractRet(instance, ret, ABI_DATA_TYPE[a.outputs[0].type])

    }

    extractRet(ins: VMInstance, offset: number | bigint, type: ABI_DATA_TYPE): Readable{
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
                return <string> peeked
            }
            case ABI_DATA_TYPE.address:
            case ABI_DATA_TYPE.bytes: {
                let peeked = <ArrayBuffer> wai.peek(offset, type)
                return bin2hex(peeked)
            }
            case ABI_DATA_TYPE.u256: {
                return <bigint> wai.peek(offset, type)
            }
        }
    }

    private getTxHash(origin: ArrayBuffer, nonce: number): ArrayBuffer{
        return hex2bin(sm3(rlp.encode([origin, nonce]))).buffer
    }

    async view(): Promise<Readable> {
        return null
    }

    // 合约部署
    async deploy(sender: Binary, wasmFile: string, parameters?: AbiInput | AbiInput[] | Record<string, AbiInput>, amount?: Digital): Promise<Readable> {
        let senderAddress = normalizeAddress(sender)
        let senderAddressBuffer = hex2bin(sender).buffer
        // 用 keccak256(rlp([sender, nonce  ])) 模拟事务哈希值 计算地址
        const n = this.increaseNonce(sender)
        const txHash = this.getTxHash(senderAddressBuffer, n)
        const contractAddress = getContractAddress(senderAddress, n)
        const contractAddressHex = bin2hex(contractAddress)

        const abi = await this.fetchABI(wasmFile)
        this.abiCache.set(contractAddressHex, abi)
        this.contractCode.set(contractAddressHex, wasmFile)

        const a = abi.filter(x => x.type === 'function' && x.name === 'init')[0]
        // try to execute init function
        if (a) {
            return this.callInternal('init', {
                type: null,
                sender: hex2bin(sender).buffer,
                to: new Uint8Array(20).buffer,
                amount: toBigN(amount || ZERO),
                nonce: n,
                origin: senderAddressBuffer,
                txHash: txHash,
                contractAddress: hex2bin(contractAddress).buffer,
                readonly: false
            }, parameters)
        }
        this.nextBlock()
        return null
    }

    // 根据文件名规范获取 abi
    async fetchABI(wasmFile: string): Promise<ABI[]> {
        let f = wasmFile.replace(/^(.*)\.wasm$/, '$1.abi.json')
        if (this.abiCache.has(f))
            return this.abiCache.get(f)
        const resp = await fetch(f)
        const buf = await resp.arrayBuffer()
        return JSON.parse(bin2str(buf))
    }
}