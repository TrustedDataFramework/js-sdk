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
     * 创建转账事务
     * @param amount 转账金额
     * @param to 转账接收者
     */
    buildTransfer(amount: Digital, to: Binary): Transaction;
    /**
     * 构造部署合约的事务
     * @param contract 合约对象
     * @param parameters 合约的构造器参数
     * @param amount
     */
    buildDeploy(contract: Contract, parameters?: AbiInput | AbiInput[] | Dict<AbiInput>, amount?: Digital): Transaction;
    /**
     * 构造合约调用事务
     * @param contract 合约
     * @param method 调用合约的方法
     * @param parameters 方法参数
     * @param amount 金额
     */
    buildContractCall(contract: Contract, method: string, parameters?: AbiInput | AbiInput[] | Dict<AbiInput>, amount?: Digital): Transaction;
    /**
     * 创建事务
     * @param type 事务类型
     * @param amount 金额
     * @param payload
     * @param to 接收者的地址
     * @returns { Transaction } 构造好的事务
     */
    buildCommon(type?: Digital, amount?: Digital, payload?: Binary, to?: Binary): Transaction;
    /**
     * 构造加入请求事务
     * @param address 合约地址
     */
    buildAuthJoin(address: Binary): Transaction;
    /**
     * 构造 Auth 同意加入的请求
     * @param contractAddress 合约地址
     * @param approvedAddress 同意加入的地址
     */
    buildAuthApprove(contractAddress: Binary, approvedAddress: Binary): Transaction;
    /**
     * 构造 Auth 退出事务
     */
    buildAuthExit(contractAddress: Binary): Transaction;
    /**
     * 构造投票事务
     * @param amount 投票数量
     * @param to 被投票者的地址
     */
    buildVote(amount: Digital, to: Binary): Transaction;
    buildCancelVote(hash: Binary): Transaction;
    /**
     * 对事务作出签名
     * @param tx
     */
    sign(tx: Transaction): void;
}
