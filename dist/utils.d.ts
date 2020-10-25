import { Binary, Digital } from "./constants";
import { ABI_DATA_ENUM } from './constants';
import BN = require('./bn');
export declare function bytesToF64(buf: Uint8Array): number;
/**
 * pad prefix to size
 */
export declare function padPrefix(arr: Uint8Array, prefix: number, size: number): Uint8Array;
/**
 * 私钥转公钥
 * @param sk 私钥
 */
export declare function privateKey2PublicKey(sk: string | Uint8Array | ArrayBuffer): string;
/**
 * 公钥转地址
 * @param pk  公钥
 */
export declare function publicKey2Address(pk: Binary): string;
/**
 * 字符串 utf8 编码
 * @param str 字符串
 */
export declare function str2bin(str: string): Uint8Array;
/**
 * 对字节数组取反
 * @param arr
 */
export declare function inverse(arr: Uint8Array): Uint8Array;
export declare function f64ToBytes(f: number): Uint8Array;
export declare function trimLeadingZeros(data: Uint8Array): Uint8Array;
/**
 * 解析十六进制字符串
 * decode hex string
 * @param {string | ArrayBuffer | Uint8Array} s
 * @returns {Uint8Array}
 */
export declare function hex2bin(s: string | ArrayBuffer | Uint8Array): Uint8Array;
export declare function assert(truth: any, err: string): void;
export declare function dig2str(s: Digital): string;
export declare function bin2hex(input: Binary): string;
export declare function bin2str(bin: Uint8Array | ArrayBuffer | string): string;
export declare function convert(o: string | Uint8Array | number | BN | ArrayBuffer | boolean, type: ABI_DATA_ENUM): Uint8Array | string | BN;
export declare function toSafeInt(x: string | number | BN | ArrayBuffer | Uint8Array): string | number;
export declare function uuidv4(): string;
