import { AbiInput, Binary, Digital } from "./constants"
import { ABI_DATA_TYPE, MAX_I64, MIN_I64, MAX_U64, MAX_U256, MAX_SAFE_INTEGER, MIN_SAFE_INTEGER, ONE, ZERO } from './constants'
import BN = require('./bn')
import { sm2, sm3, sm4 } from '@salaku/sm-crypto'
import { Transaction } from "./tx";
import Dict = NodeJS.Dict;
import { Server } from "http";

export function bytesToF64(buf: Uint8Array): number {
    return new Float64Array(padPrefix(reverse(buf), 0, 8).buffer)[0]
}

/**
 * pad prefix to size
 */
export function padPrefix(arr: Uint8Array, prefix: number, size: number) {
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
 * 对字节数组取反
 * @param arr
 */
export function inverse(arr: Uint8Array): Uint8Array {
    const ret = new Uint8Array(arr.length)
    for (let i = 0; i < ret.length; i++) {
        ret[i] = (~arr[i] & 0xff)
    }
    return ret
}

export function f64ToBytes(f: number): Uint8Array {
    let buf = new ArrayBuffer(8);
    let float = new Float64Array(buf);
    float[0] = f;
    let ret = new Uint8Array(buf)
    return trimLeadingZeros(reverse(ret))
}

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

export function dig2str(s: Digital): string {
    if (typeof s === 'string') {
        if (s.startsWith('0x'))
            s = new BN(s.substr(2), 16)
        else
            return s
    }
    return s.toString(10)
}



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

export function bin2str(bin: Uint8Array | ArrayBuffer | string) {
    if (typeof bin === 'string')
        return bin
    if (typeof TextDecoder === 'function')
        return new TextDecoder().decode(bin)
    if (typeof Buffer === 'function')
        return Buffer.from(bin).toString('utf-8')
    throw new Error('convert binary to string failed')
}

// convert before rlp encode
export function convert(o: string | Uint8Array | number | BN | ArrayBuffer | boolean, type: ABI_DATA_TYPE): Uint8Array | string | BN {
    if (o instanceof ArrayBuffer)
        o = new Uint8Array(o)

    if (o instanceof Uint8Array) {
        switch (type) {
            case ABI_DATA_TYPE.bool:
            case ABI_DATA_TYPE.u256:
            case ABI_DATA_TYPE.i64:
            case ABI_DATA_TYPE.u64:
            case ABI_DATA_TYPE.f64: {
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
        throw new Error("unexpected abi type " + type)
    }

    if (typeof o === 'string') {
        switch (type) {
            case ABI_DATA_TYPE.u256:
            case ABI_DATA_TYPE.u64: {
                let ret: BN
                if (o.substr(0, 2) === '0x') {
                    ret = new BN(o.substr(2, o.length - 2), 16)
                } else {
                    ret = new BN(o, 10)
                }
                if (type === ABI_DATA_TYPE.u64)
                    assert(ret.cmp(MAX_U64) <= 0 && !ret.isNeg(), `${ret.toString(10)} overflows u64 ${MAX_U64.toString(10)}`)
                if (type === ABI_DATA_TYPE.u256)
                    assert(ret.cmp(MAX_U256) <= 0 && !ret.isNeg(), `${ret.toString(10)} overflows max u256 ${MAX_U256.toString(10)}`)
                return ret
            }
            case ABI_DATA_TYPE.i64: {
                let ret: BN
                if (o.substr(0, 2) === '0x') {
                    ret = new BN(o.substr(2, o.length - 2), 16)
                } else {
                    ret = new BN(o, 10)
                }
                assert(ret.cmp(MAX_I64) <= 0, `${ret.toString(10)} overflows max i64 ${MAX_I64.toString(10)}`)
                assert(ret.cmp(MIN_I64) >= 0, `${ret.toString(10)} overflows min i64 ${MIN_I64.toString(10)}`)
                return ret
            }
            case ABI_DATA_TYPE.f64: {
                let f = parseFloat(o)
                return f64ToBytes(f)
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
        throw new Error("unexpected abi type " + type)
    }

    if (typeof o === 'number') {
        switch (type) {
            case ABI_DATA_TYPE.u256:
            case ABI_DATA_TYPE.u64: {
                if (o < 0 || !Number.isInteger(o))
                    throw new Error('o is negative or not a integer')
                return new BN(o)
            }
            case ABI_DATA_TYPE.string: {
                return o.toString(10)
            }
            case ABI_DATA_TYPE.bool: {
                if (1 === o || 0 === o)
                    return new BN(o)
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
                    return new BN(o)
                return convert(new BN(o), ABI_DATA_TYPE.i64)
            }
            case ABI_DATA_TYPE.f64: {
                return f64ToBytes(o)
            }
        }
        throw new Error("unexpected abi type " + type)
    }

    if (o instanceof BN) {
        switch (type) {
            case ABI_DATA_TYPE.u256:
            case ABI_DATA_TYPE.u64: {
                return o;
            }
            case ABI_DATA_TYPE.string: {
                return o.toString(10)
            }
            case ABI_DATA_TYPE.bytes:
            case ABI_DATA_TYPE.address: {
                throw new Error("cannot convert big number to address or bytes")
            }
            case ABI_DATA_TYPE.bool: {
                if (o.cmp(ZERO) === 0 || o.cmp(ONE) === 0)
                    return o
                throw new Error(`convert ${o} to bool failed, provide 1 or 0`)
            }
            case ABI_DATA_TYPE.i64: {
                assert(o.cmp(MAX_I64) <= 0, `${o.toString(10)} overflows max i64 ${MAX_I64.toString(10)}`)
                assert(o.cmp(MIN_I64) >= 0, `${o.toString(10)} overflows min i64 ${MIN_I64.toString(10)}`)
                if (o.cmp(ZERO) >= 0)
                    return o
                let buf = o.neg().toArrayLike(Uint8Array)
                buf = inverse(buf)
                return new BN(buf).add(ONE)
            }
            case ABI_DATA_TYPE.f64: {
                return f64ToBytes(o.toNumber())
            }
        }
        throw new Error("unexpected abi type " + type)
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
                return f64ToBytes(o ? 1 : 0)
            }
        }
        throw new Error("unexpected abi type " + type)
    }
    throw new Error("unexpected type " + o)
}


export function toSafeInt(x: string | number | BN | ArrayBuffer | Uint8Array): string | number {
    let bn: BN
    if (typeof x === 'number')
        return x
    if (typeof x === 'string') {
        const hex = x.startsWith('0x')
        x = hex ? x.substr(2, x.length - 2) : x
        bn = new BN(x, hex ? 16 : 10)
    }
    if (x instanceof ArrayBuffer || x instanceof Uint8Array) {
        let arr = x instanceof ArrayBuffer ? new Uint8Array(x) : x
        bn = new BN(arr)
    }
    if (x instanceof BN)
        bn = x
    if (bn.cmp(MAX_SAFE_INTEGER) <= 0 && bn.cmp(MIN_SAFE_INTEGER) >= 0)
        return bn.toNumber()
    return bn.toString(10)
}

export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function sign(tx: Dict<AbiInput>, sk: Binary): Object {
    const t = Transaction.clone(tx)
    t.sign(sk)
    tx.signature = t.signature
    return tx
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