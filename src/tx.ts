import { AbiInput, Binary, Digital } from './constants'
import { bin2hex, dig2str, convert, bin2str, hex2bin, toSafeInt } from "./utils";
import { sm3, sm2 } from '@salaku/sm-crypto'
import { constants, ABI_DATA_ENUM, Readable } from './constants'
import rlp = require('./rlp')
import BN = require('./bn')
import { Encoder } from "./rlp";
import { ABI, Contract } from './contract'
import Dict = NodeJS.Dict

// 2020-10-25T09:57:15+08:00
const OFFSET_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\+[0-9]{2}:[0-9]{2}$/.compile()


export class Transaction implements Encoder {
    version: string
    type: string
    createdAt: string
    nonce: string
    from: string
    gasLimit: string
    gasPrice: string
    amount: string
    payload: string
    to: string
    signature: string
    __abi?: ABI[]
    __inputs?: Readable[] | Dict<Readable>
    constructor(version?: Digital, type?: Digital, createdAt?: Digital, nonce?: Digital, from?: Binary, gasLimit?: Digital, gasPrice?: Digital, amount?: Digital, payload?: Binary, to?: Binary, signature?: Binary, __abi?: ABI[], __inputs?: Readable[] | Dict<Readable>) {
        // @ts-ignore
        if (typeof createdAt === 'string' && OFFSET_DATE.test(createdAt)) {
            try {
                createdAt = new Date(createdAt).valueOf() / 1000
            } catch (ignored) {

            }
        }
        this.version = dig2str(version || 0)
        this.type = dig2str(type || 0)
        this.createdAt = dig2str(createdAt || 0)
        this.nonce = dig2str(nonce || 0)
        this.from = bin2hex(from || '')
        this.gasLimit = dig2str(gasLimit || 0)
        this.gasPrice = dig2str(gasPrice || 0)
        this.amount = dig2str(amount || 0)
        this.payload = bin2hex(payload || '')
        this.to = bin2hex(to || '')
        this.signature = bin2hex(signature || '')

        if (__abi)
            this.__abi = __abi
        if (__inputs)
            this.__inputs = __inputs
    }

    static clone(o?: any): Transaction {
        o = o || {}
        return new Transaction(o.version, o.type, o.createdAt, o.nonce, o.from, o.gasLimit, o.gasPrice, o.amount, o.payload, o.to, o.signature)
    }


    /**
     * 计算事务哈希值
     */
    getHash(): string {
        const buf = this.getSignaturePlain()
        return sm3(buf)
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
        arr.push(convert(this.signature || '', ABI_DATA_ENUM.bytes))
        return rlp.encode(arr)
    }

    __toArr() {
        return [
            convert(this.version || 0, ABI_DATA_ENUM.u64),
            convert(this.type || 0, ABI_DATA_ENUM.u64),
            convert(this.createdAt || '0', ABI_DATA_ENUM.u64),
            convert(this.nonce || '0', ABI_DATA_ENUM.u64),
            convert(this.from || '', ABI_DATA_ENUM.bytes),
            convert(this.gasLimit || '0', ABI_DATA_ENUM.u64),
            convert(this.gasPrice || '0', ABI_DATA_ENUM.u256),
            convert(this.amount || '0', ABI_DATA_ENUM.u256),
            convert(this.payload || '', ABI_DATA_ENUM.bytes),
            convert(this.to || '', ABI_DATA_ENUM.address)
        ]
    }

    // convert AbiInput to readable
    __setInputs(__inputs: AbiInput[] | Dict<AbiInput>) {
        const cnv: (i: AbiInput) => Readable = (x: AbiInput) => {
            if (x instanceof ArrayBuffer || x instanceof Uint8Array)
                return bin2hex(x)
            if (x instanceof BN)
                return toSafeInt(x)
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
                this.__inputs = <Dict<Readable>>a.toObj(this.__inputs, true)
            }
        }
    }

    getMethod() {
        const t = parseInt(this.type)
        return t === constants.DEPLOY ? 'init' : bin2str(<Uint8Array>(rlp.decode(hex2bin(this.payload)))[0])
    }

    isDeployOrCall() {
        const t = parseInt(this.type)
        return t === constants.DEPLOY || t === constants.CONTRACT_CALL
    }

    isBuiltInCall() {
        return this.isDeployOrCall() &&
            (this.to === constants.PEER_AUTHENTICATION_ADDR || this.to === constants.POA_AUTHENTICATION_ADDR
                || this.to == constants.POS_CONTRACT_ADDR)
    }

    sign(sk: Binary) {
        this.signature =
            sm2.doSignature(
                this.getSignaturePlain(),
                bin2hex(sk),
                { userId: 'userid@soie-chain.com', der: false, hash: true }
            )
    }
}