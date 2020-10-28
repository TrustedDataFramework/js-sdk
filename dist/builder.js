"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionBuilder = void 0;
var constants_1 = require("./constants");
var tx_1 = require("./tx");
var utils_1 = require("./utils");
var contract_1 = require("./contract");
var rlp = require("./rlp");
var TransactionBuilder = /** @class */ (function () {
    function TransactionBuilder(version, sk, gasLimit, gasPrice, nonce) {
        this.version = utils_1.dig2str(version || '0');
        this.sk = utils_1.bin2hex(sk || '');
        this.gasPrice = utils_1.dig2str(gasPrice || '0');
        this.gasLimit = utils_1.dig2str(gasLimit || 0);
        this.nonce = utils_1.dig2str(nonce || 0);
    }
    TransactionBuilder.prototype.increaseNonce = function () {
        var n = utils_1.convert(this.nonce, constants_1.ABI_DATA_TYPE.u64);
        this.nonce = n.add(constants_1.ONE).toString(10);
    };
    /**
     * 创建转账事务
     * @param amount 转账金额
     * @param to 转账接收者
     */
    TransactionBuilder.prototype.buildTransfer = function (amount, to) {
        return this.buildCommon(constants_1.constants.TRANSFER, amount, '', to);
    };
    /**
     * 构造部署合约的事务
     * @param contract 合约对象
     * @param parameters 合约的构造器参数
     * @param amount
     */
    TransactionBuilder.prototype.buildDeploy = function (contract, parameters, amount) {
        utils_1.assert(contract.binary && contract.binary instanceof Uint8Array, 'contract binary is not uint8 array');
        utils_1.assert(contract.abi, 'missing contract abi');
        parameters = contract_1.normalizeParams(parameters);
        var binary = contract.binary;
        var encoded = contract.abi.filter(function (x) { return x.name === 'init'; }).length > 0 ?
            contract.abiEncode('init', parameters) : [[], [], []];
        var ret = this.buildCommon(constants_1.constants.DEPLOY, amount, rlp.encode([binary, encoded, contract.abiToBinary()]), '');
        ret.__abi = contract.abi;
        ret.__setInputs(parameters);
        return ret;
    };
    /**
     * 构造合约调用事务
     * @param contract 合约
     * @param method 调用合约的方法
     * @param parameters 方法参数
     * @param amount 金额
     */
    TransactionBuilder.prototype.buildContractCall = function (contract, method, parameters, amount) {
        if (!contract.abi)
            throw new Error('missing contract abi');
        if (!contract.address)
            throw new Error('missing contract address');
        parameters = contract_1.normalizeParams(parameters);
        var addr = contract.address;
        var encoded = contract.abiEncode(method, parameters);
        var ret = this.buildCommon(constants_1.constants.CONTRACT_CALL, amount, rlp.encode([method, encoded]), addr);
        ret.__abi = contract.abi;
        ret.__setInputs(parameters);
        return ret;
    };
    /**
     * 创建事务
     * @param type 事务类型
     * @param amount 金额
     * @param payload
     * @param to 接收者的地址
     * @returns { Transaction } 构造好的事务
     */
    TransactionBuilder.prototype.buildCommon = function (type, amount, payload, to) {
        var ret = new tx_1.Transaction(this.version, type, Math.floor((new Date()).valueOf() / 1000), 0, utils_1.privateKey2PublicKey(this.sk), this.gasLimit, this.gasPrice, amount || 0, payload || '', to);
        if (this.nonce && parseFloat(this.nonce) > 0) {
            ret.nonce = utils_1.dig2str(this.nonce);
            this.increaseNonce();
            this.sign(ret);
        }
        return ret;
    };
    /**
     * 构造加入请求事务
     * @param address 合约地址
     */
    TransactionBuilder.prototype.buildAuthJoin = function (address) {
        var payload = '00';
        return this.buildCommon(constants_1.constants.CONTRACT_CALL, 0, payload, address);
    };
    /**
     * 构造 Auth 同意加入的请求
     * @param contractAddress 合约地址
     * @param approvedAddress 同意加入的地址
     */
    TransactionBuilder.prototype.buildAuthApprove = function (contractAddress, approvedAddress) {
        var payload = '01' + utils_1.bin2hex(approvedAddress);
        return this.buildCommon(constants_1.constants.CONTRACT_CALL, 0, payload, contractAddress);
    };
    /**
     * 构造 Auth 退出事务
     */
    TransactionBuilder.prototype.buildAuthExit = function (contractAddress) {
        var payload = '02' + utils_1.privateKey2PublicKey(this.sk);
        return this.buildCommon(constants_1.constants.CONTRACT_CALL, 0, payload, contractAddress);
    };
    /**
     * 构造投票事务
     * @param amount 投票数量
     * @param to 被投票者的地址
     */
    TransactionBuilder.prototype.buildVote = function (amount, to) {
        var payload = '00' + to;
        return this.buildCommon(constants_1.constants.CONTRACT_CALL, amount, payload, constants_1.constants.POS_CONTRACT_ADDR);
    };
    TransactionBuilder.prototype.buildCancelVote = function (hash) {
        var payload = '01' + utils_1.bin2hex(hash);
        return this.buildCommon(constants_1.constants.CONTRACT_CALL, 0, payload, constants_1.constants.POS_CONTRACT_ADDR);
    };
    /**
     * 对事务作出签名
     * @param tx
     */
    TransactionBuilder.prototype.sign = function (tx) {
        tx.sign(this.sk);
    };
    return TransactionBuilder;
}());
exports.TransactionBuilder = TransactionBuilder;
