import { assert, bin2hex, bin2str, bytesToF64, convert, hex2bin, inverse, padPrefix, toSafeInt, concatBytes, str2bin, decodeBE } from "./utils";
import {
    ABI_DATA_TYPE,
    ABI_TYPE,
    AbiInput,
    Binary,
    Digital,
    MAX_U256,
    MAX_U64,
    ONE,
    Readable,
    AbiEncoded
} from "./constants";
import { sm3 } from '@salaku/sm-crypto'
import rlp = require('./rlp');
import { OutputStream } from 'assemblyscript/cli/asc'
import * as path from "path";

class MemoryOutputStream implements OutputStream {
    buf: Uint8Array

    constructor() {
        this.buf = new Uint8Array()
    }

    write(chunk: string | Uint8Array): void {
        if (typeof chunk === 'string')
            this.buf = concatBytes(this.buf, str2bin(chunk))
        else
            this.buf = concatBytes(this.buf, chunk)
    }
}

/**
 * 编译合约得到编译后的二进制流
 * @param ascPath 编译器的路径，一般位于 node_modules/.bin/asc
 * @param src 合约主文件
 * @param opts 可选项
 */
export async function compileContract(ascPath?: string, src?: string, opts?: { debug?: boolean, optimize?: boolean }): Promise<Uint8Array> {
    let abortPath = path.relative(process.cwd(), path.join(__dirname, '../lib/prelude/abort'))
    abortPath = abortPath.replace(/\\/g, '/')
    if (typeof ascPath === 'string' && ascPath.trim() && typeof src === 'string') {
        const child_process = require('child_process')
        // --runtime none 可以取消垃圾回收
        let cmd = ascPath + ' ' + src + ` -b --runtime none --use abort=${abortPath}` // 执行的命令
        if (opts && opts.debug)
            cmd += ' --debug '
        if (opts && opts.optimize)
            cmd += ' --optimize '
        return new Promise((rs, rj) => {
            child_process.exec(
                cmd,
                { encoding: 'buffer' },
                (err, stdout, stderr) => {
                    if (err) {
                        // err.code 是进程退出时的 exit code，非 0 都被认为错误
                        // err.signal 是结束进程时发送给它的信号值
                        rj(err + ' ')
                        process.stderr.write(stderr)
                        return
                    }
                    rs(stdout)
                }
            )
        })
    }
    const asc = require("assemblyscript/cli/asc")
    if (typeof src !== 'string') {
        src = ascPath
    }
    if (typeof src !== 'string')
        throw new Error('invalid source file ' + src)
    const arr = [
        src,
        "-b",
        '--runtime',
        'none',
        '--use',
        `abort=${abortPath}`
    ]
    const stdout = new MemoryOutputStream()
    const stderr = new MemoryOutputStream()

    if (opts && opts.debug)
        arr.push('--debug')
    if (opts && opts.optimize)
        arr.push('--optimize')

    await asc.ready
    return new Promise((rs, rj) => {
        asc.main(arr, {
            stdout: stdout,
            stderr: stderr
        }, function (err) {
            if (err) {
                rj(err + ' ' + bin2str(stderr.buf))
                return
            }
            rs(stdout.buf)
        })
    })
}

export class TypeDef {
    type: string
    name?: string
    constructor(type: string, name?: string) {
        if (typeof type === 'string')
            type = type.toLocaleLowerCase()
        assert(ABI_DATA_TYPE[type] !== undefined, `invalid type ${type}`)
        this.type = type
        this.name = name
    }

    static from(o): TypeDef {
        return new TypeDef(o.type, o.name)
    }
}

export class ABI {
    name: string
    type: ABI_TYPE
    inputs: TypeDef[]
    outputs: TypeDef[]

    constructor(name: string, type: ABI_TYPE, inputs?: TypeDef[], outputs?: TypeDef[]) {
        assert(name, 'expect name of abi')
        assert(type === 'function' || type === 'event', `invalid abi type ${type}`)
        assert(!inputs || Array.isArray(inputs), `invalid inputs ${inputs}`)
        assert(!outputs || Array.isArray(outputs), `invalid inputs ${outputs}`)

        this.name = name
        this.type = type
        this.inputs = (inputs || []).map(TypeDef.from)
        this.outputs = (outputs || []).map(TypeDef.from)
    }

    static from(o: any) {
        return new ABI(o.name, o.type, o.inputs, o.outputs)
    }

    // able to return object instead of array
    returnsObj(): boolean {
        return this.outputs.every(v => v.name) && (
            (new Set(this.outputs.map(v => v.name))).size === this.outputs.length
        )
    }


    // able to input object instead of array
    inputsObj(): boolean {
        return this.inputs.every(v => v.name) && (
            (new Set(this.inputs.map(v => v.name))).size === this.inputs.length
        )
    }

    toObj(arr: AbiInput[], input: boolean): Record<string, AbiInput> {
        const p = input ? this.inputs : this.outputs
        const o = {}
        for (let i = 0; i < p.length; i++) {
            o[p[i].name] = arr[i]
        }
        return o
    }

    toArr(obj: Record<string, AbiInput>, input: boolean): AbiInput[] {
        const p = input ? this.inputs : this.outputs
        const arr = []
        for (let i = 0; i < p.length; i++) {
            arr.push(obj[p[i].name])
        }
        return arr
    }
}

/**
 * 用于处理用户输入的参数可能为空，也可能是单个输入值、数组或者对象的多种情况
 * @param params 
 */
export function normalizeParams(params?: AbiInput | AbiInput[] | Record<string, AbiInput>): AbiInput[] | Record<string, AbiInput> {
    if (params === null || params === undefined)
        return []
    if (typeof params === 'bigint' || typeof params === 'string' || typeof params === 'boolean' || typeof params === 'number' || params instanceof ArrayBuffer || params instanceof Uint8Array)
        return [params]
    return params
}

/**
 * 从服务端返回的二进制内容中解析成可读的 javascript 类型
 * @param outputs abi 中的 outputs 数组，包含了类型，如果 outputs 数组中的每个 TypeDef 的 name 都有值，会返回一个 JSON 对象，否则返回一个数组
 * @param buf 
 */
function abiDecode(outputs: TypeDef[], buf?: Uint8Array[]): Readable[] | Record<string, Readable> {
    buf = buf || []
    const len = buf.length
    if (len === 0)
        return []

    const arr = buf


    const returnObject =
        outputs.every(v => v.name) && (
            (new Set(outputs.map(v => v.name))).size === outputs.length
        )

    if (arr.length != outputs.length)
        throw new Error(`abi decode failed , expect ${outputs.length} returns while ${arr.length} found`)

    const ret = returnObject ? {} : []
    for (let i = 0; i < arr.length; i++) {
        const t = outputs[i].type
        const name = outputs[i].name
        let val: Readable
        switch (t) {
            case 'bytes':
            case 'address': {
                val = bin2hex(arr[i])
                break
            }
            case 'u256':
            case 'u64': {
                const n = decodeBE(arr[i])
                if (t === 'u64')
                    assert(n <= MAX_U64, `${n.toString(10)} overflows max u64 ${MAX_U64.toString(10)}`)
                if (t === 'u256')
                    assert(n <= MAX_U256, `${n.toString(10)} overflows max u256 ${MAX_U256.toString(10)}`)
                val = toSafeInt(n)
                break
            }
            case 'i64': {
                let n: bigint
                const padded = padPrefix(arr[i], 0, 8)
                const isneg = padded[0] & 0x80
                if (!isneg) {
                    n = decodeBE(arr[i])
                } else {
                    n = decodeBE(inverse(padded))
                    n = n + ONE
                    n = - n
                }
                val = toSafeInt(n)
                break
            }
            case 'f64': {
                val = bytesToF64(arr[i])
                break
            }
            case 'string': {
                val = bin2str(arr[i])
                break
            }
            case 'bool': {
                val = arr[i].length > 0
                break
            }
        }
        if (returnObject)
            ret[name] = val
        else
            ret[i] = val
    }
    return ret
}


export class Contract {
    address: string
    abi: ABI[]
    binary: Uint8Array

    constructor(address?: Binary, abi?: any[], binary?: Uint8Array | ArrayBuffer) {
        if (address)
            this.address = bin2hex(address)
        if (abi)
            this.abi = (abi || []).map(ABI.from)
        if (binary)
            this.binary = binary instanceof ArrayBuffer ? new Uint8Array(binary) : binary
    }


    /**
     * abi 编码，将 javascript 输入转换可以被 rlp 编码数组 [输入类型[], 输入[], 输出类型[]]
     * @param name 方法名称
     * @param li 
     */
    abiEncode(name: string, li?: AbiInput | AbiInput[] | Record<string, AbiInput>): AbiEncoded {
        const func = this.getABI(name, 'function')

        // 得到返回类型
        let retType = func.outputs && func.outputs[0] && func.outputs[0].type
        const retTypes = retType ? [ABI_DATA_TYPE[retType]] : []

        if (typeof li === 'string' || typeof li === 'number' || li instanceof ArrayBuffer || li instanceof Uint8Array || typeof li === 'boolean' || typeof li === 'bigint')
            return this.abiEncode(name, [li])

        if (li === undefined || li === null)
            return [[], [], retTypes]


        if (Array.isArray(li)) {
            const arr: Array<string | Uint8Array | bigint | number> = []
            const types = []
            if (li.length != func.inputs.length)
                throw new Error(`abi encode failed for ${func.name}, expect ${func.inputs.length} parameters while ${li.length} found`)
            for (let i = 0; i < li.length; i++) {
                arr[i] = convert(li[i], ABI_DATA_TYPE[func.inputs[i].type])
                types[i] = ABI_DATA_TYPE[func.inputs[i].type]
            }
            return [types, arr, retTypes]
        }

        const arr: Array<string | Uint8Array | bigint | number> = []
        const types = []
        for (let i = 0; i < func.inputs.length; i++) {
            const input = func.inputs[i]
            types[i] = ABI_DATA_TYPE[func.inputs[i].type]
            if (!(input.name in li)) {
                throw new Error(`key ${input.name} not found in parameters`)
            }
            arr[i] = convert(li[input.name], ABI_DATA_TYPE[input.type])
        }
        return [types, arr, retTypes]
    }


    abiDecode(name: string, buf?: Uint8Array[], type?: ABI_TYPE): Readable | Readable[] | Record<string, Readable> {
        type = type || 'function'
        buf = buf || []
        if (buf.length === 0)
            return []

        const a = this.getABI(name, type)
        const ret = abiDecode(a.outputs, buf)
        if (type === 'function')
            return ret && ret[0]
        return ret
    }


    /**
     * 将 abi 转成可以 rlp 编码的格式，用于放到合约部署的 payload 当中
     */
    abiToBinary(): any[] {
        const ret = []
        for (let a of this.abi) {
            ret.push(
                [
                    a.name,
                    a.type === 'function' ? 0 : 1,
                    a.inputs.map(x => ABI_DATA_TYPE[x.type]),
                    a.outputs.map(x => ABI_DATA_TYPE[x.type])
                ]
            )
        }
        return ret
    }

    /**
     * 找到和 名称、类型对应的 abi，有且只有一个
     * @param name 
     * @param type 
     */
    getABI(name: string, type: ABI_TYPE): ABI {
        const funcs = this.abi.filter(x => x.type === type && x.name === name)
        assert(funcs.length === 1, `exact exists one and only one abi ${name}, while found ${funcs.length}`)
        return funcs[0]
    }
}

/**
 * 编译生成 abi JSON 文件
 * @param str 源代码文件的字符串
 */
export function compileABI(str: Binary): ABI[] {
    let s = bin2str(str)

    const TYPES = {
        u64: 'u64',
        i64: 'i64',
        f64: 'f64',
        bool: 'bool',
        string: 'string',
        ArrayBuffer: 'bytes',
        Address: 'address',
        U256: 'u256',
        String: 'string',
        boolean: 'bool'
    }

    function getOutputs(str): TypeDef[] {
        if (str === 'void')
            return []
        const ret = TYPES[str]
        if (!ret)
            throw new Error(`invalid type: ${str}`)
        return [new TypeDef(ret)]
    }

    function getInputs(str, event?: boolean): TypeDef[] {
        const ret = []
        for (let p of str.split(',')) {
            if (!p)
                continue
            const lr = p.split(':')
            let l = lr[0].trim()
            if (event) {
                if (!l.startsWith('readonly'))
                    throw new Error(`event constructor field ${l} should starts with readonly`)
                l = l.split(' ')[1]
            }
            const r = lr[1].trim()
            const o = new TypeDef(
                TYPES[r], l
            )
            if (!o.type)
                throw new Error(`invalid type: ${r}`)
            ret.push(o)
        }
        return ret
    }

    const ret = []
    let funRe = /export[\s\n\t]+function[\s\n\t]+([a-zA-Z_][a-zA-Z0-9_]*)[\s\n\t]*\(([a-z\n\s\tA-Z0-9_,:]*)\)[\s\n\t]*:[\s\n\t]*([a-zA-Z_][a-zA-Z0-9_]*)[\s\n\t]*{/g
    let eventRe = /@unmanaged[\s\n\t]+class[\s\n\t]+([a-zA-Z_][a-zA-Z0-9]*)[\s\n\t]*\{[\s\n\t]*constructor[\s\n\t]*\(([a-z\n\s\tA-Z0-9_,:]*)\)/g

    for (let m of (s.match(funRe) || [])) {
        funRe.lastIndex = 0
        const r = funRe.exec(m)
        if (r[1].startsWith('__'))
            continue
        ret.push(new ABI(
            r[1],
            'function',
            getInputs(r[2]),
            getOutputs(r[3])
        ))
    }


    for (let m of (s.match(eventRe) || [])) {
        eventRe.lastIndex = 0
        const r = eventRe.exec(m)
        ret.push(new ABI(
            r[1],
            'event',
            [],
            getInputs(r[2], true)
        ))
    }
    return ret
}

/**
 * 生成合约地址
 */
export function getContractAddress(address: Binary, nonce: Digital): string {
    nonce = nonce ? nonce : 0
    let n = convert(nonce, ABI_DATA_TYPE.u256)
    let addr = hex2bin(address)
    if (addr.length !== 20)
        throw new Error(`address length should be 20 while ${addr.length} found`)
    let buf = rlp.encode([addr, n])
    buf = hex2bin(sm3(buf))
    return bin2hex(buf.slice(buf.length - 20, buf.length))
}
