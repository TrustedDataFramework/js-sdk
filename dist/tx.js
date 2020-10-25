"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = void 0;
var utils_1 = require("./utils");
var sm_crypto_1 = require("@salaku/sm-crypto");
var constants_1 = require("./constants");
var rlp = require("./rlp");
var BN = require("./bn");
var contract_1 = require("./contract");
var Transaction = /** @class */ (function () {
    function Transaction(version, type, createdAt, nonce, from, gasLimit, gasPrice, amount, payload, to, signature, __abi, __inputs) {
        this.version = utils_1.dig2str(version || 0);
        this.type = utils_1.dig2str(type || 0);
        this.createdAt = utils_1.dig2str(createdAt || 0);
        this.nonce = utils_1.dig2str(nonce || 0);
        this.from = utils_1.bin2hex(from || '');
        this.gasLimit = utils_1.dig2str(gasLimit || 0);
        this.gasPrice = utils_1.dig2str(gasPrice || 0);
        this.amount = utils_1.dig2str(amount || 0);
        this.payload = utils_1.bin2hex(payload || '');
        this.to = utils_1.bin2hex(to || '');
        this.signature = utils_1.bin2hex(signature || '');
        if (__abi)
            this.__abi = __abi;
        if (__inputs)
            this.__inputs = __inputs;
    }
    Transaction.clone = function (o) {
        o = o || {};
        return new Transaction(o.version, o.type, o.createdAt, o.nonce, o.from, o.gasLimit, o.gasPrice, o.amount, o.payload, o.to, o.signature);
    };
    /**
     * 计算事务哈希值
     */
    Transaction.prototype.getHash = function () {
        var buf = this.getSignaturePlain();
        return sm_crypto_1.sm3(buf);
    };
    /**
     * 事务签名原文
     */
    Transaction.prototype.getSignaturePlain = function () {
        return rlp.encode(this.__toArr());
    };
    /**
     * rlp 编码
     */
    Transaction.prototype.getEncoded = function () {
        var arr = this.__toArr();
        arr.push(utils_1.convert(this.signature || '', constants_1.ABI_DATA_ENUM.bytes));
        return rlp.encode(arr);
    };
    Transaction.prototype.__toArr = function () {
        return [
            utils_1.convert(this.version || 0, constants_1.ABI_DATA_ENUM.u64),
            utils_1.convert(this.type || 0, constants_1.ABI_DATA_ENUM.u64),
            utils_1.convert(this.createdAt || '0', constants_1.ABI_DATA_ENUM.u64),
            utils_1.convert(this.nonce || '0', constants_1.ABI_DATA_ENUM.u64),
            utils_1.convert(this.from || '', constants_1.ABI_DATA_ENUM.bytes),
            utils_1.convert(this.gasLimit || '0', constants_1.ABI_DATA_ENUM.u64),
            utils_1.convert(this.gasPrice || '0', constants_1.ABI_DATA_ENUM.u256),
            utils_1.convert(this.amount || '0', constants_1.ABI_DATA_ENUM.u256),
            utils_1.convert(this.payload || '', constants_1.ABI_DATA_ENUM.bytes),
            utils_1.convert(this.to || '', constants_1.ABI_DATA_ENUM.address)
        ];
    };
    // convert AbiInput to readable
    Transaction.prototype.__setInputs = function (__inputs) {
        var cnv = function (x) {
            if (x instanceof ArrayBuffer || x instanceof Uint8Array)
                return utils_1.bin2hex(x);
            if (x instanceof BN)
                return utils_1.toSafeInt(x);
            return x;
        };
        if (Array.isArray(__inputs)) {
            this.__inputs = __inputs.map(cnv);
        }
        else {
            this.__inputs = {};
            for (var _i = 0, _a = Object.keys(__inputs); _i < _a.length; _i++) {
                var k = _a[_i];
                this.__inputs[k] = cnv(__inputs[k]);
            }
        }
        if (Array.isArray(this.__inputs)) {
            var c = new contract_1.Contract('', this.__abi);
            var a = c.getABI(this.getMethod(), 'function');
            if (a.inputsObj()) {
                this.__inputs = a.toObj(this.__inputs, true);
            }
        }
    };
    Transaction.prototype.getMethod = function () {
        var t = parseInt(this.type);
        return t === constants_1.constants.DEPLOY ? 'init' : utils_1.bin2str((rlp.decode(utils_1.hex2bin(this.payload)))[0]);
    };
    Transaction.prototype.isDeployOrCall = function () {
        var t = parseInt(this.type);
        return t === constants_1.constants.DEPLOY || t === constants_1.constants.CONTRACT_CALL;
    };
    Transaction.prototype.isBuiltInCall = function () {
        return this.isDeployOrCall() &&
            (this.to === constants_1.constants.PEER_AUTHENTICATION_ADDR || this.to === constants_1.constants.POA_AUTHENTICATION_ADDR
                || this.to == constants_1.constants.POS_CONTRACT_ADDR);
    };
    Transaction.prototype.sign = function (sk) {
        this.signature =
            sm_crypto_1.sm2.doSignature(this.getSignaturePlain(), sk, { userId: 'userid@soie-chain.com', der: false, hash: true });
    };
    return Transaction;
}());
exports.Transaction = Transaction;
