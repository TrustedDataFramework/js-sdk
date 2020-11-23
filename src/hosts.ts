import {isZero, VirtualMachine, VMInstance, WasmInterface} from './vm'
import {bin2hex, str2bin} from './utils'
import {Contract} from './contract'
import * as rlp from './rlp'
import {ABI_DATA_TYPE, ZERO} from './constants'
import { CallContext } from './vm'


export abstract class AbstractHost {
    wai: WasmInterface
    world: VirtualMachine
    utf8Decoder: TextDecoder
    utf16Decoder: TextDecoder
    nonce: number
    deploy: boolean
    memory: ArrayBuffer

    constructor(world: VirtualMachine) {
        this.world = world
    }

    // after initialize
    setIns(ins: VMInstance): void{
        this.wai = new WasmInterface(ins)
    }

    abstract execute(args: (number | bigint)[]): void | number | bigint

    abstract name(): string
}

export class Log extends AbstractHost {
    name(): string {
        return '_log'
    }

    execute(args: (number | bigint)[]): void {
        if(this.wai === undefined){
            console.log('undefined')
        }
        let s = <string> this.wai.peek(args[0], ABI_DATA_TYPE.string)
        console.log(s)
    }
}

enum ContextType {
    HEADER_PARENT_HASH,
    HEADER_CREATED_AT,
    HEADER_HEIGHT,
    TX_TYPE,
    TX_CREATED_AT,
    TX_NONCE,
    TX_ORIGIN,
    TX_GAS_PRICE,
    TX_AMOUNT,
    TX_TO,
    TX_SIGNATURE,
    TX_HASH,
    CONTRACT_ADDRESS,
    CONTRACT_NONCE,
    CONTRACT_CREATED_BY,
    ACCOUNT_NONCE,
    ACCOUNT_BALANCE,
    MSG_SENDER,
    MSG_AMOUNT,
    CONTRACT_CODE,
    CONTRACT_ABI
}

enum DBType {
    SET, GET, REMOVE, HAS
}


export class EventHost extends AbstractHost {
    ctx: CallContext

    constructor(world: VirtualMachine, ctx: CallContext) {
        super(world)
        this.ctx = ctx
    }

    execute(args: bigint[]): void {
        if(this.ctx.readonly)
            throw new Error('emit event failed: readonly')
        const name = <string> this.wai.peek(args[0], ABI_DATA_TYPE.string)
        const encoded = <ArrayBuffer> this.wai.peek(args[1], ABI_DATA_TYPE.bytes)
        let abi = this.world.abiCache.get(bin2hex(this.ctx.contractAddress))
        const c = new Contract('', abi)
        let fields = <Uint8Array[]>rlp.decode(encoded)
        let o = c.abiDecode(name, fields, 'event')
        this.ctx.events.push({name: name, data: o})
    }
    name(): string {
        return '_event'
    }

}

export class DBHost extends AbstractHost {
    ctx: CallContext


    execute(args: bigint[]): bigint {
        let t = Number(args[0])
        if((t === DBType.SET || t === DBType.REMOVE) && this.ctx.readonly)
            throw new Error('modify db failed: readonly')
        switch (t) {
            case DBType.SET: {
                if(this.ctx.readonly)
                    throw new Error('emit event failed: readonly')
                let addr = bin2hex(this.ctx.contractAddress)
                let k = <ArrayBuffer> this.wai.peek(args[1], ABI_DATA_TYPE.bytes)
                let val = <ArrayBuffer> this.wai.peek(args[2], ABI_DATA_TYPE.bytes)
                let m = this.world.storage.get(addr) || new Map<string, ArrayBuffer>()
                m.set(bin2hex(k), val)
                this.world.storage.set(addr, m)
                return BigInt(0)
            }
            case DBType.GET: {
                let addr = bin2hex(this.ctx.contractAddress)
                let k = bin2hex(<ArrayBuffer> this.wai.peek(args[1], ABI_DATA_TYPE.bytes))
                let m = this.world.storage.get(addr) || new Map<string, ArrayBuffer>()
                if (!m.has(k))
                    throw new Error(`key ${k} not found in db`)
                let val = m.get(k)
                let r = this.wai.malloc(val, ABI_DATA_TYPE.bytes)
                return BigInt(r)
            }
            case DBType.HAS: {
                let addr = bin2hex(this.ctx.contractAddress)
                let k = bin2hex(<ArrayBuffer> this.wai.peek(args[1], ABI_DATA_TYPE.bytes))
                let m = this.world.storage.get(addr) || new Map<string, ArrayBuffer>()
                return m.has(k) ? BigInt(1) : BigInt(0)
            }
            case DBType.REMOVE: {
                let addr = bin2hex(this.ctx.contractAddress)
                let k = bin2hex(<ArrayBuffer> this.wai.peek(args[1], ABI_DATA_TYPE.bytes))
                const m = this.world.storage.get(addr) 
                m && m.delete(k)
                return BigInt(0)
            }
        }
    }

    name(): string {
        return '_db'
    }


    constructor(world: VirtualMachine, ctx: CallContext) {
        super(world)
        this.ctx = ctx
    }


}

export class ContextHost extends AbstractHost {
    ctx: CallContext

    constructor(world: VirtualMachine, ctx: CallContext) {
        super(world)
        this.ctx = ctx
    }

    execute(args: bigint[]): bigint{
        let type = Number(args[0])
        const readonlyTypes = [
            ContextType.CONTRACT_ADDRESS, ContextType.CONTRACT_NONCE, 
            ContextType.ACCOUNT_NONCE, ContextType.ACCOUNT_BALANCE,
            ContextType.CONTRACT_CODE, ContextType.CONTRACT_ABI
        ]
        if(this.ctx.readonly && readonlyTypes.indexOf(type) < 0)
            throw new Error(`${ContextType[type]} is not available in view`)

        switch (type) {
            case ContextType.HEADER_PARENT_HASH: {
                return BigInt(this.wai.malloc(this.world.parentHash, ABI_DATA_TYPE.bytes))
            }
            case ContextType.HEADER_CREATED_AT: {
                return BigInt(this.world.now)
            }
            case ContextType.HEADER_HEIGHT: {
                return BigInt(this.world.height)
            }
            case ContextType.TX_TYPE: {
                return BigInt(this.ctx.type)
            }
            case ContextType.TX_NONCE:{
                return BigInt(this.ctx.nonce)
            }
            case ContextType.TX_CREATED_AT: {
                return BigInt(this.ctx.createdAt)
            }
            case ContextType.TX_ORIGIN: {
                return BigInt(this.wai.malloc(this.ctx.origin, ABI_DATA_TYPE.address))
            }
            case ContextType.TX_GAS_PRICE: {
                return BigInt(this.wai.malloc(this.ctx.gasPrice, ABI_DATA_TYPE.u256))
            }
            case ContextType.TX_AMOUNT: {
                return BigInt(this.wai.malloc(this.ctx.amount, ABI_DATA_TYPE.u256))
            }
            case ContextType.TX_TO: {
                return BigInt(this.wai.malloc(this.ctx.to, ABI_DATA_TYPE.address))
            }
            case ContextType.TX_SIGNATURE: {
                return BigInt(this.wai.malloc(this.ctx.signature, ABI_DATA_TYPE.bytes))
            }
            case ContextType.TX_HASH: {
                return BigInt(this.wai.malloc(this.ctx.txHash, ABI_DATA_TYPE.bytes))
            }
            case ContextType.CONTRACT_ADDRESS: {
                return BigInt(this.wai.malloc(this.ctx.contractAddress, ABI_DATA_TYPE.address))
            }
            case ContextType.CONTRACT_NONCE: {
                return BigInt(this.world.nonceMap.get(bin2hex(this.ctx.contractAddress)) || 0)
            }
            case ContextType.ACCOUNT_NONCE: {
                let addr = <ArrayBuffer> this.wai.peek(args[1], ABI_DATA_TYPE.address)
                return BigInt(this.world.nonceMap.get(bin2hex(addr)) || 0)
            }
            case ContextType.ACCOUNT_BALANCE: {
                let addr = <ArrayBuffer> this.wai.peek(args[1], ABI_DATA_TYPE.address)
                let b: bigint = this.world.balanceMap.get(bin2hex(addr)) || ZERO
                return BigInt(this.wai.malloc(b, ABI_DATA_TYPE.u256))
            }
            case ContextType.MSG_SENDER: {
                return BigInt(this.wai.malloc(this.ctx.sender, ABI_DATA_TYPE.address))
            }
            case ContextType.MSG_AMOUNT: {
                return BigInt(this.wai.malloc(this.ctx.amount || ZERO, ABI_DATA_TYPE.u256))
            }
            case ContextType.CONTRACT_CODE: {
                let addr = <ArrayBuffer> this.wai.peek(args[1], ABI_DATA_TYPE.address)
                let code = this.world.contractCode.get(bin2hex(addr))
                return BigInt(this.wai.malloc(str2bin(code), ABI_DATA_TYPE.bytes))
            }
            case ContextType.CONTRACT_ABI: {
                let abi = this.world.abiCache.get(bin2hex(this.ctx.contractAddress))
                const c = new Contract('', abi)
                let data = rlp.encode(c.abiToBinary())
                return BigInt(this.wai.malloc(data, ABI_DATA_TYPE.bytes))
            }
            default:
                throw new Error(`unimplemented: ${ContextType[type]}`)
        }
    }
    name(): string {
        return '_context'
    }
}


export class Reflect extends AbstractHost{
    execute(args: (number | bigint)[]): number | bigint | void {
        throw new Error('Method not implemented.')
    }
    name(): string {
        return '_reflect'
    }
}

export class Transfer extends AbstractHost{
    ctx: CallContext


    constructor(world: VirtualMachine, ctx: CallContext) {
        super(world)
        this.ctx = ctx
    }

    execute(args: bigint[]): void {
        if(this.ctx.readonly)
            throw new Error('transfer is not availalbe here')
        if(!isZero(args[0]))
            throw new Error('transfer: unexpected')
        let amount = <bigint> this.wai.peek(args[2], ABI_DATA_TYPE.u256)
        let to = <ArrayBuffer> this.wai.peek(args[1], ABI_DATA_TYPE.address)
        this.world.subBalance(this.ctx.contractAddress, amount)
        this.world.addBalance(to, amount)
    }

    name(): string {
        return '_transfer'
    }

}
