"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZERO = exports.ONE = exports.MIN_SAFE_INTEGER = exports.MAX_SAFE_INTEGER = exports.MIN_I64 = exports.MAX_I64 = exports.MAX_U256 = exports.MAX_U64 = exports.ABI_DATA_ENUM = exports.ABI_DATA_TYPE_TABLE = exports.constants = exports.TX_STATUS = void 0;
var BN = require("./bn");
var TX_STATUS;
(function (TX_STATUS) {
    TX_STATUS[TX_STATUS["PENDING"] = 0] = "PENDING";
    TX_STATUS[TX_STATUS["INCLUDED"] = 1] = "INCLUDED";
    TX_STATUS[TX_STATUS["CONFIRMED"] = 2] = "CONFIRMED";
    TX_STATUS[TX_STATUS["DROPPED"] = 3] = "DROPPED";
})(TX_STATUS = exports.TX_STATUS || (exports.TX_STATUS = {}));
exports.constants = {
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
};
exports.ABI_DATA_TYPE_TABLE = ['bool', 'i64', 'u64', 'f64', 'string', 'bytes', 'address', 'u256'];
var ABI_DATA_ENUM;
(function (ABI_DATA_ENUM) {
    ABI_DATA_ENUM[ABI_DATA_ENUM["bool"] = 0] = "bool";
    ABI_DATA_ENUM[ABI_DATA_ENUM["i64"] = 1] = "i64";
    ABI_DATA_ENUM[ABI_DATA_ENUM["u64"] = 2] = "u64";
    ABI_DATA_ENUM[ABI_DATA_ENUM["f64"] = 3] = "f64";
    ABI_DATA_ENUM[ABI_DATA_ENUM["string"] = 4] = "string";
    ABI_DATA_ENUM[ABI_DATA_ENUM["bytes"] = 5] = "bytes";
    ABI_DATA_ENUM[ABI_DATA_ENUM["address"] = 6] = "address";
    ABI_DATA_ENUM[ABI_DATA_ENUM["u256"] = 7] = "u256";
})(ABI_DATA_ENUM = exports.ABI_DATA_ENUM || (exports.ABI_DATA_ENUM = {}));
exports.MAX_U64 = new BN('ffffffffffffffff', 16);
exports.MAX_U256 = new BN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16);
exports.MAX_I64 = new BN('9223372036854775807', 10);
exports.MIN_I64 = new BN('-9223372036854775808', 10);
exports.MAX_SAFE_INTEGER = new BN(Number.MAX_SAFE_INTEGER);
exports.MIN_SAFE_INTEGER = new BN(Number.MIN_SAFE_INTEGER);
exports.ONE = new BN(1);
exports.ZERO = new BN(0);
