/// <reference types="node" />
import { Digital, Binary, AbiInput } from "./constants";
import { Transaction } from "./tx";
import { Contract } from './contract';
import Dict = NodeJS.Dict;
export declare class TransactionBuilder {
    version: string;
    sk: string;
    gasLimit: string;
    gasPrice: string;
    nonce: string;
    constructor(version?: Digital, sk?: Binary, gasLimit?: Digital, gasPrice?: Digital, nonce?: Digital);
    increaseNonce(): void;
    /**
     * 创建转账事务（未签名）
     * @param amount 转账金额
     * @param to { string } 转账接收者
     * @returns { Transaction }
     */
    buildTransfer(amount: Digital, to: Binary): Transaction;
    /**
     * 构造部署合约的事务 （未签名）
     * @param { Contract } contract 合约对象
     * @param { Array | Object } [parameters] 合约的构造器参数
     * @param amount [number]
     * @returns { Transaction }
     */
    buildDeploy(contract: Contract, parameters?: AbiInput | AbiInput[] | Dict<AbiInput>, amount?: Digital): Transaction;
    /**
     * 构造合约调用事务
     * @param { Contract} contract 合约
     * @param {string} method 调用合约的方法
     * @param { Array | Object } [parameters] 方法参数
     * @param amount [number] 金额
     * @returns { Transaction }
     */
    buildContractCall(contract: Contract, method: string, parameters?: AbiInput | AbiInput[] | Dict<AbiInput>, amount?: Digital): Transaction;
    /**
     * 创建事务（未签名）
     * @param type {number | string | BN} 事务类型
     * @param amount {number | BN | string} 金额
     * @param payload {string | Uint8Array | ArrayBuffer}
     * @param to {string | Uint8Array | ArrayBuffer } 接收者的地址
     * @returns { Transaction } 构造好的事务
     */
    buildCommon(type?: Digital, amount?: Digital, payload?: string | ArrayBuffer | Uint8Array, to?: string | ArrayBuffer | Uint8Array): Transaction;
    /**
     * 构造加入请求事务（未签名）
     * @param address {string} 合约地址
     * @returns { Transaction }
     */
    buildAuthJoin(address: any): Transaction;
    /**
     * 构造同意加入的请求
     * @param contractAddress {string} 合约地址
     * @param approvedAddress {string} 同意加入的地址
     * @returns { Transaction }
     */
    buildAuthApprove(contractAddress: string | Uint8Array | ArrayBuffer, approvedAddress: string | Uint8Array | ArrayBuffer): Transaction;
    /**
     * 构造退出事务（未签名）
     */
    buildAuthExit(contractAddress: string | ArrayBuffer | Uint8Array): Transaction;
    /**
     * 构造投票事务（未签名）
     * @param amount {number} 投票数量
     * @param to {string} 被投票者的地址
     */
    buildVote(amount: Digital, to: Binary): Transaction;
    buildCancelVote(hash: Binary): Transaction;
    /**
     * 对事务作出签名
     * @param tx
     */
    sign(tx: Transaction): void;
}
