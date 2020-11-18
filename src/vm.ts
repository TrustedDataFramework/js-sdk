import { normalizeAddress } from "./utils"
import { AbiInput, Binary, Digital } from "./constants"
import { ABI, compileABI, getContractAddress, normalizeParams } from "./contract"
import { TransactionResult } from "./rpc"
import { Abort, Log, Util } from "./hosts"

export function isZero(n: number | bigint): boolean {
    return n === 0 || n === BigInt(0)
}

/**
 * virtual machine for chrome debugging 
 */
export class VirtualMachine {
    // current block height
    height: number

    // current block  hash
    hash: ArrayBuffer

    // contract address -> url
    contractCode: Map<string, string>

    // cache for abi
    abiCache: Map<string, ABI[]>

    nonceMap: Map<string, number>

    constructor() {
        if (typeof WebAssembly !== 'object')
            throw new Error('webassembly not available here')

        this.height = 0
        this.hash = new Uint8Array(32).buffer
        this.contractCode = new Map()
        this.abiCache = new Map()
    }

    // 合约部署
    async deploy(sender: Binary, wasmFile: string, parameters?: AbiInput | AbiInput[] | Record<string, AbiInput>, amount?: Digital): Promise<TransactionResult> {
        parameters = normalizeParams(parameters)
        let senderAddress = normalizeAddress(sender)
        const n = (this.nonceMap.get(senderAddress) || 0) + 1
        const contractAddr = getContractAddress(senderAddress, n)
        const abi = await this.fetchABI(wasmFile)

        // try to execute init function
        if (abi.filter(x => x.type === 'function' && x.name === 'init').length > 0) {
            let mem = new WebAssembly.Memory({ initial: 10, maximum: 1024 })

            const env = {
                memory: mem
            }

            let instance = (await WebAssembly.instantiateStreaming(fetch(wasmFile), {
                env: env
            })).instance

            const hosts = [new Log(this, instance, abi), new Abort(this, instance, abi), new Util(this, instance, abi)]

            hosts.forEach(h => {
                env[h.name()] = h.execute.bind(h)
            })

            if(typeof instance.exports.init === 'function')
                instance.exports.init()
        }

        this.contractCode.set(contractAddr, wasmFile)
        this.nonceMap.set(senderAddress, n)
        return null
    }

    // 根据文件名规范获取 abi
    async fetchABI(wasmFile: string): Promise<ABI[]> {
        let f = wasmFile.replace(/^(.*)\.wasm$/, '$1.abi.json')
        if (this.abiCache.has(f))
            return this.abiCache.get(f)
        const resp = await fetch(f)
        const buf = await resp.arrayBuffer()
        let abi = compileABI(buf)
        this.abiCache.set(f, abi)
        return abi
    }
}