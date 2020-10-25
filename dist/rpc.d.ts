/// <reference types="node" />
import { AbiInput, Binary, Readable, RLPElement, TX_STATUS } from "./constants";
import { Contract } from "./contract";
import Dict = NodeJS.Dict;
import { Transaction } from "./tx";
export interface TransactionResult {
    transactionHash?: string;
    blockHeight?: number | string;
    blockHash?: string;
    gasUsed?: string | number;
    events?: Readable[] | Dict<Readable>;
    result?: Readable;
    fee?: string | number;
    method?: string;
    inputs?: AbiInput[] | Dict<AbiInput>;
}
interface Resp {
    code: WS_CODES;
    nonce: number;
    body: RLPElement | RLPElement[];
}
export declare enum WS_CODES {
    NULL = 0,
    EVENT_EMIT = 1,
    EVENT_SUBSCRIBE = 2,
    TRANSACTION_EMIT = 3,
    TRANSACTION_SUBSCRIBE = 4,
    TRANSACTION_SEND = 5,
    ACCOUNT_QUERY = 6,
    CONTRACT_QUERY = 7
}
export declare class RPC {
    host: string;
    port: number;
    private callbacks;
    private id2key;
    private id2hash;
    private eventHandlers;
    private txObservers;
    private cid;
    private rpcCallbacks;
    private nonce;
    private ws;
    private uuid;
    /**
     *
     * @param {string} host  主机名
     * @param {string | number} port  端口号
     */
    constructor(host: string, port?: string | number);
    private tryConnect;
    private parse;
    private handleData;
    private __listen;
    /**
     * 监听合约事件
     */
    listen(contract: any, event: any): Promise<Dict<Readable>>;
    /**
     * 移除监听器
     * @param {number} id 监听器的 id
     */
    removeListener(id: number): void;
    listenOnce(contract: Contract, event: string): Promise<Dict<Readable>>;
    private __observe;
    /**
     * 查看合约方法
     */
    viewContract(contract: Contract, method: string, parameters: any): Promise<Readable | Readable[] | Dict<Readable>>;
    /**
     * 发送事务
     * @param tx 事务
     */
    sendTransaction(tx: Transaction | Transaction[]): Promise<Resp>;
    observe(tx: Transaction, status?: TX_STATUS, timeout?: number): Promise<TransactionResult>;
    private wsRPC;
    sendAndObserve(tx: Transaction | Transaction[], status?: TX_STATUS, timeout?: number): Promise<TransactionResult>;
    /**
     * 查看区块头
     * @param hashOrHeight {string | number} 区块哈希值或者区块高度
     * @returns {Promise<Object>}
     */
    getHeader(hashOrHeight: string | number): Promise<Object>;
    /**
     * 查看区块
     * @param hashOrHeight {string | number} 区块哈希值或者区块高度
     * @returns {Promise<Object>}
     */
    getBlock(hashOrHeight: string | number): Promise<Object>;
    /**
     * 查看事务
     * @param hash 事务哈希值
     * @returns {Promise<Object>}
     */
    getTransaction(hash: string): Promise<Transaction>;
    /**
     * 查看账户
     * @param pkOrAddress {string} 公钥或者地址
     * @returns {Promise<Object>}
     */
    getAccount(pkOrAddress: any): Promise<{
        address: string;
        nonce: number | string;
        balance: number | string;
        createdBy: string;
        contractHash: string;
        storageRoot: string;
    }>;
    /**
     * 获取 nonce
     * @param pkOrAddress {string} 公钥或者地址
     * @returns {Promise<string>}
     */
    getNonce(pkOrAddress: any): Promise<string | number>;
    /**
     * 查看申请加入的地址
     * @param contractAddress 合约地址
     * @returns {Promise<Object>}
     */
    getAuthPending(contractAddress: Binary): Promise<Object>;
    /**
     * 查看已经加入的地址
     * @param contractAddress 合约地址
     * @returns {Promise<[]>}
     */
    getAuthNodes(contractAddress: Binary): Promise<string[]>;
    /**
     * 查看投票数量排名列表
     */
    getPoSNodeInfos(): Promise<Object>;
    /**
     * 查看投票
     * @param txHash 投票的事务哈希值
     * @returns { Promise }
     */
    getPoSVoteInfo(txHash: any): Promise<Object>;
    close(): void;
}
export {};
