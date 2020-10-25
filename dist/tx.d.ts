/// <reference types="node" />
import { AbiInput, Binary, Digital } from './constants';
import { Readable } from './constants';
import BN = require('./bn');
import { Encoder } from "./rlp";
import { ABI } from './contract';
import Dict = NodeJS.Dict;
export declare class Transaction implements Encoder {
    version: string;
    type: string;
    createdAt: string;
    nonce: string;
    from: string;
    gasLimit: string;
    gasPrice: string;
    amount: string;
    payload: string;
    to: string;
    signature: string;
    __abi?: ABI[];
    __inputs?: Readable[] | Dict<Readable>;
    constructor(version?: Digital, type?: Digital, createdAt?: Digital, nonce?: Digital, from?: any, gasLimit?: any, gasPrice?: any, amount?: any, payload?: any, to?: any, signature?: any, __abi?: any, __inputs?: any);
    static clone(o?: any): Transaction;
    /**
     * 计算事务哈希值
     */
    getHash(): string;
    /**
     * 事务签名原文
     */
    getSignaturePlain(): Uint8Array;
    /**
     * rlp 编码
     */
    getEncoded(): Uint8Array;
    __toArr(): (string | Uint8Array | BN)[];
    __setInputs(__inputs: AbiInput[] | Dict<AbiInput>): void;
    getMethod(): string;
    isDeployOrCall(): boolean;
    isBuiltInCall(): boolean;
    sign(sk: Binary): void;
}
