import { Transaction } from './tx'
import { CallContext } from './vm'
import BN = require('../bn')

let hash: HashAlgorithm = 'sm3'
let ec: EC = 'sm2'

/**
 * 哈希
 */
export function getHashAlgorithm(): HashAlgorithm {
  return hash
}

/**
 * 非对称加密
 */
export function getEC(): EC {
  return ec
}

/**
 * 哈希
 */
export function setHashAlgorithm(h: HashAlgorithm) {
  hash = h
}

/**
 * 非对称加密
 */
export function setEC(e: EC) {
  ec = e
}

export type bigi = bigint | BN

export type HashAlgorithm = 'sm3' | 'keccak-256' | 'sha3-256'

export type EC = 'sm2' | 'ed25519'

/**
 * 整数或者十进制、十六进制表示的整数字符串
 */
export type Digital = string | number | bigi

/**
 * 二进制流 或者 十六进制编码后的二进制流, Nodejs 中的 Buffer 是 Uint8Array 的实现
 */
export type Binary = string | Uint8Array | ArrayBuffer

/**
 * 表示可以被阅读的字面量
 */
export type Readable = string | number | boolean | bigint

/**
 * 表示合法的合约调用参数类型
 */
export type AbiInput =
  | string
  | number
  | boolean
  | ArrayBuffer
  | Uint8Array
  | bigi

export type RLPElement = Uint8Array | Uint8Array[]

/**
 * AbiEncoded 后的结果, 用于调用合约 [输入类型[], 输入[], 输出类型[]]
 */
export type AbiEncoded = [
  ABI_DATA_TYPE[],
  Array<string | Uint8Array | bigi | number>,
  ABI_DATA_TYPE[]
]

/**
 * 事务的状态
 */
export enum TX_STATUS {
  /**
   * 进入了内存池
   */
  PENDING,

  /**
   * 已经被打包进了区块
   */
  INCLUDED,

  /**
   * 已经被确认
   */
  CONFIRMED,

  /**
   * 被丢弃
   */
  DROPPED
}

/**
 * 常量
 */
export const constants = {
  /**
   * POA 共识版本号
   */
  POA_VERSION: 1634693120,

  /**
   * POW 共识版本号
   */
  POW_VERSION: 7368567,

  /**
   * POS 共识的版本号
   */
  POS_VERSION: 7368563,

  /**
   *
   */
  COINBASE: 0,
  TRANSFER: 1,
  DEPLOY: 2,
  CONTRACT_CALL: 3,
  PEER_AUTHENTICATION_ADDR: '0000000000000000000000000000000000000003',
  POA_AUTHENTICATION_ADDR: '0000000000000000000000000000000000000004',
  POS_CONTRACT_ADDR: '0000000000000000000000000000000000000005',
  FARM_BASE_GATEWAY: '0000000000000000000000000000000000000005'
}

export type ABI_TYPE = 'function' | 'event'

export enum ABI_DATA_TYPE {
  bool,
  i64,
  u64,
  f64,
  string,
  bytes,
  address,
  u256
}

export const MAX_U64: bigi =
  typeof BigInt === 'function'
    ? BigInt('0xffffffffffffffff')
    : new BN('ffffffffffffffff', 16)
export const MAX_U256 =
  typeof BigInt === 'function'
    ? BigInt(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      )
    : new BN(
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        16
      )
export const MAX_I64 =
  typeof BigInt === 'function'
    ? BigInt('9223372036854775807')
    : new BN('9223372036854775807')
export const MIN_I64 =
  typeof BigInt === 'function'
    ? BigInt('-9223372036854775808')
    : new BN('-9223372036854775808')

export const MAX_SAFE_INTEGER: bigi =
  typeof BigInt === 'function'
    ? BigInt(Number.MAX_SAFE_INTEGER)
    : new BN(Number.MAX_SAFE_INTEGER)
export const MIN_SAFE_INTEGER: bigi =
  typeof BigInt === 'function'
    ? BigInt(Number.MIN_SAFE_INTEGER)
    : new BN(Number.MIN_SAFE_INTEGER)

export const ONE: bigi = typeof BigInt === 'function' ? BigInt(1) : new BN(1)
export const ZERO: bigi = typeof BigInt === 'function' ? BigInt(0) : new BN(0)

export interface Header {
  stateRoot: string
  version: number
  hash: string
  height: number
  payload: string
  createdAt: Date
  hashPrev: string
  transactionsRoot: string
  size: number
}

export interface Block extends Header {
  body: Transaction[]
}

// 2020-10-25T09:57:15+08:00 2020-10-25T01:57:15Z 2020-10-25T00:57:15-01:00
export const OFFSET_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z?([+-][0-9]{2}:[0-9]{2})?$/

export interface WorkerData {
  lock: Int32Array
  dumped: ArrayBuffer
  method: string
  ctx: CallContext
  params: Readable[]
  ret: ABI_DATA_TYPE[]
  buf: SharedArrayBuffer
}
