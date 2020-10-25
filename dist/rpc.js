"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RPC = exports.WS_CODES = void 0;
var utils_1 = require("./utils");
var rlp = require("./rlp");
var constants_1 = require("./constants");
var contract_1 = require("./contract");
var BN = require("./bn");
var WS_CODES;
(function (WS_CODES) {
    WS_CODES[WS_CODES["NULL"] = 0] = "NULL";
    WS_CODES[WS_CODES["EVENT_EMIT"] = 1] = "EVENT_EMIT";
    WS_CODES[WS_CODES["EVENT_SUBSCRIBE"] = 2] = "EVENT_SUBSCRIBE";
    WS_CODES[WS_CODES["TRANSACTION_EMIT"] = 3] = "TRANSACTION_EMIT";
    WS_CODES[WS_CODES["TRANSACTION_SUBSCRIBE"] = 4] = "TRANSACTION_SUBSCRIBE";
    WS_CODES[WS_CODES["TRANSACTION_SEND"] = 5] = "TRANSACTION_SEND";
    WS_CODES[WS_CODES["ACCOUNT_QUERY"] = 6] = "ACCOUNT_QUERY";
    WS_CODES[WS_CODES["CONTRACT_QUERY"] = 7] = "CONTRACT_QUERY";
})(WS_CODES = exports.WS_CODES || (exports.WS_CODES = {}));
var RPC = /** @class */ (function () {
    /**
     *
     * @param {string} host  主机名
     * @param {string | number} port  端口号
     */
    function RPC(host, port) {
        this.host = host || 'localhost';
        this.port = typeof port === 'number' ? port : (parseInt(port || '80'));
        this.callbacks = new Map(); // id -> function
        this.id2key = new Map(); // id -> address:event
        this.id2hash = new Map(); // id -> txhash
        this.eventHandlers = new Map(); // address:event -> [id]
        this.txObservers = new Map(); // hash -> [id]
        this.cid = 0;
        this.rpcCallbacks = new Map(); // nonce -> cb
        this.nonce = 0;
    }
    RPC.prototype.tryConnect = function () {
        var _this = this;
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            return Promise.resolve();
        }
        if (this.ws) {
            var fn_1 = this.ws.onopen || (function (e) { });
            var p_1 = new Promise(function (rs, rj) {
                _this.ws.onopen = function (e) {
                    fn_1.apply(_this.ws, e);
                    rs();
                };
            });
            return p_1;
        }
        this.uuid = utils_1.uuidv4();
        if (typeof WebSocket === 'function') {
            this.ws = new WebSocket("ws://" + this.host + ":" + (this.port || 80) + "/websocket/" + this.uuid);
        }
        else {
            var WS = require('ws');
            this.ws = new WS("ws://" + this.host + ":" + (this.port || 80) + "/websocket/" + this.uuid);
        }
        this.ws.onerror = console.error;
        this.ws.onmessage = function (e) {
            if (typeof WebSocket !== 'function') {
                _this.handleData(e.data);
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                var arrayBuffer = reader.result;
                _this.handleData(new Uint8Array(arrayBuffer));
            };
            reader.readAsArrayBuffer(e.data);
        };
        var p = new Promise(function (rs, rj) {
            _this.ws.onopen = rs;
        });
        return p;
    };
    RPC.prototype.parse = function (data) {
        var decoded = rlp.decode(data);
        var nonce = rlp.byteArrayToInt(decoded[0]);
        var code = rlp.byteArrayToInt(decoded[1]);
        var body = decoded[2];
        switch (code) {
            case WS_CODES.TRANSACTION_EMIT: {
                var ret_1 = {
                    code: code,
                    nonce: nonce,
                    hash: utils_1.bin2hex(body[0]),
                    status: rlp.byteArrayToInt(body[1]),
                    body: body
                };
                if (ret_1.status === constants_1.TX_STATUS.DROPPED)
                    ret_1.reason = utils_1.bin2str(body[2]);
                if (ret_1.status === constants_1.TX_STATUS.INCLUDED) {
                    var arr = body[2];
                    ret_1.blockHeight = utils_1.toSafeInt(arr[0]);
                    ret_1.blockHash = utils_1.bin2hex(arr[1]);
                    ret_1.gasUsed = utils_1.toSafeInt(arr[2]);
                    ret_1.result = arr[3];
                    ret_1.events = arr[4];
                }
                return ret_1;
            }
            case WS_CODES.EVENT_EMIT: {
                var ret_2 = {
                    code: code,
                    nonce: nonce,
                    addr: utils_1.bin2hex(body[0]),
                    name: utils_1.bin2str(body[1]),
                    fields: (body[2]),
                    body: body
                };
                return ret_2;
            }
            default:
                var ret = {
                    code: code,
                    body: body,
                    nonce: nonce
                };
                return ret;
        }
    };
    RPC.prototype.handleData = function (data) {
        var _this = this;
        var resp = this.parse(data);
        switch (resp.code) {
            case WS_CODES.TRANSACTION_EMIT: {
                var r_1 = resp;
                var funcIds = this.txObservers.get(r_1.hash) || new Set();
                funcIds.forEach(function (funcId) {
                    var func = _this.callbacks.get(funcId);
                    func(r_1);
                });
                return;
            }
            case WS_CODES.EVENT_EMIT: {
                var r_2 = resp;
                var funcIds = this.eventHandlers.get(r_2.addr + ":" + r_2.name) || [];
                funcIds.forEach(function (funcId) {
                    var func = _this.callbacks.get(funcId);
                    func(r_2);
                });
                return;
            }
        }
        // when nonce > 0
        if (resp.nonce > 0) {
            var fn = this.rpcCallbacks.get(resp.nonce);
            if (fn)
                fn(resp);
            this.rpcCallbacks.delete(resp.nonce);
        }
    };
    RPC.prototype.__listen = function (contract, event, func) {
        var addr = utils_1.hex2bin(contract.address);
        this.wsRPC(WS_CODES.EVENT_SUBSCRIBE, addr);
        var id = ++this.cid;
        var key = contract.address + ":" + event;
        this.id2key.set(id, key);
        var fn = function (r) {
            var resp = r;
            var abiDecoded = contract.abiDecode(resp.name, resp.fields, 'event');
            func(abiDecoded);
        };
        if (!this.eventHandlers.has(key))
            this.eventHandlers.set(key, new Set());
        this.eventHandlers.get(key).add(id);
        this.callbacks.set(id, fn);
        return id;
    };
    /**
     * 监听合约事件
     */
    RPC.prototype.listen = function (contract, event) {
        var _this = this;
        return new Promise(function (rs, rj) {
            _this.__listen(contract, event, rs);
        });
    };
    /**
     * 移除监听器
     * @param {number} id 监听器的 id
     */
    RPC.prototype.removeListener = function (id) {
        var key = this.id2key.get(id);
        var h = this.id2hash.get(id);
        this.callbacks.delete(id);
        this.id2key.delete(id);
        this.id2hash.delete(id);
        if (key) {
            var set = this.eventHandlers.get(key);
            set && set.delete(id);
            if (set && set.size === 0)
                this.eventHandlers.delete(key);
        }
        if (h) {
            var set = this.txObservers.get(h);
            set && set.delete(id);
            if (set && set.size === 0)
                this.txObservers.delete(h);
        }
    };
    RPC.prototype.listenOnce = function (contract, event) {
        var _this = this;
        var id = this.cid + 1;
        return this.listen(contract, event).then(function (r) {
            _this.removeListener(id);
            return r;
        });
    };
    RPC.prototype.__observe = function (h, cb) {
        var _this = this;
        var id = ++this.cid;
        var hash = utils_1.bin2hex(h);
        hash = hash.toLowerCase();
        if (!this.txObservers.has(hash))
            this.txObservers.set(hash, new Set());
        this.id2hash.set(id, hash);
        this.txObservers.get(hash).add(id);
        var fn = function (r) {
            cb(r);
            switch (r.status) {
                case constants_1.TX_STATUS.DROPPED:
                case constants_1.TX_STATUS.CONFIRMED:
                    _this.removeListener(id);
                    break;
            }
        };
        this.callbacks.set(id, fn);
        return id;
    };
    /**
     * 查看合约方法
     */
    RPC.prototype.viewContract = function (contract, method, parameters) {
        parameters = contract_1.normalizeParams(parameters);
        var addr = contract.address;
        var params = contract.abiEncode(method, parameters);
        return this.wsRPC(WS_CODES.CONTRACT_QUERY, [
            utils_1.hex2bin(addr),
            method,
            params
        ]).then(function (r) { return contract.abiDecode(method, r.body); });
    };
    /**
     * 发送事务
     * @param tx 事务
     */
    RPC.prototype.sendTransaction = function (tx) {
        return this.wsRPC(WS_CODES.TRANSACTION_SEND, [Array.isArray(tx), tx]);
    };
    RPC.prototype.observe = function (tx, status, timeout) {
        var _this = this;
        status = status === undefined ? constants_1.TX_STATUS.CONFIRMED : status;
        return new Promise(function (resolve, reject) {
            var success = false;
            if (timeout)
                setTimeout(function () {
                    if (success)
                        return;
                    reject({ reason: 'timeout' });
                }, timeout);
            var ret = {};
            var confirmed = false;
            var included = false;
            _this.__observe(tx.getHash(), function (r) {
                if (r.status === constants_1.TX_STATUS.DROPPED) {
                    var e = { hash: r.hash, reason: r.reason };
                    reject(e);
                    return;
                }
                if (r.status === constants_1.TX_STATUS.CONFIRMED) {
                    confirmed = true;
                    if (status == constants_1.TX_STATUS.INCLUDED)
                        return;
                    if (included) {
                        success = true;
                        resolve(ret);
                        return;
                    }
                }
                if (r.status === constants_1.TX_STATUS.INCLUDED) {
                    included = true;
                    ret = {
                        blockHeight: r.blockHeight,
                        blockHash: r.blockHash,
                        gasUsed: r.gasUsed,
                    };
                    if (r.result && r.result.length
                        && tx.__abi
                        && tx.isDeployOrCall()
                        && (!tx.isBuiltInCall())) {
                        var decoded = (new contract_1.Contract('', tx.__abi)).abiDecode(tx.getMethod(), r.result);
                        ret.result = decoded;
                    }
                    if (r.events &&
                        r.events.length
                        && tx.__abi) {
                        var events = [];
                        for (var _i = 0, _a = r.events; _i < _a.length; _i++) {
                            var e = _a[_i];
                            var name_1 = utils_1.bin2str(e[0]);
                            var decoded = (new contract_1.Contract('', tx.__abi)).abiDecode(name_1, e[1], 'event');
                            events.push({ name: name_1, data: decoded });
                        }
                        ret.events = events;
                    }
                    ret.transactionHash = tx.getHash();
                    ret.fee = utils_1.toSafeInt((new BN(tx.gasPrice).mul(new BN(ret.gasUsed))));
                    if (tx.isDeployOrCall() && !tx.isBuiltInCall()) {
                        ret.method = tx.getMethod();
                        ret.inputs = tx.__inputs;
                    }
                    if (status == constants_1.TX_STATUS.INCLUDED) {
                        success = true;
                        resolve(ret);
                        return;
                    }
                    if (confirmed) {
                        success = true;
                        resolve(ret);
                        return;
                    }
                }
            });
        });
    };
    RPC.prototype.wsRPC = function (code, data) {
        var _this = this;
        this.nonce++;
        var n = this.nonce;
        var ret = new Promise(function (rs, rj) {
            _this.rpcCallbacks.set(n, rs);
        });
        this.tryConnect()
            .then(function () {
            var encoded = rlp.encode([n, code, data]);
            _this.ws.send(encoded);
        });
        return ret;
    };
    RPC.prototype.sendAndObserve = function (tx, status, timeout) {
        var _this = this;
        var ret;
        var p;
        var sub;
        if (Array.isArray(tx)) {
            p = [];
            var arr = [];
            sub = this.wsRPC(WS_CODES.TRANSACTION_SUBSCRIBE, tx.map(function (t) { return utils_1.hex2bin(t.getHash()); }));
            for (var _i = 0, tx_1 = tx; _i < tx_1.length; _i++) {
                var t = tx_1[_i];
                arr.push(this.observe(t, status, timeout));
            }
            p = Promise.all(p);
            ret = Promise.all(arr);
        }
        else {
            sub = this.wsRPC(WS_CODES.TRANSACTION_SUBSCRIBE, utils_1.hex2bin(tx.getHash()));
            ret = this.observe(tx, status, timeout);
        }
        return sub
            .then(function () { return _this.sendTransaction(tx); })
            .then(function () { return ret; });
    };
    /**
     * 查看区块头
     * @param hashOrHeight {string | number} 区块哈希值或者区块高度
     * @returns {Promise<Object>}
     */
    RPC.prototype.getHeader = function (hashOrHeight) {
        var url = "http://" + this.host + ":" + this.port + "/rpc/header/" + hashOrHeight;
        return rpcGet(url);
    };
    /**
     * 查看区块
     * @param hashOrHeight {string | number} 区块哈希值或者区块高度
     * @returns {Promise<Object>}
     */
    RPC.prototype.getBlock = function (hashOrHeight) {
        var url = "http://" + this.host + ":" + this.port + "/rpc/block/" + hashOrHeight;
        return rpcGet(url);
    };
    /**
     * 查看事务
     * @param hash 事务哈希值
     * @returns {Promise<Object>}
     */
    RPC.prototype.getTransaction = function (hash) {
        var url = "http://" + this.host + ":" + this.port + "/rpc/transaction/" + hash;
        return rpcGet(url);
    };
    /**
     * 查看账户
     * @param pkOrAddress {string} 公钥或者地址
     * @returns {Promise<Object>}
     */
    RPC.prototype.getAccount = function (pkOrAddress) {
        var d = utils_1.hex2bin(pkOrAddress);
        if (d.length != 20)
            d = utils_1.hex2bin(utils_1.publicKey2Address(d));
        return this.wsRPC(WS_CODES.ACCOUNT_QUERY, d)
            .then(function (resp) {
            var decoded = resp.body;
            var a = {
                address: utils_1.bin2hex(decoded[0]),
                nonce: utils_1.toSafeInt(decoded[1]),
                balance: utils_1.toSafeInt(decoded[2]),
                createdBy: utils_1.bin2hex(decoded[3]),
                contractHash: utils_1.bin2hex(decoded[4]),
                storageRoot: utils_1.bin2hex(decoded[5])
            };
            return a;
        });
    };
    /**
     * 获取 nonce
     * @param pkOrAddress {string} 公钥或者地址
     * @returns {Promise<string>}
     */
    RPC.prototype.getNonce = function (pkOrAddress) {
        return this.getAccount(pkOrAddress)
            .then(function (a) { return a.nonce; });
    };
    /**
     * 查看申请加入的地址
     * @param contractAddress 合约地址
     * @returns {Promise<Object>}
     */
    RPC.prototype.getAuthPending = function (contractAddress) {
        return rpcPost(this.host, this.port, "/rpc/contract/" + utils_1.bin2hex(contractAddress), {
            method: 'pending'
        });
    };
    /**
     * 查看已经加入的地址
     * @param contractAddress 合约地址
     * @returns {Promise<[]>}
     */
    RPC.prototype.getAuthNodes = function (contractAddress) {
        return rpcPost(this.host, this.port, "/rpc/contract/" + utils_1.bin2hex(contractAddress), {
            method: 'nodes'
        });
    };
    /**
     * 查看投票数量排名列表
     */
    RPC.prototype.getPoSNodeInfos = function () {
        return rpcPost(this.host, this.port, "/rpc/contract/" + constants_1.constants.POS_CONTRACT_ADDR, {
            method: 'nodeInfos'
        });
    };
    /**
     * 查看投票
     * @param txHash 投票的事务哈希值
     * @returns { Promise }
     */
    RPC.prototype.getPoSVoteInfo = function (txHash) {
        return rpcPost(this.host, this.port, "/rpc/contract/" + constants_1.constants.POS_CONTRACT_ADDR, {
            method: 'voteInfo',
            txHash: txHash
        });
    };
    RPC.prototype.close = function () {
        if (this.ws) {
            var __ws = this.ws;
            this.ws = null;
            __ws.close();
        }
    };
    return RPC;
}());
exports.RPC = RPC;
function rpcGet(url) {
    if (typeof window !== 'object') {
        var http_1 = require('http');
        return new Promise(function (resolve, reject) {
            http_1.get(url, function (res) {
                var data = "";
                res.on("data", function (d) {
                    data += d;
                });
                res.on("end", function () {
                    var d = JSON.parse(data);
                    if (d.code === 200) {
                        resolve(d.data);
                        return;
                    }
                    reject(d.message);
                });
            })
                .on('error', reject);
        });
    }
    else {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200) {
                        resolve(resp.data);
                    }
                    else {
                        reject(resp.message);
                    }
                }
            };
            xhr.open('GET', url);
            xhr.send();
        });
    }
}
function rpcPost(host, port, path, data) {
    if (!path.startsWith('/'))
        path = '/' + path;
    data = typeof data === 'string' ? data : JSON.stringify(data);
    if (typeof window !== 'object') {
        var http_2 = require('http');
        return new Promise(function (resolve, reject) {
            var opt = {
                host: host,
                port: port,
                path: path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };
            var req = http_2.request(opt, function (res) {
                var data = "";
                res.on("data", function (d) {
                    data += d;
                });
                res.on("end", function () {
                    var d = JSON.parse(data);
                    if (d.code === 200) {
                        resolve(d.data);
                        return;
                    }
                    reject(d.message);
                });
            })
                .on('error', reject);
            req.write(data);
            req.end();
        });
    }
    else {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.onload = function () {
                if (xhr.status !== 200) {
                    reject('server error');
                    return;
                }
                var resp = JSON.parse(xhr.responseText);
                if (resp.code === 200)
                    resolve(resp.data);
                else {
                    reject(resp.message);
                }
            };
            xhr.open('POST', "http://" + host + ":" + port + path);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(data);
        });
    }
}
