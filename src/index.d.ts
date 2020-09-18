import BN = require("./bn");

declare type AbiVMType = 'bool' | 'i64' | 'u64' | 'f64' | 'string' | 'bytes' | 'address' | 'u256'
declare type AbiType = 'function' | 'event'

type AbiJSType = string | number | Uint8Array | ArrayBuffer | BN | boolean

type Readable = string | number | boolean

type Numeric = string | number | BN
type Binary = string | Uint8Array | ArrayBuffer


declare namespace tdsSDK {
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


    export class RPC {
        /**
         * 构造器
         * @param host 主机名
         * @param port 端口号
         */
        constructor(host?: string, port?: string | number);

        /**
         * 监听合约事件
         * @param contract 合约
         * @param event 事件名称
         * @param func 回调函数
         */
        listen(contract: Contract, event: string, func?: (x: Object) => void): number | Promise<Object>;

        /**
         * 监听合约事件，但只监听一次
         * @param contract 合约
         * @param event 事件名称
         * @param func 回调函数
         */
        listenOnce(contract: Contract, event: string, func?: (x: Object) => void): number | Promise<Object>;

        /**
         * 移除监听器
         * @param id 监听器 id
         */
        removeListener(id: number): void;

        /**
         * 查看合约
         * @param contract 合约
         * @param method 方法名称
         * @param parameters 参数
         */
        viewContract(contract: Contract, method: string, parameters: Array<AbiJSType> | Object | AbiJSType): Promise<Readable>;

        /**
         * 发送事务并进入观察
         * @param tx 事务
         * @param status 
         * @param timeout 
         */
        sendAndObserve(tx: Transaction, status?: TX_STATUS, timeout?: number): Promise<TransactionResult>

        /**
         * 获取 nonce
         * @param pkOrAddress 公钥或者地址
         */
        getNonce(pkOrAddress: Binary): Promise<string | number>;

        /**
         * 发送事务
         * @param tx 事务
         */
        sendTransaction(tx: Transaction): Promise<void>;

        /**
         * 
         * @param tx 
         * @param status 
         * @param timeout 
         */
        observe(tx: Transaction, status?: TX_STATUS, timeout?: number): Promise<TransactionResult>;

        /**
         * 关闭 rpc
         */
        close(): void
    }


    export class TransactionBuilder {
        /**
         *
         * @param version 版本号
         * @param sk 私钥
         * @param gasLimit 最大gas限制
         * @param gasPrice gas 单价
         * @param nonce 事务开始序号
         */
        constructor(version?: Numeric, sk?: Binary, gasLimit?: Numeric, gasPrice?: Numeric, nonce?: Numeric);

        /**
         * 创建转账事务
         * @param amount 转账金额
         * @param to 转账接收者
         */
        buildTransfer(amount: Numeric, to: Binary): Transaction

        /**
          * 构造加入请求事务
          * @param address 合约地址
          * @returns { Transaction }
          */
        buildAuthJoin(address: Binary): Transaction;

        /**
         * 构造同意加入的事务
         * @param contractAddress 合约地址
         * @param approvedAddress 同意加入的地址
         */
        buildAuthApprove(contractAddress: Binary, approvedAddress: Binary): Transaction;

        /**
         * 构造退出事务
         * @param contractAddress 合约地址
         */
        buildAuthExit(contractAddress: Binary): Transaction;

        /**
         * 构造投票事务
         * @param amount 投票数量
         * @param to 被投票者的地址
         */
        buildVote(amount: Numeric, to: Binary): Transaction;

        /**
         * 构造撤销投票事务
         * @param hash 签名事务的哈希值
         */
        buildCancelVote(hash: Binary): Transaction;


        /**
         * 构造合约部署事务
         * @param contract 合约
         * @param parameters 参数
         * @param amount 金额
         */
        buildDeploy(contract: Contract, parameters?: Array<AbiJSType> | Object | AbiJSType, amount?: Numeric): Transaction;

        /**
         * 构造合约调用事务
         * @param contract 合约
         * @param method 调用的方法
         * @param parameters 参数
         * @param amount 金额
         */
        buildContractCall(contract: Contract, method: string, parameters?: Array<AbiJSType> | Object | AbiJSType, amount?: Numeric): Transaction;
    }

    export class Transaction {
        version: string;
        type: string;
        nonce: string;
        from: string;
        gasLimit: string;
        gasPrice: string;
        amount: string;
        payload: string;
        to: string;
        signature: string
        constructor(version?: Numeric, type?: Numeric, nonce?: Numeric, from?: Binary, gasLimit?: Numeric, gasPrice?: Numeric, amount?: Numeric, payload?: Binary, to?: Binary, signature?: Binary);
        // 得到事务哈希
        getHash(): string;
        // 从对象复制得到 Transaction
        static clone(o: Object): Transaction

        /**
         * 对事务签名
         * @param sk 私钥
         */
        sign(sk: Binary);
    }

    /**
     * 合约
     */
    export class Contract {
        address?: string;
        abi?: Array<ABI>;
        binary?: Uint8Array;
        constructor(address?: Binary, abi?: Array<ABI>, binary?: Uint8Array);
    }

    /**
     * 私钥转公钥
     * @param buf 私钥
     */
    export function privateKey2PublicKey(buf: Binary): string;

    /**
     * 公钥转地址
     * @param buf 公钥
     */
    export function publicKey2Address(buf: Binary): string;

    /**
     * 编译生成 abi
     * @param src 源代码
     */
    export function compileABI(src: Binary): Array<ABI>;

    /**
     * 编译合约
     * @param ascPath asc 所在路径
     * @param src 源文件名
     */
    export function compileContract(ascPath: string, src: string): Promise<Uint8Array>;

    /**
     * 计算合约地址
     * @param addr 合约创建者的地址
     * @param nonce 创建合约事务的 nonce
     */
    export function getContractAddress(addr: Binary, nonce: Numeric): string;


    /**
     * 读取 keystore
     * @param ks key store
     * @param password 密码
     * @return {string} 十六进制编码形式的私钥
     */
    function readKeyStore(ks: KeyStore, password: string): string;


    /**
     * 生成 keystore
     * @para password 密码
     * @param privateKey 私钥
     */
    export function createKeyStore(password: string, privateKey?: Binary): KeyStore;

    /**
     * 创建认证服务器
     * @param whiteList 公钥白名单
     * @param privateKey {string | Uint8Array | ArrayBuffer } 私钥
     * @returns {Object}
     */
    export function createAuthServer(privateKey: Binary, whiteList?: Array<string>): AuthServer;

    /**
     * 生成随机私钥
     */
    export function generatePrivateKey(): string;
}

declare interface AuthServer {
    listen(port: number, fn: () => void);
}

declare interface KeyStore {
    publicKey: string,
    crypto: {
        cipher: string,
        cipherText: string,
        iv: string,
        salt: string
    },
    id: string,
    version: string,
    mac: string,
    kdf: string,
    address: string
}

declare interface ABI {
    name: string;
    type: AbiType;
    inputs?: Array<TypeDef>;
    outputs?: Array<TypeDef>;
}

declare interface TypeDef {
    type: AbiVMType;
    name?: string;
}

declare interface TransactionResult {
    blockHeight: number;
    blockHash: string;
    gasUsed: string | number;
    events?: Array<Event>;
    transactionHash: string;
    fee: string | number;
    method?: string;
    inputs: Object | Array<Readable>
}

declare interface Event {
    name: string;
    data: Object;
}

export = tdsSDK
export as namespace tdsSDK
