import { hex2bin, str2bin} from "./utils";
import { Binary } from "./constants";
import { Transaction } from "./tx";
import { TransactionResult } from "./rpc";

export abstract class HostFunction{

    mem: Uint8Array

    constructor(mem: Uint8Array) {
    }

    put(offset: number, data: Uint8Array){
        for(let i = 0; i < data.length; i++){
            this.mem[i + offset] = data[i]
        }
    }

    putUTF(offset: number, str: string){
        this.put(offset, str2bin(str))
    }

    putNumber(offset: number, n: number){

    }

    loadUTF(offset: number, length: number){

    }

    abstract execute(...args: number[] | BigInt[] )
}

/**
 * java script virtual machine
 */
export class VirtualMachine {
    buf: Uint8Array
    height: number
    hash: Uint8Array
    mem: Uint8Array
    contractCode: Map<string, Uint8Array>

    constructor(bin: Binary) {
        if(typeof WebAssembly !== 'function')
            throw new Error('')
        this.buf = hex2bin(bin)
        this.height = 1
        this.hash = new Uint8Array(32)
    }

    execute(tx: Transaction): TransactionResult{
        return null
    }
}