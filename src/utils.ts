import { AbiInput, Binary, Digital } from "./constants"
import { ABI_DATA_TYPE, MAX_I64, MIN_I64, MAX_U64, MAX_U256, MAX_SAFE_INTEGER, MIN_SAFE_INTEGER, ONE, ZERO } from './constants'
import { sm2, sm3, sm4 } from '@salaku/sm-crypto'
import { Transaction } from "./tx"
import { Server } from 'http'

const UTF8Decoder =  new TextDecoder('utf-8')

/**
 * 将有符号整数转成 64 bit 位码，负数会被当作补码处理
 * @param i 
 */
export function i64ToLong(i: number | bigint): bigint{
    if(i >= 0)
        return BigInt(i)
    // 计算补码的过程:    
    // 1. 计算对应的正整数的位码
    // 2. 取反
    // 3. 加上1
    let buf = inverse(encodeBE(-i, 64))
    return decodeBE(buf) + ONE
}

/**
 * 把 64 bit 位码转回浮点数
 * @param buf 
 */
export function bytesToF64(buf: Uint8Array): number {
    return new Float64Array(padPrefix(reverse(buf), 0, 8).buffer)[0]
}

/**
 * 在字节数组前面补充 n 个字节，直到长度大于等于 size
 * @param arr 字节数组
 * @param prefix 补充的字节的值 (0 ~ 255)
 * @param size 
 */
export function padPrefix(arr: Uint8Array, prefix: number, size: number) {
    if(prefix < 0 || prefix > 255)
        throw new Error(`invalid byte ${prefix}, should between 0 and 255`)
    if (arr.length >= size)
        return arr
    const ret = new Uint8Array(size)
    for (let i = 0; i < ret.length; i++) {
        ret[i + size - arr.length] = arr[i]
    }
    if (prefix === 0)
        return ret
    for (let i = 0; i < size - arr.length; i++)
        ret[i] = prefix
}


/**
 * 私钥转公钥
 * @param sk 私钥
 */
export function privateKey2PublicKey(sk: Binary): string {
    let s = bin2hex(sk)
    if (s.length / 2 != 32)
        throw new Error('invalid private key, length = ' + s.length / 2)
    return sm2.compress(sm2.getPKFromSK(s))
}

/**
 * 公钥转地址
 * @param pk  公钥
 */
export function publicKey2Address(pk: Binary): string {
    let k = hex2bin(pk)
    if (k.length != 33)
        throw new Error('invalid public key size: ' + k.length)

    const buf = hex2bin(sm3(k))
    return bin2hex(buf.slice(buf.length - 20, buf.length))
}

/**
 * 字符串 utf8 编码
 * @param str 字符串
 */
export function str2bin(str: string): Uint8Array {
    if (typeof Buffer === 'function')
        return Buffer.from(str, 'utf-8')
    if (typeof TextEncoder === 'function')
        return new TextEncoder().encode(str)
    throw new Error('encode string to utf8 failed')
}

/**
 * 对字节数组取反, 用于计算补码
 * @param arr
 */
export function inverse(arr: Uint8Array): Uint8Array {
    const ret = new Uint8Array(arr.length)
    for (let i = 0; i < ret.length; i++) {
        ret[i] = (~arr[i] & 0xff)
    }
    return ret
}

/**
 * 取出浮点数的位码，用8位长整数表示
 * @param f 
 */
export function f64ToLong(f: number): bigint {
    let buf = new ArrayBuffer(8)
    let v = new DataView(buf)
    v.setFloat64(0, f, false)
    let ret = new Uint8Array(buf)
    return decodeBE(ret)
}

/**
 * 解析浮点数的位码，转回浮点数
 * @param f 
 */
export function Long2F64(f: bigint): number {
    let buf = new ArrayBuffer(8)
    let v = new DataView(buf)
    v.setBigUint64(0, f, false)
    return new DataView(buf).getFloat64(0, false)
}

/**
 * 去掉字节数组的前缀0
 * @param data 
 */
export function trimLeadingZeros(data: Uint8Array): Uint8Array {
    let k = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i] !== 0) {
            k = i;
            break;
        }
    }
    if (k === -1)
        return new Uint8Array(0)
    return data.slice(k, data.length)
}

function reverse(arr: Uint8Array): Uint8Array {
    const ret = new Uint8Array(arr.length)
    for (let i = 0; i < arr.length; i++) {
        ret[i] = arr[arr.length - i - 1]
    }
    return ret
}

function hexToInt(x: number): number {
    if (48 <= x && x <= 57) return x - 48
    if (97 <= x && x <= 102) return x - 87
    if (65 <= x && x <= 70) return x - 55
    return 0
}

/**
 * 解析十六进制字符串
 * decode hex string
 */
export function hex2bin(s: string | ArrayBuffer | Uint8Array): Uint8Array {
    if (s instanceof ArrayBuffer)
        return new Uint8Array(s)
    if (s instanceof Uint8Array)
        return s
    if (s.startsWith('0x'))
        s = s.substr(2, s.length - 2)
    if(typeof Buffer === 'function' && typeof s === 'string')
        return Buffer.from(s, 'hex')   
    assert(s.length % 2 === 0, 'invalid char');
    const ret = new Uint8Array(s.length / 2);
    for (let i = 0; i < s.length / 2; i++) {
        const h = s.charCodeAt(i * 2);
        const l = s.charCodeAt(i * 2 + 1);
        ret[i] = (hexToInt(h) << 4) + hexToInt(l);
    }
    return ret
}


export function assert(truth: any, err: string) {
    if (!truth)
        throw new Error(err)
}

/**
 * 整数量转成字符串
 * @param s 
 */
export function dig2str(s: Digital): string {
    return BigInt(s).toString()
}

export function normalizeAddress(addr: Binary): string{
    let b = hex2bin(addr)
    // private key
    if(b.length === 32)
        return publicKey2Address(privateKey2PublicKey(addr))
    // public key
    if(b.length === 33)
        return publicKey2Address(addr)
    if(b.length === 20)
        return bin2hex(b)
    throw new Error(`normalize address failed: invalid length = ${b.length}`)
}

/**
 * 对二进制流进行十六进制编码
 * @param input 
 */
export function bin2hex(input: Binary | number[]): string {
    if (typeof input === 'string')
        return input
    if (
        !(input instanceof ArrayBuffer) &&
        !(input instanceof Uint8Array) &&
        !Array.isArray(input)
    )
        throw new Error("input " + input + " is not ArrayBuffer Uint8Array or Buffer and other array-like ")
    if (!(input instanceof Uint8Array))
        input = new Uint8Array(input)
    // input maybe Buffer or Uint8Array
    if (typeof Buffer === 'function')
        return Buffer.from(input).toString('hex')
    return Array.prototype.map.call(input, x => ('00' + x.toString(16)).slice(-2)).join('');
}

/**
 * 将二进制流转成字符串, UTF8 编码
 * @param bin 
 */
export function bin2str(bin: Uint8Array | ArrayBuffer | string): string{
    if(typeof bin === 'string')
        return bin
    return UTF8Decoder.decode(bin)
}

/**
 * 将合约调用参数转换成可以接近合约类型，而且可以用于 rlp 编码的格式
 * @param o 
 * @param type 
 */
export function convert(o: string | Uint8Array | number | ArrayBuffer | boolean | bigint, type: ABI_DATA_TYPE): Uint8Array | string | bigint | number{
    if (o instanceof ArrayBuffer)
        o = new Uint8Array(o)
    if (o instanceof Uint8Array) {
        // 二进制格式的参数只能用于转换成地址或者字节
        switch (type) {
            case ABI_DATA_TYPE.bool:
            case ABI_DATA_TYPE.u256:
            case ABI_DATA_TYPE.i64:
            case ABI_DATA_TYPE.u64:
            case ABI_DATA_TYPE.f64: {
                // 无法转换
                throw new Error('cannot convert uint8 array to u64, u256 or bool')
            }
            case ABI_DATA_TYPE.string: {
                throw new Error('cannot convert uint8 array to string')
            }
            case ABI_DATA_TYPE.address: {
                assert(o.length === 20, `the length of address is 20 while ${o.length} found`)
                return o
            }
            case ABI_DATA_TYPE.bytes: {
                return o
            }
        }
    }

    if (typeof o === 'string') {
        switch (type) {
            case ABI_DATA_TYPE.i64:
            case ABI_DATA_TYPE.u256:
            case ABI_DATA_TYPE.u64: {
                let ret = toBigN(o)
                // string 转成 bigint 后再转 u256/u64/i64
                return convert(ret, type)
            }
            case ABI_DATA_TYPE.f64: {
                // 浮点数转换成 64 bit 位码
                let f = parseFloat(o)
                return f64ToLong(f)
            }
            case ABI_DATA_TYPE.string: {
                return o
            }
            case ABI_DATA_TYPE.bool: {
                let l = o.toLowerCase()
                if ('true' === l || '1' === o)
                    return ONE
                if ('false' === l || '0' === o)
                    return ZERO
                throw new Error(`convert ${o} to bool failed, provide true, 1 or false, 0`)
            }
            case ABI_DATA_TYPE.bytes: {
                return hex2bin(o)
            }
            case ABI_DATA_TYPE.address: {
                let a = hex2bin(o)
                assert(a.length === 20, `the length of address is 20 while ${a.length} found`)
                return a
            }
        }
    }

    if (typeof o === 'number') {
        switch (type) {
            case ABI_DATA_TYPE.u256:
            case ABI_DATA_TYPE.u64: {
                if (o < 0 || !Number.isInteger(o))
                    throw new Error(`${o} is negative or not a integer`)
                return o
            }
            case ABI_DATA_TYPE.string: {
                return o.toString(10)
            }
            case ABI_DATA_TYPE.bool: {
                if (1 === o || 0 === o)
                    return o
                throw new Error(`convert ${o} to bool failed, provide 1 or 0`)
            }
            case ABI_DATA_TYPE.bytes:
            case ABI_DATA_TYPE.address: {
                throw new Error("cannot convert number to address or bytes")
            }
            case ABI_DATA_TYPE.i64: {
                if (!Number.isInteger(o))
                    throw new Error('o is negative or not a integer')
                if (o >= 0)
                    return o
                // 转成 bigint 再转 i64
                return convert(BigInt(o), ABI_DATA_TYPE.i64)
            }
            case ABI_DATA_TYPE.f64: {
                // number 在 js 中就是双精度浮点数
                return f64ToLong(o)
            }
        }
    }

    if (typeof o === 'bigint') {
        switch (type) {
            case ABI_DATA_TYPE.u256:
            case ABI_DATA_TYPE.u64: {
                // 64位无符号 和 256 位无符号整数必须大于0，而且不能溢出
                if (type === ABI_DATA_TYPE.u64)
                    assert(o <= MAX_U64 && o >= 0, `${o.toString(10)} overflows u64 ${MAX_U64.toString(10)}`)
                if (type === ABI_DATA_TYPE.u256)
                    assert(o <= MAX_U256 && o >= 0, `${o.toString(10)} overflows max u256 ${MAX_U256.toString(10)}`)                
                return o
            }
            case ABI_DATA_TYPE.string: {
                return o.toString(10)
            }
            case ABI_DATA_TYPE.bytes:
            case ABI_DATA_TYPE.address: {
                throw new Error("cannot convert number to address or bytes")
            }
            case ABI_DATA_TYPE.bool: {
                if (o == BigInt(0) || o == BigInt(1))
                    return o
                throw new Error(`convert ${o} to bool failed, provide 1 or 0`)
            }
            case ABI_DATA_TYPE.i64: {
                assert(o <= MAX_I64, `${o.toString(10)} overflows max i64 ${MAX_I64.toString(10)}`)
                assert(o >= MIN_I64, `${o.toString(10)} overflows min i64 ${MIN_I64.toString(10)}`)
                if (o >= 0)
                    return o
                return i64ToLong(o)
            }
            case ABI_DATA_TYPE.f64: {
                // 大整数转 float 可能会丢失精度
                if( o < MIN_SAFE_INTEGER || o > MAX_SAFE_INTEGER){
                    throw new Error(`cast bigint ${o} to float will lose precision`)
                }
                console.warn(`cast bigint ${o} to float may lose precision, you should always avoid it`)
                return f64ToLong(Number(o))
            }
        }
    }

    if (typeof o === 'boolean') {
        switch (type) {
            case ABI_DATA_TYPE.u256:
            case ABI_DATA_TYPE.i64:
            case ABI_DATA_TYPE.bool:
            case ABI_DATA_TYPE.u64: {
                return o ? ONE : ZERO;
            }
            case ABI_DATA_TYPE.string: {
                return o ? 'true' : 'false'
            }
            case ABI_DATA_TYPE.bytes:
            case ABI_DATA_TYPE.address: {
                throw new Error("cannot convert boolean to address or bytes")
            }
            case ABI_DATA_TYPE.f64: {
                return f64ToLong(o ? 1 : 0)
            }
        }
    }
    throw new Error("unexpected type " + o)
}

/**
 * 大端解码, 返回无符号大整数
 * @param x 
 */
export function decodeBE(x: ArrayBuffer | Uint8Array): bigint{
    if(x instanceof Uint8Array && x.length === 0)
        return ZERO
    if(x instanceof ArrayBuffer && x.byteLength === 0)
        return ZERO
    return BigInt('0x' + bin2hex(x))
}


/**
 * 对整数进行大端编码, bits 指定位数, bits 必须是 8 的倍数，负数需要计算补码
 * @param x 
 * @param bits 
 */
export function encodeBE(x: number | BigInt, bits?: number): Uint8Array{
    if(x === 0 || x === ZERO)
        return new Uint8Array(0)
    let str = x.toString(16)
    str = str.length % 2 === 0 ? str : '0' + str
    let arr = hex2bin(str)
    if(bits === undefined)
        return arr
    let bytes = bits / 8
    if(Number.isInteger(bytes) && bytes < 0)
        throw new Error(`invalid bits number ${bits}, should be positive and `)
    if(arr.length > bytes)
        throw new Error('encode failed, overflow')
    return padPrefix(arr, 0, bytes)
}

/**
 * 转成 js 大整数
 * @param x 十六进制的整数或者字符串 或者大端编码的字节数组
 */
export function toBigN(x: string | number | bigint | ArrayBuffer | Uint8Array ): bigint{
    if(x === undefined || x === null)
        throw new Error(`toSafeInt: expect value while ${x} found`)
    if(typeof x === 'bigint'){
        return x
    }
    if (typeof x === 'number'){
        if(!Number.isInteger(x))
            throw new Error(`convert x to integer failed: ${x} is not integer`)
        return BigInt(x)
    }
    if (typeof x === 'string') {
        return BigInt(x)
    }
    return decodeBE(<any>x)
}

/**
 * 转成 js 安全范围内的整数，避免丢失精度
 * @param x 十六进制的整数或者字符串 或者大端编码的字节数组
 */
export function toSafeInt(x: string | number | bigint | ArrayBuffer | Uint8Array ): bigint | number {
    let i = toBigN(x)
    if(i < MIN_SAFE_INTEGER ||  i > MAX_SAFE_INTEGER){
        return i
    }
    return Number(i)
}

/**
 * 转成 js 安全范围内的整数字符串，避免丢失精度
 * @param x 十六进制的整数或者字符串 或者大端编码的字节数组
 */
export function toSafeDig(x: string | number | bigint | ArrayBuffer | Uint8Array ): string | number {
    let i = toBigN(x)
    if(i < MAX_SAFE_INTEGER ||  i > MAX_SAFE_INTEGER)
        return i.toString()
    return Number(i)
}


/**
 * 生成随机 uuid
 */
export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 用私钥对事务进行签名
 * @param tx  事务
 * @param sk 私钥
 */
export function sign(tx: Record<string, AbiInput>, sk: Binary): Transaction {
    const t = Transaction.clone(tx)
    t.sign(sk)
    return t
}

/**
 * 生成私钥
 */
export function generatePrivateKey(): string {
    return (sm2.generateKeyPairHex()).privateKey
}

export interface KeyStore {
    publicKey: string
    crypto: {
        cipher: string
        cipherText: string
        iv: string
        salt: string
    }
    id: string
    version: string
    mac: string
    kdf: string
    address: string
}

/**
 * 随机生成字节数组 Uint8Array
 */
export function randomBytes(length: number): Uint8Array {
    if (typeof crypto === 'object') {
        const ret = new Uint8Array(length)
        window.crypto.getRandomValues(ret)
        return ret
    }

    let crypt = require('crypto')
    return crypt.randomBytes(length)
}


export function concatBytes(x: Uint8Array, y: Uint8Array): Uint8Array {
    const ret = new Uint8Array(x.length + y.length);
    for (let i = 0; i < x.length; i++) {
        ret[i] = x[i]
    }
    for (let i = 0; i < y.length; i++) {
        ret[x.length + i] = y[i]
    }
    return ret
}

/**
 * 生成 keystore
 */
export function createKeyStore(password: string, privateKey?: Binary): KeyStore {
    if (!privateKey)
        privateKey = generatePrivateKey()

    let _priv = hex2bin(privateKey)

    const ret: KeyStore = {
        publicKey: '',
        crypto: {
            cipher: "sm4-128-ecb",
            cipherText: '',
            iv: '',
            salt: ''
        },
        id: '',
        version: "1",
        mac: "",
        kdf: "sm2-kdf",
        address: ''
    }

    const salt = randomBytes(32)
    const iv = randomBytes(16)
    ret.publicKey = privateKey2PublicKey(_priv)
    ret.crypto.iv = bin2hex(iv)
    ret.crypto.salt = bin2hex(salt)
    ret.id = uuidv4()

    let key = hex2bin(
        sm3(
            concatBytes(salt, str2bin(password))
        )
    )

    key = key.slice(0, 16)

    let cipherText = sm4.encrypt(
        _priv, key
    )

    cipherText = new Uint8Array(cipherText)

    ret.crypto.cipherText = bin2hex(cipherText)
    ret.mac = sm3(concatBytes(key, cipherText))
    ret.address = publicKey2Address(ret.publicKey)
    return ret
}


export function readKeyStore(ks: KeyStore, password: string): string {
    // validate password
    let salt = hex2bin(ks.crypto.salt)
    let k = hex2bin(
        sm3(
            concatBytes(salt, str2bin(password))
        )
    )
    k = k.slice(0, 16)
    let mac = sm3(concatBytes(k, hex2bin(ks.crypto.cipherText)))
    if(mac !== ks.mac)
        throw new Error('read private from keystore failed: incorrect password')
    if (!ks.crypto.cipher || "sm4-128-ecb" !== ks.crypto.cipher) {
        throw new Error("unsupported crypto cipher " + ks.crypto.cipher);
    }
    let buf = concatBytes(hex2bin(ks.crypto.salt), str2bin(password));
    const key = sm3(buf)
    const cipherPrivKey = hex2bin(ks.crypto.cipherText)

    let decrypted = sm4.decrypt(cipherPrivKey, hex2bin(key))
    return bin2hex(decrypted)
}


/**
 * 认证服务器
 */
export function createAuthServer(privateKey: Binary, whiteList: Binary[]): Server {
    const URL = require('url');
    const http = require('http')
    const server = http.createServer()

    server.on('request', function (request, response) {

        let otherPublicKey = URL.parse(request.url, true).query['publicKey']
        if (whiteList && whiteList.length) {
            const exists = whiteList.map(x => bin2hex(x) === otherPublicKey)
                .reduce((x, y) => x || y, false)
            if (!exists)
                throw new Error(`invalid public key, not in white list ${otherPublicKey}`)
        }

        // 对公钥进行解压缩
        if (otherPublicKey.substr(0, 2) !== '04') {
            otherPublicKey = sm2.deCompress(otherPublicKey)
        }

        // 生成密文
        const ret = {
            publicKey: privateKey2PublicKey(privateKey),
            cipherText: sm2.doEncrypt(hex2bin(privateKey), otherPublicKey, sm2.C1C2C3)
        }

        response.write(JSON.stringify(ret))
        response.end()

    })
    return server
}