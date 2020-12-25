import { AbiInput, Binary, Digital, getEC, OFFSET_DATE } from './constants'
import { bin2hex, dig2str, convert, bin2str, hex2bin, toSafeDig, digest, doSign } from "./utils";
import { sm2 } from '@salaku/sm-crypto'
import { constants, ABI_DATA_TYPE, Readable } from './constants'
import rlp = require('./rlp')
import { Encoder } from "./rlp";
import { ABI, Contract } from './contract'
import BN = require('../bn');


/**
 * 事务实体类，字段尽量用字符串表示，便于在 json 中序列化和反序列化
 * 当部分字段可能丢失精度时会用字符串表示整数
 */
export class Transaction implements Encoder {
    version: number | string
    type: number | string
    createdAt: number | string
    nonce: number | string
    from: string
    gasLimit: number | string
    gasPrice: number | string
    amount: number | string
    payload: string
    to: string
    signature: string

    blockHeight?: number | string
    blockHash?: string
    confirms?: number

    __abi?: ABI[]
    __inputs?: Readable[] | Record<string, Readable>
    constructor(version?: Digital, type?: Digital, createdAt?: Digital, nonce?: Digital, from?: Binary, gasLimit?: Digital, gasPrice?: Digital, amount?: Digital, payload?: Binary, to?: Binary, signature?: Binary, __abi?: ABI[], __inputs?: Readable[] | Record<string, Readable>) {
        // @ts-ignore
        if (typeof createdAt === 'string' && OFFSET_DATE.test(createdAt)) {
            try {
                createdAt = new Date(createdAt).valueOf() / 1000
            } catch (ignored) {

            }
        }
        this.version = toSafeDig(version || 0)
        this.type = toSafeDig(type || 0)
        this.createdAt = toSafeDig(createdAt || 0)
        this.nonce = dig2str(nonce || 0)
        this.from = bin2hex(from || '')
        this.gasLimit = toSafeDig(gasLimit || 0)
        this.gasPrice = toSafeDig(gasPrice || 0)
        this.amount = dig2str(amount || 0)
        this.payload = bin2hex(payload || '')
        this.to = bin2hex(to || '')
        this.signature = bin2hex(signature || '')

        if (__abi)
            this.__abi = __abi
        if (__inputs)
            this.__inputs = __inputs
    }

    /**
     * 从 JSON 对象中生成 Transaction 实例
     * @param o 
     */
    static clone(o?: any): Transaction {
        o = o || {}
        return new Transaction(o.version, o.type, o.createdAt, o.nonce, o.from, o.gasLimit, o.gasPrice, o.amount, o.payload, o.to, o.signature)
    }


    /**
     * 计算事务哈希值
     */
    getHash(): string {
        const buf = this.getSignaturePlain()
        return bin2hex(digest(buf))
    }


    /**
     * 事务签名原文
     */
    getSignaturePlain() {
        return rlp.encode(this.__toArr())
    }

    /**
     * rlp 编码
     */
    getEncoded() {
        const arr = this.__toArr()
        arr.push(convert(this.signature || '', ABI_DATA_TYPE.bytes))
        return rlp.encode(arr)
    }

    __toArr() {
        return [
            convert(this.version || 0, ABI_DATA_TYPE.u64),
            convert(this.type || 0, ABI_DATA_TYPE.u64),
            convert(this.createdAt || 0, ABI_DATA_TYPE.u64),
            convert(this.nonce || 0, ABI_DATA_TYPE.u64),
            convert(this.from || '', ABI_DATA_TYPE.bytes),
            convert(this.gasLimit || 0, ABI_DATA_TYPE.u64),
            convert(this.gasPrice || 0, ABI_DATA_TYPE.u256),
            convert(this.amount || 0, ABI_DATA_TYPE.u256),
            convert(this.payload || '', ABI_DATA_TYPE.bytes),
            (this.to && this.to.length) ? convert(this.to, ABI_DATA_TYPE.address) : ''
        ]
    }

    // convert AbiInput to readable
    __setInputs(__inputs: AbiInput[] | Record<string, AbiInput>): void {
        const cnv: (i: AbiInput) => Readable = (x: AbiInput) => {
            if (x instanceof ArrayBuffer || x instanceof Uint8Array)
                return bin2hex(x)
            if (x instanceof BN)
                return x.toString(10)
            return x
        }
        if (Array.isArray(__inputs)) {
            this.__inputs = __inputs.map(cnv)
        } else {
            this.__inputs = {}
            for (let k of Object.keys(__inputs)) {
                this.__inputs[k] = cnv(__inputs[k])
            }
        }
        if (Array.isArray(this.__inputs)) {
            const c = new Contract('', this.__abi)
            const a = c.getABI(this.getMethod(), 'function')
            if (a.inputsObj()) {
                this.__inputs = <Record<string, Readable>>a.toObj(this.__inputs, true)
            }
        }
    }

    /**
     * 合约调用的方法
     */
    getMethod() {
        const t = typeof this.type === 'string' ? parseInt(this.type) : this.type
        return t === constants.DEPLOY ? 'init' : bin2str(<Uint8Array>(rlp.decode(hex2bin(this.payload)))[0])
    }

    /**
     * 是否是合约部署或者合约调用事务
     */
    isDeployOrCall() {
        const t = typeof this.type === 'string' ? parseInt(this.type) : this.type
        return t === constants.DEPLOY || t === constants.CONTRACT_CALL
    }

    /**
     * 是否是对内置合约的调用
     */
    isBuiltInCall() {
        return this.isDeployOrCall() &&
            (this.to === constants.PEER_AUTHENTICATION_ADDR || this.to === constants.POA_AUTHENTICATION_ADDR
                || this.to == constants.POS_CONTRACT_ADDR)
    }

    sign(sk: Binary) {
        this.signature = bin2hex(doSign(sk, this.getSignaturePlain()))
    }
}