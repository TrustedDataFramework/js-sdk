/// <reference types="node" />
import { AbiInput, Binary, Digital } from "./constants";
import { ABI_DATA_TYPE } from './constants';
import BN = require('./bn');
import Dict = NodeJS.Dict;
import { Server } from "http";
export declare function bytesToF64(buf: Uint8Array): number;
/**
 * pad prefix to size
 */
export declare function padPrefix(arr: Uint8Array, prefix: number, size: number): Uint8Array;
/**
 * 私钥转公钥
 * @param sk 私钥
 */
export declare function privateKey2PublicKey(sk: Binary): string;
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
 */
export declare function hex2bin(s: string | ArrayBuffer | Uint8Array): Uint8Array;
export declare function assert(truth: any, err: string): void;
export declare function dig2str(s: Digital): string;
export declare function bin2hex(input: Binary | number[]): string;
export declare function bin2str(bin: Uint8Array | ArrayBuffer | string): string;
export declare function convert(o: string | Uint8Array | number | BN | ArrayBuffer | boolean, type: ABI_DATA_TYPE): Uint8Array | string | BN;
export declare function toSafeInt(x: string | number | BN | ArrayBuffer | Uint8Array): string | number;
export declare function uuidv4(): string;
export declare function sign(tx: Dict<AbiInput>, sk: Binary): Object;
/**
 * 生成私钥
 */
export declare function generatePrivateKey(): string;
export interface KeyStore {
    publicKey: string;
    crypto: {
        cipher: string;
        cipherText: string;
        iv: string;
        salt: string;
    };
    id: string;
    version: string;
    mac: string;
    kdf: string;
    address: string;
}
/**
 * 随机生成字节数组 Uint8Array
 */
export declare function randomBytes(length: number): Uint8Array;
export declare function concatBytes(x: Uint8Array, y: Uint8Array): Uint8Array;
/**
 * 生成 keystore
 */
export declare function createKeyStore(password: string, privateKey?: Binary): KeyStore;
export declare function readKeyStore(ks: KeyStore, password: string): string;
/**
 * 认证服务器
 */
export declare function createAuthServer(privateKey: Binary, whiteList: Binary[]): Server;
