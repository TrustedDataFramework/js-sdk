import {isZero, VirtualMachine} from './vm'
import { concatBytes, padPrefix } from "./utils"
import { bin2hex, bin2str, hex2bin, str2bin } from '@salaku/sm-crypto/src/sm2/utils'
import {ABI} from "./contract";


export abstract class HostFunction {
    instance: WebAssembly.Instance
    view: DataView
    world: VirtualMachine
    abi: ABI[]
    utf8Decoder: TextDecoder
    utf16Decoder: TextDecoder

    constructor(world: VirtualMachine, instance: WebAssembly.Instance, abi: ABI[]) {
        this.instance = instance
        this.world = world
        this.abi = abi
        this.view = new DataView(this.memory)
        this.utf8Decoder = new TextDecoder('utf-8')
        this.utf16Decoder = new TextDecoder('utf-16')
    }

    get memory(): ArrayBuffer {
        const mem = <WebAssembly.Memory>this.instance.exports.memory
        return mem.buffer
    }

    abstract execute(...args: (number | bigint)[]): void | number | bigint

    abstract name(): string

    loadUTF8(offset: number | bigint, length: number | bigint): string {
        return this.utf8Decoder.decode(this.loadN(offset, length))
    }

    loadUTF16(offset: number | bigint): string {
        return this.utf16Decoder.decode(this.loadBuffer(Number(offset)))
    }

    loadU32(offset: number | bigint) {
        return this.view.getUint32(Number(offset), true)
    }


    loadBuffer(offset: number | bigint) {
        let len = this.loadU32(Number(offset) - 4)
        return this.loadN(offset, len)
    }

    loadN(offset: number | bigint, length: number | bigint): ArrayBuffer{
        return this.view.buffer.slice(Number(offset), Number(offset) + Number(length))
    }
}


export class Log extends HostFunction {
    name(): string {
        return '_log'
    }

    execute(...args: (number | bigint)[]): void {
        console.log(this.loadUTF8(args[0], args[1]))
    }
}

export class Abort extends HostFunction {
    execute(...args: (number | bigint)[]): void{
        let msg = isZero(args[0]) ? '' : this.loadUTF16(args[0])
        let file = isZero(args[1]) ? '' : this.loadUTF16(args[1])
        throw new Error(`${file} ${msg} error at line ${args[2]} column ${args[3]}`)
    }
    name(): string {
        return 'abort'
    }
}


enum UtilType {
    CONCAT_BYTES,
    DECODE_HEX,
    ENCODE_HEX,
    BYTES_TO_U64,
    U64_TO_BYTES
}

export class Util extends HostFunction{
    execute(...args: bigint[]): bigint {
        let t = Number(args[0])
        let put = !isZero(args[6])
        let data: ArrayBuffer = null
        let ret = BigInt(0)

        switch(t){
            case UtilType.CONCAT_BYTES: {
                let a = this.loadN(args[1], args[2])
                let b = this.loadN(args[3], args[4])
                data = concatBytes(new Uint8Array(a), new Uint8Array(b)).buffer
                ret = BigInt(data.byteLength)
                break
            }
            case UtilType.DECODE_HEX: {
                let a = this.loadN(args[1], args[2])
                let str = bin2str(a)
                data = hex2bin(str).buffer
                ret = BigInt(data.byteLength)
                break
            }
            case UtilType.ENCODE_HEX: {
                let a = this.loadN(args[1], args[2])
                let str = bin2hex(a)
                data = str2bin(str)
                ret = BigInt(data.byteLength)
                break
            }
            case UtilType.BYTES_TO_U64: {
                let a = new Uint8Array(this.loadN(args[1], args[2]))
                let b = padPrefix(a, 0, 8)
                ret = new DataView(b).getBigUint64(0, false)
                break
            }
            case UtilType.U64_TO_BYTES: {
                let u = args[1]
                let d = new DataView(new Uint8Array(8))
                d.setBigUint64(0, u, false)
                break
            }
        }
        if(put){
            
        }
        return ret
    }
    name(): string {
        return '_util'
    }
    
}