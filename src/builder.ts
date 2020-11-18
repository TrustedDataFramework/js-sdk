import { Digital, ONE, constants, Binary, AbiInput } from './constants'
import { Transaction } from './tx'
import { bin2hex, dig2str, privateKey2PublicKey, assert, toSafeInt, toBigN } from './utils'
import { Contract, normalizeParams } from './contract'
import rlp = require('./rlp')

/**
 * 事务构造工具
 */
export class TransactionBuilder {
    version: number
    sk: string
    gasLimit: bigint | number
    gasPrice: bigint | number
    nonce: bigint | number

    constructor(
        version?: Digital,
        sk?: Binary,
        gasLimit?: Digital,
        gasPrice?: Digital,
        nonce?: Digital
    ) {
        this.version = <number>toSafeInt(version || 0)
        this.sk = bin2hex(sk || '')
        this.gasPrice = toBigN(gasPrice || 0)
        this.gasLimit = toBigN(gasLimit || 0)
        this.nonce = toBigN(nonce || 0)
    }


    increaseNonce(): void {
        this.nonce = BigInt(this.nonce) + ONE
    }

    /**
     * 创建转账事务
     * @param amount 转账金额
     * @param to 转账接收者
     */
    buildTransfer(amount: Digital, to: Binary): Transaction {
        return this.buildCommon(constants.TRANSFER, amount, '', to)
    }

    /**
     * 构造部署合约的事务
     * @param contract 合约对象
     * @param parameters 合约的构造器参数
     * @param amount 
     */
    buildDeploy(contract: Contract, parameters?: AbiInput | AbiInput[] | Record<string, AbiInput>, amount?: Digital): Transaction {

        assert(contract.binary && contract.binary instanceof Uint8Array, 'contract binary is not uint8 array')
        assert(contract.abi, 'missing contract abi')


        parameters = normalizeParams(parameters)

        const binary = contract.binary

        let encoded = contract.abi.filter(x => x.name === 'init').length > 0 ?
            contract.abiEncode('init', parameters) : [[], [], []]

        const ret = this.buildCommon(constants.DEPLOY, amount, rlp.encode([binary, encoded, contract.abiToBinary()]), '')
        ret.__abi = contract.abi
        ret.__setInputs(parameters)
        return ret
    }

    /**
     * 构造合约调用事务
     * @param contract 合约
     * @param method 调用合约的方法
     * @param parameters 方法参数
     * @param amount 金额
     */
    buildContractCall(contract: Contract, method: string, parameters?: AbiInput | AbiInput[] | Record<string, AbiInput>, amount?: Digital): Transaction {
        if (!contract.abi)
            throw new Error('missing contract abi')
        if (!contract.address)
            throw new Error('missing contract address')

        parameters = normalizeParams(parameters)

        const addr = contract.address
        let encoded = contract.abiEncode(method, parameters)

        const ret = this.buildCommon(constants.CONTRACT_CALL, amount, rlp.encode([method, encoded]), addr)
        ret.__abi = contract.abi
        ret.__setInputs(parameters)
        return ret
    }

    /**
     * 创建事务
     * @param type 事务类型
     * @param amount 金额
     * @param payload 
     * @param to 接收者的地址
     * @returns { Transaction } 构造好的事务
     */
    buildCommon(type?: Digital, amount?: Digital, payload?: Binary, to?: Binary): Transaction {
        const ret = new Transaction(
            this.version,
            type,
            Math.floor((new Date()).valueOf() / 1000),
            0,
            privateKey2PublicKey(this.sk),
            this.gasLimit,
            this.gasPrice,
            amount || 0,
            payload || '',
            to
        )

        if (this.nonce && this.nonce > 0) {
            ret.nonce = dig2str(this.nonce)
            this.increaseNonce()
            this.sign(ret)
        }

        return ret
    }

    /**
     * 构造加入请求事务
     * @param address 合约地址
     */
    buildAuthJoin(address: Binary): Transaction {
        const payload = '00'
        return this.buildCommon(constants.CONTRACT_CALL, 0, payload, address)
    }

    /**
     * 构造 Auth 同意加入的请求
     * @param contractAddress 合约地址
     * @param approvedAddress 同意加入的地址
     */
    buildAuthApprove(contractAddress: Binary, approvedAddress: Binary): Transaction {
        const payload = '01' + bin2hex(approvedAddress)
        return this.buildCommon(constants.CONTRACT_CALL, 0, payload, contractAddress)
    }

    /**
     * 构造 Auth 退出事务
     */
    buildAuthExit(contractAddress: Binary): Transaction {
        const payload = '02' + privateKey2PublicKey(this.sk)
        return this.buildCommon(constants.CONTRACT_CALL, 0, payload, contractAddress)
    }

    /**
     * 构造投票事务
     * @param amount 投票数量
     * @param to 被投票者的地址
     */
    buildVote(amount: Digital, to: Binary): Transaction {
        const payload = '00' + to;
        return this.buildCommon(constants.CONTRACT_CALL, amount, payload, constants.POS_CONTRACT_ADDR)
    }


    buildCancelVote(hash: Binary) {
        const payload = '01' + bin2hex(hash)
        return this.buildCommon(constants.CONTRACT_CALL, 0, payload, constants.POS_CONTRACT_ADDR)
    }

    /**
     * 对事务作出签名
     * @param tx
     */
    sign(tx: Transaction) {
        tx.sign(this.sk)
    }
}