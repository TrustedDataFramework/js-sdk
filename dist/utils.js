"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthServer = exports.readKeyStore = exports.createKeyStore = exports.concatBytes = exports.randomBytes = exports.generatePrivateKey = exports.sign = exports.uuidv4 = exports.toSafeInt = exports.convert = exports.bin2str = exports.bin2hex = exports.dig2str = exports.assert = exports.hex2bin = exports.trimLeadingZeros = exports.f64ToBytes = exports.inverse = exports.str2bin = exports.publicKey2Address = exports.privateKey2PublicKey = exports.padPrefix = exports.bytesToF64 = void 0;
var constants_1 = require("./constants");
var BN = require("./bn");
var sm_crypto_1 = require("@salaku/sm-crypto");
var tx_1 = require("./tx");
function bytesToF64(buf) {
    return new Float64Array(padPrefix(reverse(buf), 0, 8).buffer)[0];
}
exports.bytesToF64 = bytesToF64;
/**
 * pad prefix to size
 */
function padPrefix(arr, prefix, size) {
    if (arr.length >= size)
        return arr;
    var ret = new Uint8Array(size);
    for (var i = 0; i < ret.length; i++) {
        ret[i + size - arr.length] = arr[i];
    }
    if (prefix === 0)
        return ret;
    for (var i = 0; i < size - arr.length; i++)
        ret[i] = prefix;
}
exports.padPrefix = padPrefix;
/**
 * 私钥转公钥
 * @param sk 私钥
 */
function privateKey2PublicKey(sk) {
    var s = bin2hex(sk);
    if (s.length / 2 != 32)
        throw new Error('invalid private key, length = ' + s.length / 2);
    return sm_crypto_1.sm2.compress(sm_crypto_1.sm2.getPKFromSK(s));
}
exports.privateKey2PublicKey = privateKey2PublicKey;
/**
 * 公钥转地址
 * @param pk  公钥
 */
function publicKey2Address(pk) {
    var k = hex2bin(pk);
    if (k.length != 33)
        throw new Error('invalid public key size: ' + k.length);
    var buf = hex2bin(sm_crypto_1.sm3(k));
    return bin2hex(buf.slice(buf.length - 20, buf.length));
}
exports.publicKey2Address = publicKey2Address;
/**
 * 字符串 utf8 编码
 * @param str 字符串
 */
function str2bin(str) {
    if (typeof Buffer === 'function')
        return Buffer.from(str, 'utf-8');
    if (typeof TextEncoder === 'function')
        return new TextEncoder().encode(str);
    throw new Error('encode string to utf8 failed');
}
exports.str2bin = str2bin;
/**
 * 对字节数组取反
 * @param arr
 */
function inverse(arr) {
    var ret = new Uint8Array(arr.length);
    for (var i = 0; i < ret.length; i++) {
        ret[i] = (~arr[i] & 0xff);
    }
    return ret;
}
exports.inverse = inverse;
function f64ToBytes(f) {
    var buf = new ArrayBuffer(8);
    var float = new Float64Array(buf);
    float[0] = f;
    var ret = new Uint8Array(buf);
    return trimLeadingZeros(reverse(ret));
}
exports.f64ToBytes = f64ToBytes;
function trimLeadingZeros(data) {
    var k = -1;
    for (var i = 0; i < data.length; i++) {
        if (data[i] !== 0) {
            k = i;
            break;
        }
    }
    if (k === -1)
        return new Uint8Array(0);
    return data.slice(k, data.length);
}
exports.trimLeadingZeros = trimLeadingZeros;
function reverse(arr) {
    var ret = new Uint8Array(arr.length);
    for (var i = 0; i < arr.length; i++) {
        ret[i] = arr[arr.length - i - 1];
    }
    return ret;
}
function hexToInt(x) {
    if (48 <= x && x <= 57)
        return x - 48;
    if (97 <= x && x <= 102)
        return x - 87;
    if (65 <= x && x <= 70)
        return x - 55;
    return 0;
}
/**
 * 解析十六进制字符串
 * decode hex string
 */
function hex2bin(s) {
    if (s instanceof ArrayBuffer)
        return new Uint8Array(s);
    if (s instanceof Uint8Array)
        return s;
    if (s.startsWith('0x'))
        s = s.substr(2, s.length - 2);
    assert(s.length % 2 === 0, 'invalid char');
    var ret = new Uint8Array(s.length / 2);
    for (var i = 0; i < s.length / 2; i++) {
        var h = s.charCodeAt(i * 2);
        var l = s.charCodeAt(i * 2 + 1);
        ret[i] = (hexToInt(h) << 4) + hexToInt(l);
    }
    return ret;
}
exports.hex2bin = hex2bin;
function assert(truth, err) {
    if (!truth)
        throw new Error(err);
}
exports.assert = assert;
function dig2str(s) {
    if (typeof s === 'string') {
        if (s.startsWith('0x'))
            s = new BN(s.substr(2), 16);
        else
            return s;
    }
    return s.toString(10);
}
exports.dig2str = dig2str;
function bin2hex(input) {
    if (typeof input === 'string')
        return input;
    if (!(input instanceof ArrayBuffer) &&
        !(input instanceof Uint8Array) &&
        !Array.isArray(input))
        throw new Error("input " + input + " is not ArrayBuffer Uint8Array or Buffer and other array-like ");
    if (!(input instanceof Uint8Array))
        input = new Uint8Array(input);
    // input maybe Buffer or Uint8Array
    if (typeof Buffer === 'function')
        return Buffer.from(input).toString('hex');
    return Array.prototype.map.call(input, function (x) { return ('00' + x.toString(16)).slice(-2); }).join('');
}
exports.bin2hex = bin2hex;
function bin2str(bin) {
    if (typeof bin === 'string')
        return bin;
    if (typeof TextDecoder === 'function')
        return new TextDecoder().decode(bin);
    if (typeof Buffer === 'function')
        return Buffer.from(bin).toString('utf-8');
    throw new Error('convert binary to string failed');
}
exports.bin2str = bin2str;
// convert before rlp encode
function convert(o, type) {
    if (o instanceof ArrayBuffer)
        o = new Uint8Array(o);
    if (o instanceof Uint8Array) {
        switch (type) {
            case constants_1.ABI_DATA_TYPE.bool:
            case constants_1.ABI_DATA_TYPE.u256:
            case constants_1.ABI_DATA_TYPE.i64:
            case constants_1.ABI_DATA_TYPE.u64:
            case constants_1.ABI_DATA_TYPE.f64: {
                throw new Error('cannot convert uint8 array to u64, u256 or bool');
            }
            case constants_1.ABI_DATA_TYPE.string: {
                throw new Error('cannot convert uint8 array to string');
            }
            case constants_1.ABI_DATA_TYPE.address: {
                assert(o.length === 20, "the length of address is 20 while " + o.length + " found");
                return o;
            }
            case constants_1.ABI_DATA_TYPE.bytes: {
                return o;
            }
        }
        throw new Error("unexpected abi type " + type);
    }
    if (typeof o === 'string') {
        switch (type) {
            case constants_1.ABI_DATA_TYPE.u256:
            case constants_1.ABI_DATA_TYPE.u64: {
                var ret = void 0;
                if (o.substr(0, 2) === '0x') {
                    ret = new BN(o.substr(2, o.length - 2), 16);
                }
                else {
                    ret = new BN(o, 10);
                }
                if (type === constants_1.ABI_DATA_TYPE.u64)
                    assert(ret.cmp(constants_1.MAX_U64) <= 0 && !ret.isNeg(), ret.toString(10) + " overflows u64 " + constants_1.MAX_U64.toString(10));
                if (type === constants_1.ABI_DATA_TYPE.u256)
                    assert(ret.cmp(constants_1.MAX_U256) <= 0 && !ret.isNeg(), ret.toString(10) + " overflows max u256 " + constants_1.MAX_U256.toString(10));
                return ret;
            }
            case constants_1.ABI_DATA_TYPE.i64: {
                var ret = void 0;
                if (o.substr(0, 2) === '0x') {
                    ret = new BN(o.substr(2, o.length - 2), 16);
                }
                else {
                    ret = new BN(o, 10);
                }
                assert(ret.cmp(constants_1.MAX_I64) <= 0, ret.toString(10) + " overflows max i64 " + constants_1.MAX_I64.toString(10));
                assert(ret.cmp(constants_1.MIN_I64) >= 0, ret.toString(10) + " overflows min i64 " + constants_1.MIN_I64.toString(10));
                return ret;
            }
            case constants_1.ABI_DATA_TYPE.f64: {
                var f = parseFloat(o);
                return f64ToBytes(f);
            }
            case constants_1.ABI_DATA_TYPE.string: {
                return o;
            }
            case constants_1.ABI_DATA_TYPE.bool: {
                var l = o.toLowerCase();
                if ('true' === l || '1' === o)
                    return constants_1.ONE;
                if ('false' === l || '0' === o)
                    return constants_1.ZERO;
                throw new Error("convert " + o + " to bool failed, provide true, 1 or false, 0");
            }
            case constants_1.ABI_DATA_TYPE.bytes: {
                return hex2bin(o);
            }
            case constants_1.ABI_DATA_TYPE.address: {
                var a = hex2bin(o);
                assert(a.length === 20, "the length of address is 20 while " + a.length + " found");
                return a;
            }
        }
        throw new Error("unexpected abi type " + type);
    }
    if (typeof o === 'number') {
        switch (type) {
            case constants_1.ABI_DATA_TYPE.u256:
            case constants_1.ABI_DATA_TYPE.u64: {
                if (o < 0 || !Number.isInteger(o))
                    throw new Error('o is negative or not a integer');
                return new BN(o);
            }
            case constants_1.ABI_DATA_TYPE.string: {
                return o.toString(10);
            }
            case constants_1.ABI_DATA_TYPE.bool: {
                if (1 === o || 0 === o)
                    return new BN(o);
                throw new Error("convert " + o + " to bool failed, provide 1 or 0");
            }
            case constants_1.ABI_DATA_TYPE.bytes:
            case constants_1.ABI_DATA_TYPE.address: {
                throw new Error("cannot convert number to address or bytes");
            }
            case constants_1.ABI_DATA_TYPE.i64: {
                if (!Number.isInteger(o))
                    throw new Error('o is negative or not a integer');
                if (o >= 0)
                    return new BN(o);
                return convert(new BN(o), constants_1.ABI_DATA_TYPE.i64);
            }
            case constants_1.ABI_DATA_TYPE.f64: {
                return f64ToBytes(o);
            }
        }
        throw new Error("unexpected abi type " + type);
    }
    if (o instanceof BN) {
        switch (type) {
            case constants_1.ABI_DATA_TYPE.u256:
            case constants_1.ABI_DATA_TYPE.u64: {
                return o;
            }
            case constants_1.ABI_DATA_TYPE.string: {
                return o.toString(10);
            }
            case constants_1.ABI_DATA_TYPE.bytes:
            case constants_1.ABI_DATA_TYPE.address: {
                throw new Error("cannot convert big number to address or bytes");
            }
            case constants_1.ABI_DATA_TYPE.bool: {
                if (o.cmp(constants_1.ZERO) === 0 || o.cmp(constants_1.ONE) === 0)
                    return o;
                throw new Error("convert " + o + " to bool failed, provide 1 or 0");
            }
            case constants_1.ABI_DATA_TYPE.i64: {
                assert(o.cmp(constants_1.MAX_I64) <= 0, o.toString(10) + " overflows max i64 " + constants_1.MAX_I64.toString(10));
                assert(o.cmp(constants_1.MIN_I64) >= 0, o.toString(10) + " overflows min i64 " + constants_1.MIN_I64.toString(10));
                if (o.cmp(constants_1.ZERO) >= 0)
                    return o;
                var buf = o.neg().toArrayLike(Uint8Array);
                buf = inverse(buf);
                return new BN(buf).add(constants_1.ONE);
            }
            case constants_1.ABI_DATA_TYPE.f64: {
                return f64ToBytes(o.toNumber());
            }
        }
        throw new Error("unexpected abi type " + type);
    }
    if (typeof o === 'boolean') {
        switch (type) {
            case constants_1.ABI_DATA_TYPE.u256:
            case constants_1.ABI_DATA_TYPE.i64:
            case constants_1.ABI_DATA_TYPE.bool:
            case constants_1.ABI_DATA_TYPE.u64: {
                return o ? constants_1.ONE : constants_1.ZERO;
            }
            case constants_1.ABI_DATA_TYPE.string: {
                return o ? 'true' : 'false';
            }
            case constants_1.ABI_DATA_TYPE.bytes:
            case constants_1.ABI_DATA_TYPE.address: {
                throw new Error("cannot convert boolean to address or bytes");
            }
            case constants_1.ABI_DATA_TYPE.f64: {
                return f64ToBytes(o ? 1 : 0);
            }
        }
        throw new Error("unexpected abi type " + type);
    }
    throw new Error("unexpected type " + o);
}
exports.convert = convert;
function toSafeInt(x) {
    var bn;
    if (typeof x === 'number')
        return x;
    if (typeof x === 'string') {
        var hex = x.startsWith('0x');
        x = hex ? x.substr(2, x.length - 2) : x;
        bn = new BN(x, hex ? 16 : 10);
    }
    if (x instanceof ArrayBuffer || x instanceof Uint8Array) {
        var arr = x instanceof ArrayBuffer ? new Uint8Array(x) : x;
        bn = new BN(arr);
    }
    if (x instanceof BN)
        bn = x;
    if (bn.cmp(constants_1.MAX_SAFE_INTEGER) <= 0 && bn.cmp(constants_1.MIN_SAFE_INTEGER) >= 0)
        return bn.toNumber();
    return x.toString(10);
}
exports.toSafeInt = toSafeInt;
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
exports.uuidv4 = uuidv4;
function sign(tx, sk) {
    var t = tx_1.Transaction.clone(tx);
    t.sign(sk);
    tx.signature = t.signature;
    return tx;
}
exports.sign = sign;
/**
 * 生成私钥
 */
function generatePrivateKey() {
    return (sm_crypto_1.sm2.generateKeyPairHex()).privateKey;
}
exports.generatePrivateKey = generatePrivateKey;
/**
 * 随机生成字节数组 Uint8Array
 */
function randomBytes(length) {
    if (typeof crypto === 'object') {
        var ret = new Uint8Array(length);
        window.crypto.getRandomValues(ret);
        return ret;
    }
    var crypt = require('crypto');
    return crypt.randomBytes(length);
}
exports.randomBytes = randomBytes;
function concatBytes(x, y) {
    var ret = new Uint8Array(x.length + y.length);
    for (var i = 0; i < x.length; i++) {
        ret[i] = x[i];
    }
    for (var i = 0; i < y.length; i++) {
        ret[x.length + i] = y[i];
    }
    return ret;
}
exports.concatBytes = concatBytes;
/**
 * 生成 keystore
 */
function createKeyStore(password, privateKey) {
    if (!privateKey)
        privateKey = generatePrivateKey();
    var _priv = hex2bin(privateKey);
    var ret = {
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
    };
    var salt = randomBytes(32);
    var iv = randomBytes(16);
    ret.publicKey = privateKey2PublicKey(_priv);
    ret.crypto.iv = bin2hex(iv);
    ret.crypto.salt = bin2hex(salt);
    ret.id = uuidv4();
    var key = hex2bin(sm_crypto_1.sm3(concatBytes(salt, str2bin(password))));
    key = key.slice(0, 16);
    var cipherText = sm_crypto_1.sm4.encrypt(_priv, key);
    cipherText = new Uint8Array(cipherText);
    ret.crypto.cipherText = bin2hex(cipherText);
    ret.mac = sm_crypto_1.sm3(concatBytes(key, cipherText));
    ret.address = publicKey2Address(ret.publicKey);
    return ret;
}
exports.createKeyStore = createKeyStore;
function readKeyStore(ks, password) {
    if (!ks.crypto.cipher || "sm4-128-ecb" !== ks.crypto.cipher) {
        throw new Error("unsupported crypto cipher " + ks.crypto.cipher);
    }
    var buf = concatBytes(hex2bin(ks.crypto.salt), str2bin(password));
    var key = sm_crypto_1.sm3(buf);
    var cipherPrivKey = hex2bin(ks.crypto.cipherText);
    var decrypted = sm_crypto_1.sm4.decrypt(cipherPrivKey, hex2bin(key));
    return bin2hex(decrypted);
}
exports.readKeyStore = readKeyStore;
/**
 * 认证服务器
 */
function createAuthServer(privateKey, whiteList) {
    var URL = require('url');
    var http = require('http');
    var server = http.createServer();
    server.on('request', function (request, response) {
        var otherPublicKey = URL.parse(request.url, true).query['publicKey'];
        if (whiteList && whiteList.length) {
            var exists = whiteList.map(function (x) { return bin2hex(x) === otherPublicKey; })
                .reduce(function (x, y) { return x || y; }, false);
            if (!exists)
                throw new Error("invalid public key, not in white list " + otherPublicKey);
        }
        // 对公钥进行解压缩
        if (otherPublicKey.substr(0, 2) !== '04') {
            otherPublicKey = sm_crypto_1.sm2.deCompress(otherPublicKey);
        }
        // 生成密文
        var ret = {
            publicKey: privateKey2PublicKey(privateKey),
            cipherText: sm_crypto_1.sm2.doEncrypt(hex2bin(privateKey), otherPublicKey, sm_crypto_1.sm2.C1C2C3)
        };
        response.write(JSON.stringify(ret));
        response.end();
    });
    return server;
}
exports.createAuthServer = createAuthServer;
