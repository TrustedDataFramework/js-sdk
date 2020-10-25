import BN = require("./bn")

export type Digital = string | number | BN
export type Binary = string | Uint8Array | ArrayBuffer
export type Readable = string | number | boolean
export type AbiInput = string | number | boolean | ArrayBuffer | Uint8Array | BN
export type RLPElement = Uint8Array | Uint8Array[]

export enum TX_STATUS {
    PENDING,
    INCLUDED,
    CONFIRMED,
    DROPPED
}

export const constants = {
    POA_VERSION: 1634693120,
    POW_VERSION: 7368567,
    POS_VERSION: 7368563,
    COINBASE: 0,
    TRANSFER: 1,
    DEPLOY: 2,
    CONTRACT_CALL: 3,
    PEER_AUTHENTICATION_ADDR: "0000000000000000000000000000000000000003",
    POA_AUTHENTICATION_ADDR: "0000000000000000000000000000000000000004",
    POS_CONTRACT_ADDR: "0000000000000000000000000000000000000005"
}

export const ABI_DATA_TYPE_TABLE: ABI_DATA_TYPE[] = ['bool', 'i64', 'u64', 'f64', 'string', 'bytes', 'address', 'u256']

export type ABI_DATA_TYPE = 'bool' | 'i64' | 'u64' | 'f64' | 'string' | 'bytes' | 'address' | 'u256'

export type ABI_TYPE = 'function' | 'event'


export enum ABI_DATA_ENUM {
    bool,
    i64,
    u64,
    f64,
    string,
    bytes,
    address,
    u256
}

export const MAX_U64 = new BN('ffffffffffffffff', 16)
export const MAX_U256 = new BN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16)
export const MAX_I64 = new BN('9223372036854775807', 10)
export const MIN_I64 = new BN('-9223372036854775808', 10)

export const MAX_SAFE_INTEGER = new BN(Number.MAX_SAFE_INTEGER)
export const MIN_SAFE_INTEGER = new BN(Number.MIN_SAFE_INTEGER)
export const ONE = new BN(1)
export const ZERO = new BN(0)

