(function () {
    const OFFSET_SHORT_ITEM = 0x80;
    const SIZE_THRESHOLD = 56;
    const OFFSET_LONG_ITEM = 0xb7;
    const OFFSET_SHORT_LIST = 0xc0;
    const OFFSET_LONG_LIST = 0xf7;
    const EMPTY_BYTES = new Uint8Array(new ArrayBuffer(0));
    const EMPTY_RLP_ARRAY = new Uint8Array([0xc0])
    const NULL_RLP = new Uint8Array([0x80])

    const ENVS = {
        NODE: 'NODE',
        BROWSER: 'BROWSER'
    }

    const env = this['window'] === this ? ENVS.BROWSER : ENVS.NODE
    const isBrowser = env === ENVS.BROWSER


    const BN = isBrowser ? window['BN'] : require('bn.js')
    const sm3 = isBrowser ? this.sm3 : require('@salaku/sm-crypto').sm3
    const sm2 = isBrowser ? this.sm2 : require('@salaku/sm-crypto').sm2
    const sm4 = isBrowser ? this.sm4 : require('@salaku/sm-crypto').sm4

    const crypto = isBrowser ? null : require('crypto')
    const http = isBrowser ? null : require('http')
    const child_process = isBrowser ? null : require('child_process');

    const TX_STATUS = {
        PENDING: 0,
        INCLUDED: 1,
        CONFIRMED: 2,
        DROPPED: 3
    }

    function copy(dst, src) {
        for (let key of Object.keys(src))
            dst[key] = src[key]
    }

    /**
     * 转成安全范围内的整数
     * @param {string | number | ArrayBuffer | Uint8Array | BN }
     * @returns { string | number}
     */
    function toSafeInt(x) {
        if (typeof x === 'number')
            return x
        if (typeof x === 'string') {
            const hex = x.startsWith('0x')
            if (hex)
                x = x.substr(2, x.length - 2)
            x = new BN(x, hex ? 16 : 10)
        }
        if (x instanceof ArrayBuffer || x instanceof Uint8Array)
            x = new BN(x, 'be')

        if (x.cmp(MAX_SAFE_INTEGER) <= 0 && x.cmp(MIN_SAFE_INTEGER) >= 0)
            return x.toNumber()
        return x.toString()
    }

    /**
     * 随机生成字节数组 Uint8Array
     * @param {number} length 字节数组长度
     * @return {Uint8Array}
     */
    function randomBytes(length) {
        if (!isBrowser)
            return crypto.randomBytes(length)

        const ret = new Uint8Array(length);
        window.crypto.getRandomValues(ret);
        return ret
    }

    const assert = this['assert'] ? this['assert'] : (truth, msg) => {
        if (!truth)
            throw new Error(msg || 'assert failed')
    }

    const MAX_U64 = new BN('ffffffffffffffff', 16);
    const MAX_U256 = new BN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16);
    const MAX_I64 = new BN('9223372036854775807', 10);
    const MIN_I64 = new BN('-9223372036854775808', 10);
    const MAX_SAFE_INTEGER = new BN(Number.MAX_SAFE_INTEGER);
    const MIN_SAFE_INTEGER = new BN(Number.MIN_SAFE_INTEGER);
    const ONE = new BN(1)

    /**
     * 截掉字节数组前面的 0
     * @param { Uint8Array | ArrayBuffer } data 字节数组
     */
    function trimLeadingZeros(data) {
        assert(isBytes(data), 'data is not bytes')
        data = toU8Arr(data)
        let k = -1;
        for (let i = 0; i < data.length; i++) {
            if (data[i] !== 0) {
                k = i;
                break;
            }
        }
        if (k === -1)
            return new Uint8Array(0)
        return data.slice(k, data.length)
    }

    function hexToInt(x) {
        if (48 <= x && x <= 57) return x - 48;
        if (97 <= x && x <= 102) return x - 87;
        if (65 <= x && x <= 70) return x - 55;
        return 0;
    }

    /**
     * 解析十六进制字符串
     * decode hex string
     * @param {string | ArrayBuffer | Uint8Array} s
     * @returns {Uint8Array}
     */
    function decodeHex(s) {
        if (isBytes(s))
            return toU8Arr(s)
        if (s.startsWith('0x'))
            s = s.substr(2, s.length - 2)
        assert(s.length % 2 === 0, 'invalid char');
        const ret = new Uint8Array(s.length / 2);
        for (let i = 0; i < s.length / 2; i++) {
            const h = s.charCodeAt(i * 2);
            const l = s.charCodeAt(i * 2 + 1);
            ret[i] = (hexToInt(h) << 4) + hexToInt(l);
        }
        return ret;
    }

    /**
     * 判断是否是合法的十六进制字符串，不能以 0x 开头
     * @param {string} hex
     * @returns {boolean}
     */
    function isHex(hex) {
        if (hex.length % 2 !== 0)
            return false
        hex = hex.toLowerCase()
        for (let i = 0; i < hex.length; i++) {
            const code = hex.charCodeAt(i)
            if ((code >= 48 && code <= 57) || (code >= 97 && code <= 102)) {
            } else {
                return false
            }
        }
        return true
    }

    /**
     * convert bytes like objects to hex string 十六进制编码
     * @param {string | ArrayBuffer | Uint8Array } s 
     * @returns {string}
     */
    function bin2hex(s) {
        if (typeof s === 'string' && s.startsWith('0x')) {
            s = s.substr(2)
        }
        if (typeof s === 'string') {
            assert(isHex(s), `invalid hex string ${s}`)
        }
        if (isBytes(s))
            return encodeHex(s)
        return s
    }

    /**
     * convert digital like objects to digital string 转成十进制表示的字符串
     * @param {string | BN | number } s
     * @returns {string}
     */
    function asDigitalNumberText(s) {
        if (typeof s === 'string') {
            if (s.startsWith('0x'))
                s = new BN(s.substr(2), 16)
            else
                return s
        }
        return s.toString(10)
    }

    class TypeDef {
        /**
         *
         * @param {string} type
         * @param {string} name
         */
        constructor(type, name) {
            type = type && type.toLowerCase()
            assert(
                type === ABI_DATA_TYPE.STRING
                || type === ABI_DATA_TYPE.U64
                || type === ABI_DATA_TYPE.ADDRESS
                || type === ABI_DATA_TYPE.BYTES
                || type === ABI_DATA_TYPE.U256
                || type === ABI_DATA_TYPE.BOOL
                || type === ABI_DATA_TYPE.I64
                || type === ABI_DATA_TYPE.F64,
                `invalid abi type def name = ${name} type = ${type}`
            )
            this.type = type
            this.name = name
        }

        /**
         *
         * @param {Object} o
         * @return {TypeDef}
         */
        static from(o) {
            return new TypeDef(o.type, o.name)
        }
    }

    class ABI {
        /**
         *
         * @param {string} name
         * @param {string} type
         * @param {Array<TypeDef> } inputs
         * @param {Array<TypeDef>} outputs
         */
        constructor(name, type, inputs, outputs) {
            type = type && type.toLowerCase()
            assert(name, 'expect name of abi')
            assert(type === ABI_TYPE.FUNCTION || type === ABI_TYPE.EVENT, `invalid abi type ${type}`)
            assert(!inputs || Array.isArray(inputs), `invalid inputs ${inputs}`)
            assert(!outputs || Array.isArray(outputs), `invalid inputs ${outputs}`)

            this.name = name
            this.type = type
            this.inputs = (inputs || []).map(TypeDef.from)
            this.outputs = (outputs || []).map(TypeDef.from)
        }

        static from(o) {
            return new ABI(o.name, o.type, o.inputs, o.outputs)
        }

        returnsObj() {
            return this.outputs.every(v => v.name) && (
                (new Set(this.outputs.map(v => v.name))).size === this.outputs.length
            )
        }

        inputsObj() {
            return this.inputs.every(v => v.name) && (
                (new Set(this.inputs.map(v => v.name))).size === this.inputs.length
            )
        }

        toObj(arr, input) {
            const p = input ? this.inputs : this.outputs
            const o = {}
            for (let i = 0; i < p.length; i++) {
                o[p[i].name] = arr[i]
            }
            return o
        }

        toArr(obj, input) {
            const p = input ? this.inputs : this.outputs
            const arr = []
            for (let i = 0; i < p.length; i++) {
                arr.push(obj[p[i].name])
            }
            return arr
        }
    }

    function normalizeParams(params){
        if(params === null || params === undefined)
            return []
        if(typeof params === 'string' || typeof params === 'boolean' || typeof params === 'number' || params instanceof ArrayBuffer || params instanceof Uint8Array || params instanceof BN)  
            return [params]  
        return params    
    }

    /**
     * 
     * @param {Array<TypeDef>} outputs
     * @param {string | ArrayBuffer | Array<Uint8Array> | Uint8Array} buf 
     */
    function abiDecode(outputs, buf) {
        if (!buf)
            buf = ''
        if (typeof buf === 'string')
            buf = decodeHex(buf)
        if (buf.length === 0)
            return []

        const arr = Array.isArray(buf) ? buf : RLP.decode(buf)

        const returnObject =
            outputs.every(v => v.name) && (
                (new Set(outputs.map(v => v.name))).size === outputs.length
            )

        if (arr.length != outputs.length)
            throw new Error(`abi decode failed , expect ${outputs.length} returns while ${arr.length} found`)

        const ret = returnObject ? {} : []
        for (let i = 0; i < arr.length; i++) {
            const t = outputs[i].type
            const name = outputs[i].name
            let val
            switch (t) {
                case ABI_DATA_TYPE.BYTES:
                case ABI_DATA_TYPE.ADDRESS: {
                    val = encodeHex(arr[i])
                    break
                }
                case ABI_DATA_TYPE.U256:
                case ABI_DATA_TYPE.U64: {
                    val = new BN(arr[i], 'be')
                    if (t === ABI_DATA_TYPE.U64)
                        assert(val.cmp(MAX_U64) <= 0, `${val.toString(10)} overflows max u64 ${MAX_U64.toString(10)}`)
                    if (t === ABI_DATA_TYPE.U256)
                        assert(val.cmp(MAX_U256) <= 0, `${val.toString(10)} overflows max u256 ${MAX_U256.toString(10)}`)
                    val = toSafeInt(val)
                    break
                }
                case ABI_DATA_TYPE.I64: {
                    const padded = padPrefix(arr[i], 0, 8)
                    const isneg = padded[0] & 0x80;
                    if (!isneg) {
                        val = new BN(arr[i], 'be')
                    } else {
                        val = new BN(inverse(padded), 'be')
                        val = val.add(ONE)
                        val = val.neg()
                    }
                    val = toSafeInt(val)
                    break
                }
                case ABI_DATA_TYPE.F64: {
                    val = bytesToF64(arr[i])
                    break
                }
                case ABI_DATA_TYPE.STRING: {
                    val = bin2str(arr[i])
                    break
                }
                case ABI_DATA_TYPE.BOOL: {
                    val = arr[i].length > 0
                    break
                }
            }
            if (returnObject)
                ret[name] = val
            else
                ret[i] = val
        }
        return ret
    }

    class Transaction {
        /**
         * constructor of transaction
         * @param {string | number | BN} [version]
         * @param {string | number | BN} [type]
         * @param {string | number | BN} [createdAt]
         * @param {string | number | BN} [nonce]
         * @param {string | Uint8Array | ArrayBuffer} [from]
         * @param {string | BN | number } [gasLimit]
         * @param {string | number | BN} [gasPrice]
         * @param {string | number | BN} [amount]
         * @param {string | Uint8Array | ArrayBuffer } [payload]
         * @param {string | Uint8Array | ArrayBuffer} [to]
         * @param {string | Uint8Array | ArrayBuffer } [signature]
         * @param { Array<ABI> } [__abi] abi 
         * @param { Array | Object } [__inputs] inputs
         */
        constructor(version, type, createdAt, nonce, from, gasLimit, gasPrice, amount, payload, to, signature, __abi, __inputs) {
            if (typeof createdAt === 'string' && isNaN(createdAt)) {
                try {
                    createdAt = (new Date(createdAt).valueOf()) / 1000
                } catch (ignored) {

                }
            }
            this.version = asDigitalNumberText(version || 0)
            this.type = asDigitalNumberText(type || 0)
            this.createdAt = asDigitalNumberText(createdAt || 0)
            this.nonce = asDigitalNumberText(nonce || 0)
            this.from = bin2hex(from || '')
            this.gasLimit = asDigitalNumberText(gasLimit || 0)
            this.gasPrice = asDigitalNumberText(gasPrice || 0)
            this.amount = asDigitalNumberText(amount || 0)
            this.payload = bin2hex(payload || '')
            this.to = bin2hex(to || '')
            this.signature = bin2hex(signature || '')
            this.__abi = __abi
            this.__inputs = __inputs
        }

        static from(o) {
            return new Transaction(o.version, o.type, o.createdAt, o.nonce, o.from, o.gasLimit, o.gasPrice, o.amount, o.payload, o.to, o.signature)
        }

        /**
         * 计算事务哈希值
         * @returns { string } 哈希值
         */
        getHash() {
            const buf = this.getSignaturePlain()
            return sm3(buf)
        }

        /**
         * 获得事务签名原文
         * @returns { Uint8Array }
         */
        getSignaturePlain() {
            const arr = [
                convert(this.version || 0, ABI_DATA_TYPE.U64),
                convert(this.type || 0, ABI_DATA_TYPE.U64),
                convert(this.createdAt || '0', ABI_DATA_TYPE.U64),
                convert(this.nonce || '0', ABI_DATA_TYPE.U64),
                convert(this.from || EMPTY_BYTES, ABI_DATA_TYPE.BYTES),
                convert(this.gasLimit || '0', ABI_DATA_TYPE.U64),
                convert(this.gasPrice || '0', ABI_DATA_TYPE.U256),
                convert(this.amount || '0', ABI_DATA_TYPE.U256),
                convert(this.payload || EMPTY_BYTES, ABI_DATA_TYPE.BYTES),
                convert(this.to || EMPTY_BYTES, ABI_DATA_TYPE.ADDRESS)
            ]
            return RLP.encode(arr)
        }

        __setInputs(__inputs) {
            const cnv = (x) => {
                if (x instanceof ArrayBuffer || x instanceof Uint8Array)
                    return encodeHex(x)
                if (x instanceof BN)
                    return toSafeInt(x)
                return x
            }
            if (Array.isArray(__inputs)) {
                this.__inputs = __inputs.map(cnv)
            } else {
                this.__inputs = {}
                for (let k of Object.keys(__inputs)) {
                    this.__inputs[k] = cnv(__inputs[k])
                }
            }
            if (Array.isArray(this.__inputs)) {
                const c = new Contract('', this.__abi)
                const a = c.getABI(this.getMethod(), ABI_TYPE.FUNCTION)
                if (a.inputsObj()) {
                    this.__inputs = a.toObj(this.__inputs, true)
                }
            }
        }

        getMethod() {
            const t = parseInt(this.type)
            return t === constants.DEPLOY ? 'init' : bin2str((RLP.decode(decodeHex(this.payload)))[0])
        }

        isDeployOrCall() {
            const t = parseInt(this.type)
            return t === constants.DEPLOY || t === constants.CONTRACT_CALL
        }

        isBuiltInCall() {
            return this.isDeployOrCall() &&
                (this.to === constants.PEER_AUTHENTICATION_ADDR || this.to === constants.POA_AUTHENTICATION_ADDR
                    || this.to == constants.POS_CONTRACT_ADDR)
        }
    }

    /**
     *
     * @param s
     * @returns {boolean}
     */
    function isBytes(s) {
        return s instanceof Uint8Array || s instanceof ArrayBuffer
    }

    /**
     * convert uint8array or array buffer to uint8 array
     * @param {Uint8Array | ArrayBuffer} data
     * @returns {Uint8Array}
     */
    function toU8Arr(data) {
        assert(isBytes(data), `${data} is not uint8array or arraybuffer`)
        if (data instanceof ArrayBuffer)
            return new Uint8Array(data)
        return data
    }

    /**
     * 字节数组转 number
     * @param {Uint8Array | ArrayBuffer} bytes
     * @returns {number}
     */
    function byteArrayToInt(bytes) {
        bytes = toU8Arr(bytes)
        let ret = 0;
        for (let i = 0; i < bytes.length; i++) {
            const u = bytes[bytes.length - i - 1];
            ret += (u << (i * 8))
        }
        return ret;
    }

    /**
     * 十六进制字符串编码
     * @param { ArrayBuffer | Uint8Array } buf binary
     * @returns {string} encoded result
     */
    function encodeHex(buf) {
        buf = toU8Arr(buf)
        let out = "";
        for (let i = 0; i < buf.length; i++) {
            let n = buf[i].toString(16)
            if (n.length === 1)
                n = '0' + n
            out += n
        }
        return out;
    }

    /**
     * decode binary as utf8 string
     * @param { Uint8Array | ArrayBuffer } bin
     * @returns {string} decoded result
     */
    function bin2str(bin) {
        bin = toU8Arr(bin)
        if (isBrowser)
            return new TextDecoder().decode(bin)
        return Buffer.from(bin).toString('utf8')
    }

    /**
     * convert string to binary
     * @param { string } str
     * @returns {Uint8Array}
     */
    function str2bin(str) {
        if (isBrowser)
            return new TextEncoder().encode(str)
        return Buffer.from(str, 'utf8')
    }

    /**
     * pad prefix to size
     * @param { Uint8Array } arr
     * @param {number} prefix
     * @param {number} size
     */
    function padPrefix(arr, prefix, size) {
        if (arr.length >= size)
            return arr
        const ret = new Uint8Array(size)
        for (let i = 0; i < ret.length; i++) {
            ret[i + size - arr.length] = arr[i]
        }
        if (prefix === 0)
            return ret
        for (let i = 0; i < size - arr.length; i++)
            ret[i] = prefix
    }

    /**
     * number 转字节数组
     * @param {number} u
     * @returns {Uint8Array}
     */
    function numberToByteArray(u) {
        if (u < 0 || !Number.isInteger(u))
            throw new Error(`cannot convert number ${u} to byte array`)
        const buf = new Uint8Array(8);
        for (let i = 0; i < 8; i++) {
            buf[buf.length - 1 - i] = u & 0xff;
            u = u >>> 8;
        }
        let k = 8;
        for (let i = 0; i < 8; i++) {
            if (buf[i] !== 0) {
                k = i;
                break;
            }
        }
        return buf.slice(k, buf.length);
    }


    function reverse(arr) {
        const ret = new Uint8Array(arr.length)
        for (let i = 0; i < arr.length; i++) {
            ret[i] = arr[arr.length - i - 1]
        }
        return ret
    }

    /**
     * 浮点数转字节数组
     * @param {Uint8Array} arr 
     */
    function f64ToBytes(f) {
        let buf = new ArrayBuffer(8);
        let float = new Float64Array(buf);
        float[0] = f;
        buf = new Uint8Array(buf)
        return trimLeadingZeros(reverse(buf))
    }

    /**
     * 字节数组转浮点数
     * @param {Uint8Array} buf 
     */
    function bytesToF64(buf) {
        return new Float64Array(padPrefix(reverse(buf), 0, 8).buffer)[0]
    }


    /**
     * 对字节数组取反
     * @param {Uint8Array} arr 
     */
    function inverse(arr) {
        const ret = new Uint8Array(arr.length)
        for (let i = 0; i < ret.length; i++) {
            ret[i] = (~arr[i] & 0xff)
        }
        return ret
    }

    function isRLPList(encoded) {
        return encoded[0] >= OFFSET_SHORT_LIST;
    }


    /**
     * encode bytes to rlp
     * @param { ArrayBuffer | Uint8Array } bytes
     * @returns { Uint8Array }
     */
    function encodeBytes(bytes) {
        if (bytes instanceof ArrayBuffer)
            bytes = new Uint8Array(bytes)
        if (bytes.length === 0) {
            const ret = new Uint8Array(1);
            ret[0] = OFFSET_SHORT_ITEM;
            return ret;
        }
        if (bytes.length === 1 && (bytes[0] & 0xFF) < OFFSET_SHORT_ITEM) {
            return bytes;
        }
        if (bytes.length < SIZE_THRESHOLD) {
            // length = 8X
            const prefix = OFFSET_SHORT_ITEM + bytes.length;
            const ret = new Uint8Array(bytes.length + 1);
            for (let i = 0; i < bytes.length; i++) {
                ret[i + 1] = bytes[i];
            }
            ret[0] = prefix;
            return ret;
        }
        let tmpLength = bytes.length;
        let lengthOfLength = 0;
        while (tmpLength !== 0) {
            lengthOfLength = lengthOfLength + 1;
            tmpLength = tmpLength >> 8;
        }

        const ret = new Uint8Array(1 + lengthOfLength + bytes.length);
        ret[0] = OFFSET_LONG_ITEM + lengthOfLength;

        // copy length after first byte
        tmpLength = bytes.length;
        for (let i = lengthOfLength; i > 0; --i) {
            ret[i] = (tmpLength & 0xFF);
            tmpLength = tmpLength >> 8;
        }
        for (let i = 0; i < bytes.length; i++) {
            ret[i + 1 + lengthOfLength] = bytes[i]
        }
        return ret;
    }

    /**
     * encode elements to rlp list
     * @param { Array<Uint8Array> } elements
     * @returns { Uint8Array } rlp encoded
     */
    function encodeElements(elements) {
        let totalLength = 0;
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            totalLength += el.length;
        }
        let data;
        let copyPos;
        if (totalLength < SIZE_THRESHOLD) {
            data = new Uint8Array(1 + totalLength);
            data[0] = OFFSET_SHORT_LIST + totalLength;
            copyPos = 1;
        } else {
            // length of length = BX
            // prefix = [BX, [length]]
            let tmpLength = totalLength;
            let byteNum = 0;
            while (tmpLength !== 0) {
                ++byteNum;
                tmpLength = tmpLength >> 8;
            }
            tmpLength = totalLength;
            let lenBytes = new Uint8Array(byteNum);
            for (let i = 0; i < byteNum; ++i) {
                lenBytes[byteNum - 1 - i] = ((tmpLength >> (8 * i)) & 0xFF);
            }
            // first byte = F7 + bytes.length
            data = new Uint8Array(1 + lenBytes.length + totalLength);
            data[0] = OFFSET_LONG_LIST + byteNum;
            for (let i = 0; i < lenBytes.length; i++) {
                data[i + 1] = lenBytes[i];
            }
            copyPos = lenBytes.length + 1;
        }
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            for (let j = 0; j < el.length; j++) {
                data[j + copyPos] = el[j];
            }
            copyPos += el.length;
        }
        return data;
    }

    /**
     *
     * @param {Array<Uint8Array> | Uint8Array}x
     * @param { Uint8Array } [y]
     * @returns {Uint8Array}
     */
    function concatBytes(x, y) {
        if (Array.isArray(x)) {
            assert(y === undefined, `concat bytes failed, y is not allowed here`)
            let ret = EMPTY_BYTES;
            for (let el of x)
                ret = concatBytes(ret, el)
            return ret
        }
        if (!y)
            return x
        x = toU8Arr(x)
        y = toU8Arr(y)
        const ret = new Uint8Array(x.length + y.length);
        for (let i = 0; i < x.length; i++) {
            ret[i] = x[i]
        }
        for (let i = 0; i < y.length; i++) {
            ret[x.length + i] = y[i]
        }
        return ret
    }

    function copyOfRange(bytes, from, to) {
        const ret = new Uint8Array(to - from);
        let j = 0;
        for (let i = from; i < to; i++) {
            ret[j] = bytes[i];
            j++;
        }
        return ret;
    }

    function estimateSize(encoded) {
        const parser = new RLPParser(encoded, 0, encoded.length);
        return parser.peekSize();
    }

    function validateSize(encoded) {
        assert(encoded.length === estimateSize(encoded), 'invalid rlp format');
    }


    class RLP {

        /**
         * rlp encode
         * @param {string} s
         * @return {Uint8Array}
         */
        static encodeString(s) {
            return encodeBytes(str2bin(s))
        }


        /**
         * rlp encode
         * @param {Uint8Array | ArrayBuffer} bytes
         * @return {Uint8Array}
         */
        static encodeBytes(bytes) {
            return encodeBytes(bytes);
        }

        /**
         *
         * @param { Uint8Array | string | Array | ArrayBuffer | number | BN | null} o
         */
        static encode(o) {
            if (o === null || o === undefined)
                return NULL_RLP
            if (o instanceof ArrayBuffer)
                o = new Uint8Array(o)
            if (typeof o === 'string')
                return RLP.encodeString(o)
            if (typeof o === 'number') {
                assert(o >= 0 && Number.isInteger(o), `${o} is not a valid non-negative integer`)
                return RLP.encodeBytes(numberToByteArray(o))
            }
            if (o instanceof BN) {
                return RLP.encodeBytes(trimLeadingZeros(o.toArrayLike(Uint8Array, 'be')))
            }
            if (o instanceof Uint8Array)
                return RLP.encodeBytes(o)
            if (Array.isArray(o)) {
                const elements = o.map(RLP.encode)
                return encodeElements(elements)
            }
        }


        /**
         * decode
         * @param { ArrayBuffer | Uint8Array } encoded encoded rlp bytes
         * @returns { Array | Uint8Array }
         */
        static decode(encoded) {
            if (encoded instanceof ArrayBuffer)
                encoded = new Uint8Array(encoded)
            validateSize(encoded);
            if (!isRLPList(encoded)) {
                const parser = new RLPParser(encoded, 0, encoded.length);
                if (encoded.length === 1 && encoded[0] === 0x80)
                    return EMPTY_BYTES;
                if (parser.remained() > 1) {
                    parser.skip(parser.prefixLength());
                }
                return parser.bytes(parser.remained());
            }
            const parser = new RLPParser(encoded, 0, encoded.length);
            parser.skip(parser.prefixLength());
            const ret = [];
            while (parser.remained() > 0) {
                ret.push(RLP.decode(parser.bytes(parser.peekSize())));
            }
            return ret;
        }
    }

    class RLPParser {
        constructor(buf, offset, limit) {
            this.buf = buf;
            this.offset = offset;
            this.limit = limit;
        }

        prefixLength() {
            const prefix = this.buf[this.offset];
            if (prefix <= OFFSET_LONG_ITEM) {
                return 1;
            }
            if (prefix < OFFSET_SHORT_LIST) {
                return 1 + (prefix - OFFSET_LONG_ITEM);
            }
            if (prefix <= OFFSET_LONG_LIST) {
                return 1;
            }
            return 1 + (prefix - OFFSET_LONG_LIST);
        }

        remained() {
            return this.limit - this.offset;
        }

        skip(n) {
            this.offset += n;
        }

        peekSize() {
            const prefix = this.buf[this.offset];
            if (prefix < OFFSET_SHORT_ITEM) {
                return 1;
            }
            if (prefix <= OFFSET_LONG_ITEM) {
                return prefix - OFFSET_SHORT_ITEM + 1;
            }
            if (prefix < OFFSET_SHORT_LIST) {
                return byteArrayToInt(
                    copyOfRange(this.buf, 1 + this.offset, 1 + this.offset + prefix - OFFSET_LONG_ITEM)
                ) + 1 + prefix - OFFSET_LONG_ITEM;
            }
            if (prefix <= OFFSET_LONG_LIST) {
                return prefix - OFFSET_SHORT_LIST + 1;
            }
            return byteArrayToInt(
                copyOfRange(this.buf, 1 + this.offset, this.offset + 1 + prefix - OFFSET_LONG_LIST)
            )
                + 1 + prefix - OFFSET_LONG_LIST;
        }

        u8() {
            const ret = this.buf[this.offset];
            this.offset++;
            return ret;
        }

        bytes(n) {
            assert(this.offset + n <= this.limit, 'read overflow');
            const ret = this.buf.slice(this.offset, this.offset + n);
            this.offset += n;
            return ret;
        }
    }

    const ABI_DATA_TYPE = {
        BOOL: 'bool', // 0
        I64: 'i64',  // 1
        U64: 'u64', //  2 BN
        F64: 'f64',
        STRING: 'string', // 3 string
        BYTES: 'bytes', // 4
        ADDRESS: 'address', // 5
        U256: 'u256'// 6
    }

    const ABI_DATA_ENUM = {
        'bool': 0, // 0
        'i64': 1,  // 1
        'u64': 2, //  2 BN
        'f64': 3,
        'string': 4, // 3 string
        'bytes': 5, // 4
        'address': 6, // 5
        'u256': 7, // 6
        'void': 8
    }

    const ABI_TYPE = {
        EVENT: 'event',
        FUNCTION: 'function'
    }

    /**
     *
     * @param {string | Uint8Array | number | BN | ArrayBuffer} o before abi encode
     * @param type encode target
     * @returns { Uint8Array | string | BN }
     */
    function convert(o, type) {
        if (o instanceof ArrayBuffer)
            o = toU8Arr(o)
        if (o instanceof Uint8Array) {
            switch (type) {
                case ABI_DATA_TYPE.BOOL:
                case ABI_DATA_TYPE.U256:
                case ABI_DATA_TYPE.I64:
                case ABI_DATA_TYPE.U64:
                case ABI_DATA_TYPE.F64: {
                    throw new Error('cannot convert uint8array to u64, u256 or bool')
                }
                case ABI_DATA_TYPE.STRING: {
                    throw new Error('cannot convert uint8array to string')
                }
                case ABI_DATA_TYPE.ADDRESS:
                case ABI_DATA_TYPE.BYTES: {
                    return o
                }
            }
            throw new Error("unexpected abi type " + type)
        }

        if (typeof o === 'string') {
            switch (type) {
                case ABI_DATA_TYPE.U256:
                case ABI_DATA_TYPE.U64: {
                    let ret;
                    if (o.substr(0, 2) === '0x') {
                        ret = new BN(o.substr(2, o.length - 2), 16)
                    } else {
                        ret = new BN(o, 10)
                    }
                    if (type === ABI_DATA_TYPE.U64)
                        assert(ret.cmp(MAX_U64) <= 0, `${ret.toString(10)} overflows max u64 ${MAX_U64.toString(10)}`)
                    if (type === ABI_DATA_TYPE.U256)
                        assert(ret.cmp(MAX_U256) <= 0, `${ret.toString(10)} overflows max u256 ${MAX_U256.toString(10)}`)
                    return ret
                }
                case ABI_DATA_TYPE.I64: {
                    if (o.substr(0, 2) === '0x') {
                        let ret = new BN(o.substr(2, o.length - 2), 16)
                        assert(ret.cmp(MAX_I64) <= 0, `${ret.toString(10)} overflows max i64 ${MAX_I64.toString(10)}`)
                        assert(ret.cmp(MIN_I64) >= 0, `${ret.toString(10)} overflows min i64 ${MIN_I64.toString(10)}`)
                        return ret
                    }
                    return convert(parseInt(o), ABI_DATA_TYPE.I64)
                }
                case ABI_DATA_TYPE.F64: {
                    let f = parseFloat(o)
                    return f64ToBytes(f)
                }
                case ABI_DATA_TYPE.STRING: {
                    return o
                }
                case ABI_DATA_TYPE.BOOL: {
                    let l = o.toLowerCase()
                    if ('true' === l)
                        return 1
                    if ('false' === l)
                        return 0
                    if (isNaN(o))
                        throw new Error(`cannot convert ${o} to bool`)
                    l = parseInt(o)
                    if (1 === l || 0 === l)
                        return l
                    throw new Error(`convert ${l} to bool failed, provide 1 or 0`)
                }
                case ABI_DATA_TYPE.BYTES:
                case ABI_DATA_TYPE.ADDRESS: {
                    return decodeHex(o)
                }
            }
            throw new Error("unexpected abi type " + type)
        }

        if (typeof o === 'number') {
            switch (type) {
                case ABI_DATA_TYPE.U256:
                case ABI_DATA_TYPE.U64: {
                    if (o < 0 || !Number.isInteger(o))
                        throw new Error('o is negative or not a integer')
                    return new BN(o)
                }
                case ABI_DATA_TYPE.STRING: {
                    return o.toString(10)
                }
                case ABI_DATA_TYPE.BOOL: {
                    if (1 === o || 0 === o)
                        return o
                    throw new Error(`convert ${o} to bool failed, provide 1 or 0`)
                }
                case ABI_DATA_TYPE.BYTES:
                case ABI_DATA_TYPE.ADDRESS: {
                    throw new Error("cannot convert number to address or bytes")
                }
                case ABI_DATA_TYPE.I64: {
                    if (!Number.isInteger(o))
                        throw new Error('o is negative or not a integer')
                    if (o >= 0)
                        return new BN(o)
                    return convert(new BN(o), ABI_DATA_TYPE.I64)
                }
                case ABI_DATA_TYPE.F64: {
                    return f64ToBytes(o)
                }
            }
            throw new Error("unexpected abi type " + type)
        }

        if (o instanceof BN) {
            switch (type) {
                case ABI_DATA_TYPE.U256:
                case ABI_DATA_TYPE.U64: {
                    return o;
                }
                case ABI_DATA_TYPE.STRING: {
                    return o.toString(10)
                }
                case ABI_DATA_TYPE.BYTES:
                case ABI_DATA_TYPE.ADDRESS: {
                    throw new Error("cannot convert big number to address or bytes")
                }
                case ABI_DATA_TYPE.BOOL: {
                    if (o.cmp(1) === 0 || o.cmp(1) === 0)
                        return o
                    throw new Error(`convert ${o} to bool failed, provide 1 or 0`)
                }
                case ABI_DATA_TYPE.I64: {
                    assert(o.cmp(MAX_I64) <= 0, `${o.toString(10)} overflows max i64 ${MAX_I64.toString(10)}`)
                    assert(o.cmp(MIN_I64) >= 0, `${o.toString(10)} overflows min i64 ${MIN_I64.toString(10)}`)
                    if (o.cmp(new BN(0)) >= 0)
                        return ret
                    let buf = o.neg().toArray(Uint8Array, 8)
                    buf = inverse(buf)
                    return new BN(buf, 'be').add(ONE)
                }
                case ABI_DATA_TYPE.F64: {
                    return f64ToBytes(o.toNumber())
                }
            }
            throw new Error("unexpected abi type " + type)
        }

        if (typeof o === 'boolean') {
            switch (type) {
                case ABI_DATA_TYPE.U256:
                case ABI_DATA_TYPE.I64:
                case ABI_DATA_TYPE.U64: {
                    return o ? 1 : 0;
                }
                case ABI_DATA_TYPE.STRING: {
                    return o.toString()
                }
                case ABI_DATA_TYPE.BYTES:
                case ABI_DATA_TYPE.ADDRESS: {
                    throw new Error("cannot convert boolean to address or bytes")
                }
                case ABI_DATA_TYPE.BOOL: {
                    return o ? 1 : 0
                }
                case ABI_DATA_TYPE.F64: {
                    return f64ToBytes(o ? 1 : 0)
                }
            }
            throw new Error("unexpected abi type " + type)
        }

        throw new Error("unexpected type " + o)
    }

    class Contract {
        /**
         *
         * @param {string} address 合约地址
         * @param { Array<ABI> } abi 合约的 abi
         * @param {Uint8Array} [binary] 合约字节码
         */
        constructor(address, abi, binary) {
            this.address = address
            this.abi = (abi || []).map(ABI.from)
            this.binary = binary
        }

        /**
         *
         * @param {string} name 调用方法名称
         * @param { Array | Object } li 参数列表
         * @returns { Array } rlp 编码后的参数
         */
        abiEncode(name, li) {
            const func = this.getABI(name, ABI_TYPE.FUNCTION)
            let retType = func.outputs && func.outputs[0] && func.outputs[0].type
            const retTypes = retType ? [ABI_DATA_ENUM[retType]] : []

            if (typeof li === 'string' || typeof li === 'number' || li instanceof BN || li instanceof ArrayBuffer || li instanceof Uint8Array || typeof li === 'boolean')
                return this.abiEncode([li])

            if (li === undefined || li === null)
                return [[], [], retTypes]


            if (Array.isArray(li)) {
                const arr = []
                const types = []
                if (li.length != func.inputs.length)
                    throw new Error(`abi encode failed for ${func.name}, expect ${func.inputs.length} parameters while ${li.length} found`)
                for (let i = 0; i < li.length; i++) {
                    arr[i] = convert(li[i], func.inputs[i].type)
                    types[i] = ABI_DATA_ENUM[func.inputs[i].type]
                }
                return [types, arr, retTypes]
            }

            const arr = []
            const types = []
            for (let i = 0; i < func.inputs.length; i++) {
                const input = func.inputs[i]
                types[i] = ABI_DATA_ENUM[func.inputs[i].type]
                if (!(input.name in li)) {
                    throw new Error(`key ${input.name} not found in parameters`)
                }
                arr[i] = convert(li[input.name], input.type)
            }
            return [types, arr, retTypes]
        }

        /**
         *
         * @param name {string} 方法名称
         * @param buf { Uint8Array | string | Array<Uin8Array> }
         * @returns { Array | Object } rlp 解码后的参数列表
         * @param {string} [type] 类型
         */
        abiDecode(name, buf, type) {
            type = type || ABI_TYPE.FUNCTION
            if (!buf)
                buf = ''
            if (typeof buf === 'string')
                buf = decodeHex(buf)
            if (buf.length === 0)
                return []

            const a = this.getABI(name, type)
            const ret = abiDecode(a.outputs, buf)
            if (type === ABI_TYPE.FUNCTION)
                return ret && ret[0]
            return ret
        }

        /**
         * 合约部署的 paylod
         */
        abiToBinary() {
            const ret = []
            for (let a of this.abi) {
                ret.push([a.name, a.type === ABI_TYPE.FUNCTION ? 0 : 1, a.inputs.map(x => ABI_DATA_ENUM[x.type]), a.outputs.map(x => ABI_DATA_ENUM[x.type])])
            }
            return ret
        }

        /**
         * 
         * @param {string} name 
         * @param {string} type 
         * @returns {ABI}
         */
        getABI(name, type) {
            const funcs = this.abi.filter(x => x.type === type && x.name === name)
            assert(funcs.length === 1, `exact exists one and only one abi ${name}, while found ${funcs.length}`)
            return funcs[0]
        }
    }


    class RPC {

        /**
         *
         * @param {string} host  主机名
         * @param {string | number} port  端口号
         */
        constructor(host, port) {
            this.host = host || 'localhost'
            this.port = port || 80

            this.__callbacks = new Map() // id -> function
            this.__id2key = new Map()// id -> address:event
            this.__id2hash = new Map()  // id -> txhash
            this.__eventHandlers = new Map() // address:event -> [id]
            this.__txObservers = new Map() // hash -> [id]
            this.__cid = 0
        }

        __tryConnect() {
            const WS = isBrowser ? WebSocket : require('ws')
            if (this.__ws && this.__ws.readyState === WS.OPEN) {
                return Promise.resolve(this)
            }

            if (this.__ws) {
                const fn = this.__ws.onopen || (() => { })
                const p = new Promise((rs, rj) => {
                    this.__ws.onopen = () => {
                        fn(this.__ws)
                        rs(this.__ws)
                    }
                })
                return p
            }
            this.__uuid = uuidv4()
            this.__ws = new WS(`ws://${this.host}:${this.port || 80}/websocket/${this.__uuid}`)
            this.__ws.onmessage = (e) => {
                if (!isBrowser) {
                    this.__handleData(e.data)
                    return
                }
                const reader = new FileReader();

                reader.onload = () => {
                    var arrayBuffer = reader.result
                    this.__handleData(new Uint8Array(arrayBuffer))
                };
                reader.readAsArrayBuffer(e.data)
            }
            const p = new Promise((rs, rj) => {
                this.__ws.onopen = rs
            }
            )
            return p
        }

        __handleData(data) {
            const decoded = RLP.decode(data)
            const i = new BN(decoded[0], 'be')
            switch (i.toString(10)) {
                case '0': {
                    const h = encodeHex(decoded[1])
                    const s = (new BN(decoded[2], 'be')).toNumber()
                    let d = null
                    if (s === TX_STATUS.DROPPED)
                        d = bin2str(decoded[3])
                    if (s === TX_STATUS.INCLUDED) {
                        const arr = decoded[3]
                        d = {
                            blockHeight: toSafeInt(arr[0]),
                            blockHash: encodeHex(arr[1]),
                            gasUsed: toSafeInt(arr[2]),
                            result: arr[3],
                            events: arr[4]
                        }
                    }
                    const funcIds = this.__txObservers.get(h) || []
                    for (const funcId of funcIds) {
                        const func = this.__callbacks.get(funcId)
                        func(h, s, d)
                    }
                    break
                }
                case '1': {
                    const addr = encodeHex(decoded[1])
                    const event = bin2str(decoded[2])
                    const funcIds = this.__eventHandlers.get(`${addr}:${event}`) || []
                    for (const funcId of funcIds) {
                        const func = this.__callbacks.get(funcId)
                        func(addr, event, decoded[3])
                    }
                    break
                }
            }
        }

        /**
         * 监听合约事件
         * @param {Contract} contract 合约
         * @param {string} event 事件
         * @param {Function} func 合约事件回调 {name: event, data: data}
         * @returns {number} 监听器的 id
         */
        listen(contract, event, func) {
            this.__tryConnect()
                .then(() => {
                    assert(contract.address, 'missing contract.address')
                    const addr = decodeHex(contract.address)
                    this.__subscribe(1, addr)
                    const id = ++this.__cid
                    const key = `${contract.address}:${event}`
                    this.__id2key.set(id, key)
                    const fn = (_, event, parameters) => {
                        const abiDecoded = contract.abiDecode(event, parameters, ABI_TYPE.EVENT)
                        func(abiDecoded)
                    }
                    if (!this.__eventHandlers.has(key))
                        this.__eventHandlers.set(key, new Set())

                    this.__eventHandlers.get(key).add(id)
                    this.__callbacks.set(id, fn)
                    return id
                })
        }


        /**
         * 移除监听器
         * @param {number} id 监听器的 id
         */
        removeListener(id) {
            const key = this.__id2key.get(id)
            const h = this.__id2hash.get(id)
            this.__callbacks.delete(id)
            this.__id2key.delete(id)
            this.__id2hash.delete(id)
            if (key) {
                const set = this.__eventHandlers.get(key)
                set && set.delete(id)
            }
            if (h) {
                const set = this.__txObservers.get(h)
                set && set.delete(id)
            }
        }

        listenOnce(contract, event, func) {
            const id = this.__cid + 1
            this.listen(contract, event, (p) => {
                func(p)
                this.removeListener(id)
            })
        }

        /**
         * 添加事务观察者，如果事务最终被确认或者异常终止，观察者会被移除
         * @param {string | Uint8Array | ArrayBuffer} hash 
         * @param { Function } cb  (hash, status, msg)
         * @returns {number}
         */
        observe(hash, cb) {
            this.__tryConnect()
                .then(() => {
                    this.__subscribe(0, decodeHex(hash))
                })
            const id = ++this.__cid
            if (isBytes(hash))
                hash = encodeHex(hash)

            hash = hash.toLowerCase()
            if (!this.__txObservers.has(hash))
                this.__txObservers.set(hash, new Set())
            this.__id2hash.set(id, hash)
            this.__txObservers.get(hash).add(id)

            const fn = (h, s, d) => {
                cb(h, s, d)
                switch (s) {
                    case TX_STATUS.DROPPED:
                    case TX_STATUS.CONFIRMED:
                        this.removeListener(id)
                        break
                }
            }
            this.__callbacks.set(id, fn)
            return id
        }


        /**
         * 查看合约方法
         * @param  { Contract } contract 合约
         * @param {string} method  查看的方法
         * @param { Object | Array } parameters  额外的参数，字节数组，参数列表
         * @returns {Promise<Object>}
         */
        viewContract(contract, method, parameters) {
            if (!contract instanceof Contract)
                throw new Error('create a instanceof Contract by new tool.Contract(addr, abi)')


            parameters = normalizeParams(parameters)
            const addr = contract.address
            const params = contract.abiEncode(method, parameters)

            return viewContract(this.host, this.port, addr, method, params)
                .then(r => contract.abiDecode(method, r))
        }

        /**
         * 发送事务
         * @param tx {Object | Array}事务
         * @returns {Promise<Object>}
         */
        sendTransaction(tx) {
            return sendTransaction(this.host, this.port, tx)
        }

        /**
         * 
         * @param { Transaction } tx 
         * @param { number } timeout 
         */
        __observeTx(tx, status, timeout) {
            status = status || TX_STATUS.CONFIRMED
            return new Promise((resolve, reject) => {
                let success = false

                if (timeout)
                    setTimeout(() => {
                        if (success) return
                        reject({ reason: 'timeout' })
                    }, timeout)

                let ret = null
                let confirmed = false
                let included = false

                this.observe(tx.getHash(), (h, s, d) => {
                    if (s === TX_STATUS.DROPPED) {
                        const e = { hash: h, reason: d }
                        reject(e)
                        return
                    }
                    if (s === TX_STATUS.CONFIRMED) {
                        if (status == TX_STATUS.INCLUDED)
                            return
                        confirmed = true
                        if (included) {
                            success = true
                            resolve(ret)
                            return
                        }
                    }
                    if (s === TX_STATUS.INCLUDED) {
                        included = true
                        ret = {
                            blockHeight: d.blockHeight,
                            blockHash: d.blockHash,
                            gasUsed: d.gasUsed,
                        }
                        if (d.result && d.result.length
                            && tx.__abi
                            && tx.isDeployOrCall()
                            && (!tx.isBuiltInCall())) {
                            const decoded = (new Contract('', tx.__abi)).abiDecode(tx.getMethod(), d.result)
                            ret.result = decoded
                        }

                        if (
                            d.events.length
                            && tx.__abi) {
                            const events = []
                            for (let e of d.events) {
                                const name = bin2str(e[0])
                                const decoded = (new Contract('', tx.__abi)).abiDecode(name, e[1], ABI_TYPE.EVENT)
                                events.push({ name: name, data: decoded })
                            }
                            ret.events = events
                        }

                        ret.transactionHash = tx.getHash()
                        ret.fee = toSafeInt((new BN(tx.gasPrice).mul(new BN(ret.gasUsed))))
                        if (tx.isDeployOrCall()) {
                            ret.method = tx.getMethod()
                            ret.inputs = tx.__inputs
                        }

                        if (status == TX_STATUS.INCLUDED) {
                            success = true
                            resolve(ret)
                            return
                        }

                        if (confirmed) {
                            success = true
                            resolve(ret)
                            return
                        }
                    }
                })
            })
        }

        __subscribe(code, key) {
            return this.__tryConnect()
                .then((b) => {
                    if (!b)
                        return
                    this.__ws.send(RLP.encode([code, key]))
                })
        }

        /**
         * 发送事务的同时监听事务的状态
         * @param { Transaction | Array<Transaction> } tx 
         * @returns { Promise<Transaction> } 
         */
        sendAndObserve(tx, status, timeout) {
            let ret
            let p
            if (Array.isArray(tx)) {
                p = []
                const arr = []
                for (const t of tx) {
                    arr.push(this.__observeTx(t, status, timeout))
                    p.push(this.__subscribe(0, decodeHex(t.getHash())))
                }
                p = Promise.all(p)
                ret = Promise.all(arr)
            } else {
                ret = this.__observeTx(tx, status, timeout)
                p = this.__subscribe(0, decodeHex(tx.getHash()))
            }
            p.then(() => this.sendTransaction(tx))
            return ret
        }

        /**
         * 查看区块头
         * @param hashOrHeight {string | number} 区块哈希值或者区块高度
         * @returns {Promise<Object>}
         */
        getHeader(hashOrHeight) {
            return getHeader(this.host, this.port, hashOrHeight)
        }

        /**
         * 查看区块
         * @param hashOrHeight {string | number} 区块哈希值或者区块高度
         * @returns {Promise<Object>}
         */
        getBlock(hashOrHeight) {
            return getBlock(this.host, this.port, hashOrHeight)
        }

        /**
         * 查看事务
         * @param hash 事务哈希值
         * @returns {Promise<Object>}
         */
        getTransaction(hash) {
            return getTransaction(this.host, this.port, hash)
        }

        /**
         * 查看账户
         * @param pkOrAddress {string} 公钥或者地址
         * @returns {Promise<Object>}
         */
        getAccount(pkOrAddress) {
            return getAccount(this.host, this.port, pkOrAddress)
        }

        /**
         * 获取 nonce
         * @param pkOrAddress {string} 公钥或者地址
         * @returns {Promise<string>}
         */
        getNonce(pkOrAddress) {
            return this.getAccount(pkOrAddress)
                .then(a => a.nonce)
                .then(toSafeInt)
        }

        /**
         * 查看申请加入的地址
         * @param contractAddress 合约地址
         * @returns {Promise<Object>}
         */
        getAuthPending(contractAddress) {
            return rpcPost(this.host, this.port, `/rpc/contract/${contractAddress}`, {
                method: 'pending'
            })
        }

        /**
         * 查看已经加入的地址
         * @param contractAddress 合约地址
         * @returns {Promise<[]>}
         */
        getAuthNodes(contractAddress) {
            return rpcPost(this.host, this.port, `/rpc/contract/${contractAddress}`, {
                method: 'nodes'
            })
        }

        /**
         * 查看投票数量排名列表
         * @returns {Promise<Object>}
         */
        getPoSNodeInfos() {
            return rpcPost(this.host, this.port, `/rpc/contract/${constants.POS_CONTRACT_ADDR}`, {
                method: 'nodeInfos'
            })
        }

        /**
         * 查看投票
         * @param txHash 投票的事务哈希值
         * @returns { Promise }
         */
        getPoSVoteInfo(txHash) {
            return rpcPost(this.host, this.port, `/rpc/contract/${constants.POS_CONTRACT_ADDR}`, {
                method: 'voteInfo',
                txHash: txHash
            })
        }

        close() {
            if (this.__ws) {
                const __ws = this.__ws
                this.__ws = null
                __ws.close()
            }
        }
    }

    class TransactionBuilder {
        /**
         *
         * @param {number | string} version  事务版本号
         * @param {string | Uint8Array} sk  私钥
         * @param {string | number | BN } [ gasLimit ]
         * @param {number | undefined} [ gasPrice ]  油价，油价 * 油 = 手续费
         * @param { number | string | BN } [ nonce ] 起始 nonce
         */
        constructor(version, sk, gasLimit, gasPrice, nonce) {
            this.version = version
            this.sk = sk
            this.gasPrice = gasPrice || 0
            if (nonce) {
                nonce = typeof nonce === 'string' ? nonce : nonce.toString(10)
            }
            this.gasLimit = gasLimit || 0
            this.nonce = nonce || 0
        }

        increaseNonce() {
            this.nonce = convert(this.nonce, ABI_DATA_TYPE.U64)
            this.nonce = this.nonce.add(ONE)
        }

        /**
         * 创建转账事务（未签名）
         * @param amount 转账金额
         * @param to { string } 转账接收者
         * @returns { Transaction }
         */
        buildTransfer(amount, to) {
            return this.buildCommon(constants.TRANSFER, amount, '', to)
        }

        /**
         * 构造部署合约的事务 （未签名）
         * @param { Contract } contract 合约对象
         * @param { Array | Object } [parameters] 合约的构造器参数
         * @param amount [number]
         * @returns { Transaction }
         */
        buildDeploy(contract, parameters, amount) {
            if (!contract instanceof Contract)
                throw new Error('create a instanceof Contract by new tool.Contract(addr, abi)')

            assert(contract.binary && isBytes(contract.binary), 'contract binary is uint8 array')

            if (!contract.abi)
                throw new Error('missing contract abi')


            parameters = normalizeParams(parameters)
            const inputs = parameters

            const binary = contract.binary
            if (contract.abi.filter(x => x.name === 'init').length > 0)
                parameters = contract.abiEncode('init', parameters)
            else
                parameters = [[], [], []]

            const ret = this.buildCommon(constants.DEPLOY, amount, RLP.encode([binary, parameters, contract.abiToBinary()]), '')
            ret.__abi = contract.abi
            ret.__setInputs(inputs)
            return ret
        }

        /**
         * 构造合约调用事务
         * @param { Contract} contract 合约
         * @param {string} method 调用合约的方法
         * @param { Array | Object } [parameters] 方法参数
         * @param amount [number] 金额
         * @returns { Transaction }
         */
        buildContractCall(contract, method, parameters, amount) {
            if (!contract instanceof Contract)
                throw new Error('create a instanceof Contract by new tool.Contract(addr, abi)')

            if (!contract.abi)
                throw new Error('missing contract abi')

            if (!contract.address)
                throw new Error('missing contract address')

            parameters = normalizeParams(parameters)
            const inputs = parameters

            const addr = contract.address
            parameters = contract.abiEncode(method, parameters)

            const ret = this.buildCommon(constants.CONTRACT_CALL, amount, RLP.encode([method, parameters]), addr)
            ret.__abi = contract.abi
            ret.__setInputs(inputs)
            return ret
        }

        /**
         * 创建事务（未签名）
         * @param type {number | string | BN} 事务类型
         * @param amount {number | BN | string} 金额
         * @param payload {string | Uint8Array | ArrayBuffer}
         * @param to {string | Uint8Array | ArrayBuffer } 接收者的地址
         * @returns { Transaction } 构造好的事务
         */
        buildCommon(type, amount, payload, to) {
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

            if (this.nonce) {
                ret.nonce = asDigitalNumberText(this.nonce)
                this.increaseNonce()
                this.sign(ret)
            }

            return ret
        }

        /**
         * 构造加入请求事务（未签名）
         * @param address {string} 合约地址
         * @returns { Transaction }
         */
        buildAuthJoin(address) {
            const payload = '00'
            return this.buildCommon(constants.CONTRACT_CALL, 0, payload, address)
        }

        /**
         * 构造同意加入的请求（未签名）
         * @param contractAddress {string} 合约地址
         * @param approvedAddress {string} 同意加入的地址
         * @returns { Transaction }
         */
        buildAuthApprove(contractAddress, approvedAddress) {
            const payload = '01' + approvedAddress
            return this.buildCommon(constants.CONTRACT_CALL, 0, payload, contractAddress)
        }

        /**
         * 构造退出事务（未签名）
         * @param contractAddress {string} 合约地址
         * @returns {{createdAt: number, amount: (*|number), payload: (*|string), from: string, to: *, type: *, version: (number|string), gasPrice: number}}
         */
        buildAuthExit(contractAddress) {
            const payload = '02' + privateKey2PublicKey(this.sk)
            return this.buildCommon(constants.CONTRACT_CALL, 0, payload, contractAddress)
        }

        /**
         * 构造投票事务（未签名）
         * @param amount {number} 投票数量
         * @param to {string} 被投票者的地址
         * @returns {{createdAt: number, amount: (*|number), payload: (*|string), from: string, to: *, type: *, version: (number|string), gasPrice: number}}
         */
        buildVote(amount, to) {
            const payload = '00' + to;
            return this.buildCommon(constants.CONTRACT_CALL, amount, payload, constants.POS_CONTRACT_ADDR)
        }

        /**
         * 构造撤销投票事务（未签名）
         * @param hash {string | Buffer} 签名事务的哈希值
         * @returns {{createdAt: number, amount: (*|number), payload: (*|string), from: string, to: *, type: *, version: (number|string), gasPrice: number}}
         */
        buildCancelVote(hash) {
            if (typeof hash !== 'string') {
                hash = hash.toString('hex')
            }
            const payload = '01' + hash
            return this.buildCommon(constants.CONTRACT_CALL, 0, payload, constants.POS_CONTRACT_ADDR)
        }

        /**
         * 对事务作出签名
         * @param { Transaction }tx 事务
         */
        sign(tx) {
            sign(tx, this.sk)
        }
    }

    const constants = {
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


    /**
     * 编译合约
     * @param ascPath {string} 编译器路径，一般在 node_modules/.bin/asc 下面
     * @param src {string} 源文件路径
     * @returns {Promise<Uint8Array>}
     */
    function compileContract(ascPath, src, opts) {
        let cmd = ascPath + ' ' + src + ' -b ' // 执行的命令
        if (opts && opts.debug)
            cmd += ' --debug '
        if (opts && opts.optimize)
            cmd += ' --optimize '
        if (isBrowser)
            throw new Error('compile contract is available in node environment')
        return new Promise((resolve, reject) => {
            child_process.exec(
                cmd,
                { encoding: 'buffer' },
                (err, stdout, stderr) => {
                    if (err) {
                        // err.code 是进程退出时的 exit code，非 0 都被认为错误
                        // err.signal 是结束进程时发送给它的信号值
                        reject(stderr.toString('ascii'))
                    }
                    resolve(stdout)
                }
            );
        })
    }

    function rpcGet(url) {
        if (!isBrowser)
            return new Promise((resolve, reject) => {
                http.get(
                    url, (res) => {
                        let data = ""

                        res.on("data", d => {
                            data += d
                        })
                        res.on("end", () => {
                            const d = JSON.parse(data)
                            if (d.code === 200) {
                                resolve(d.data)
                                return
                            }
                            reject(d.message)
                        })
                    })
                    .on('error', reject)
            })
        else
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        const resp = JSON.parse(xhr.responseText);
                        if (resp.code === 200) {
                            resolve(resp.data)
                        } else {
                            reject(resp.message)
                        }
                    }
                };
                xhr.open('GET', url);
                xhr.send()
            })
    }

    function rpcPost(host, port, path, data) {
        if (!path.startsWith('/'))
            path = '/' + path
        data = typeof data === 'string' ? data : JSON.stringify(data)
        if (!isBrowser) {
            return new Promise((resolve, reject) => {
                const opt = {
                    host: host,
                    port: port,
                    path: path,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': data.length
                    }
                }
                const req = http.request(
                    opt, (res) => {
                        let data = ""

                        res.on("data", d => {
                            data += d
                        })
                        res.on("end", () => {
                            const d = JSON.parse(data)
                            if (d.code === 200) {
                                resolve(d.data)
                                return
                            }
                            reject(d.message)
                        })
                    })
                    .on('error', reject)

                req.write(data)
                req.end()
            })
        } else {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.onload = function () {
                    if (xhr.status !== 200) {
                        reject('server error')
                        return
                    }
                    const resp = JSON.parse(xhr.responseText);
                    if (resp.code === 200)
                        resolve(resp.data)
                    else {
                        reject(resp.message)
                    }
                }
                xhr.open('POST', `http://${host}:${port}${path}`);
                xhr.setRequestHeader('Content-Type', 'application/json')
                xhr.send(data)
            })
        }
    }

    /**
     * 查看合约方法
     * @param host {string} 节点主机名
     * @param port {string | number} 节点端口
     * @param address {string} 合约的地址
     * @param method {string} 查看的方法
     * @param parameters { Uint8Array | string} 额外的参数，字节数组
     * @returns {Promise<string>}
     */
    function viewContract(host, port, address, method, params) {
        const args = RLP.encode([method, params])
        const url = `http://${host}:${port}/rpc/contract/${address}?args=${encodeHex(args)}`
        return rpcGet(url)
    }

    /**
     * 发送事务
     * @param host {string} 节点主机名
     * @param port {string | number} 节点端口
     * @param tx 事务
     * @returns {Promise<Object>}
     */
    function sendTransaction(host, port, tx) {
        const data = typeof tx === 'string' ? tx : JSON.stringify(tx)
        return rpcPost(host, port, '/rpc/transaction', data)
    }

    /**
     * 查看区块头
     * @param host {string} 节点主机名
     * @param port {string | number} 节点端口
     * @param hashOrHeight {string | number} 区块哈希值或者区块高度
     * @returns {Promise<Object>}
     */
    function getHeader(host, port, hashOrHeight) {
        const url = `http://${host}:${port}/rpc/header/${hashOrHeight}`
        return rpcGet(url)
    }

    /**
     * 查看区块
     * @param host {string} 节点主机名
     * @param port {string | number} 节点端口
     * @param hashOrHeight {string | number} 区块哈希值或者区块高度
     * @returns {Promise<Object>}
     */
    function getBlock(host, port, hashOrHeight) {
        const url = `http://${host}:${port}/rpc/block/${hashOrHeight}`
        return rpcGet(url)
    }

    /**
     * 查看事务
     * @param host {string} 节点主机名
     * @param port {string | number} 节点端口
     * @param hash 事务哈希值
     * @returns {Promise<Transaction>}
     */
    function getTransaction(host, port, hash) {
        const url = `http://${host}:${port}/rpc/transaction/${hash}`
        return rpcGet(url)
    }

    /**
     * 查看账户
     * @param host {string} 节点主机名
     * @param port {string | number} 节点端口
     * @param pkOrAddress {string} 公钥或者地址
     * @returns {Promise<Object>}
     */
    function getAccount(host, port, pkOrAddress) {
        const url = `http://${host}:${port}/rpc/account/${pkOrAddress}`
        return rpcGet(url)
    }

    /**
     * 获取 nonce
     * @param host {string} 节点主机名
     * @param port {string | Number} 节点端口
     * @param pkOrAddress {string} 公钥或者地址
     * @returns {Promise<string>}
     */
    function getNonce(host, port, pkOrAddress) {
        return getAccount(host, port, pkOrAddress)
            .then(a => a.nonce)
    }

    /**
     * 生成合约地址
     * @param address {string | Uint8Array} 合约创建者的地址
     * @param nonce {string | number | BN} 事务的 nonce
     * @returns {string} 合约的地址
     */
    function getContractAddress(address, nonce) {
        nonce = nonce ? nonce : 0
        address = convert(address, ABI_DATA_TYPE.ADDRESS)
        if (address.length != 20)
            throw new Error(`address length should be 20 while ${address.length} found`)
        let buf = RLP.encode([address, convert(nonce, ABI_DATA_TYPE.U64)])
        buf = decodeHex(sm3(buf), 'hex')
        return encodeHex(buf.slice(buf.length - 20, buf.length))
    }

    /**
     * 私钥转公钥
     * @param sk {string | Uint8Array | ArrayBuffer} 私钥
     * @returns {string}
     */
    function privateKey2PublicKey(sk) {
        sk = bin2hex(sk)
        if (!isHex(sk))
            throw new Error('invalid hex string ' + sk)
        if (sk.length / 2 != 32)
            throw new Error('invalid private key, length = ' + sk.length / 2)
        return sm2.compress(sm2.getPKFromSK(sk))
    }

    /**
     * 公钥转地址
     * @param pk {string | Uint8Array | ArrayBuffer} 公钥
     * @returns {string}
     */
    function publicKey2Address(pk) {
        if (isBytes(pk))
            pk = toU8Arr(pk)
        if (typeof pk === 'string')
            pk = decodeHex(pk)
        if (pk.length != 33)
            throw new Error('invalid public key size: ' + pk.length)
        const buf = decodeHex(sm3(pk))
        return encodeHex(buf.slice(buf.length - 20, buf.length))
    }

    /**
     * 对事务作出签名
     * @param { Transaction } tx 事务
     * @param sk 私钥
     */
    function sign(tx, sk) {
        tx.signature =
            sm2.doSignature(
                tx.getSignaturePlain(),
                sk,
                { userId: 'userid@soie-chain.com', der: false, hash: true }
            )
    }

    /**
     * 生成私钥
     * @returns {string} 私钥
     */
    function generatePrivateKey() {
        return (sm2.generateKeyPairHex()).privateKey
    }

    const tool = {
        sign: sign,
        publicKey2Address: publicKey2Address,
        privateKey2PublicKey: privateKey2PublicKey,
        getContractAddress: getContractAddress,
        compileContract: compileContract,
        constants: constants,
        TransactionBuilder: TransactionBuilder,
        RPC: RPC,
        generatePrivateKey: generatePrivateKey,
        readKeyStore: readKeyStore,
        createKeyStore: createKeyStore,
        createAuthServer: createAuthServer,
        Contract: Contract,
        Transaction: Transaction,
        randomBytes: randomBytes,
        encodeHex: encodeHex,
        decodeHex: decodeHex,
        TX_STATUS: TX_STATUS,
        RLP, RLP,
        str2bin: str2bin,
        bin2str: bin2str,
        f64ToBytes: f64ToBytes,
        bytesToF64: bytesToF64,
        convert: convert,
        compileABI: compileABI,
        ABI: ABI
    }

    if (!isBrowser)
        module.exports = tool
    else {
        window.tdsSDK = tool
    }

    /**
     *
     * @param ks {Object} keystore 对象
     * @param password {string} 密码
     * @return {string} 十六进制编码形式的私钥
     */
    function readKeyStore(ks, password) {
        if (!ks.crypto.cipher || "sm4-128-ecb" !== ks.crypto.cipher) {
            throw new Error("unsupported crypto cipher " + ks.crypto.cipher);
        }
        let buf = concatBytes([decodeHex(ks.crypto.salt), str2bin(password)]);
        const key = sm3(buf)
        const cipherPrivKey = decodeHex(ks.crypto.cipherText)

        const decrypted = new Uint8Array(sm4.decrypt(cipherPrivKey, decodeHex(key)))
        return encodeHex(decrypted)
    }


    /**
     * 生成 keystore
     * @param {string } password 密码
     * @param {string | Uint8Array | ArrayBuffer} [privateKey]
     * @return {Object} 生成好的 keystore
     */
    function createKeyStore(password, privateKey) {
        if (!privateKey)
            privateKey = generatePrivateKey()
        if (isBytes(privateKey))
            privateKey = toU8Arr(privateKey)

        if (typeof privateKey === 'string') {
            privateKey = decodeHex(privateKey)
        }

        const ret = {
            publicKey: '',
            crypto: {
                cipher: "sm4-128-ecb",
                cipherText: '',
                iv: '',
                salt: ''
            },
            id: '',
            version: "1",
            mac: "",
            kdf: "sm2-kdf",
            address: ''
        }
        const salt = randomBytes(32)
        const iv = randomBytes(16)
        ret.publicKey = privateKey2PublicKey(privateKey)
        ret.crypto.iv = encodeHex(iv)
        ret.crypto.salt = encodeHex(salt)
        ret.id = uuidv4()

        let key = decodeHex(
            sm3(
                concatBytes([salt, str2bin(password)])
            ),
            'hex'
        )

        key = key.slice(0, 16)

        let cipherText = sm4.encrypt(
            privateKey, key
        )

        cipherText = new Uint8Array(cipherText)

        ret.crypto.cipherText = encodeHex(cipherText)
        ret.mac = sm3(concatBytes(
            [key, cipherText]
        ))
        ret.address = publicKey2Address(ret.publicKey)
        return ret
    }

    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 
     * @param { ArrayBuffer | Uint8Array | string } str 
     */
    function compileABI(str) {
        if (isBytes(str))
            str = bin2str(str)
        const TYPES = {
            u64: 'u64',
            i64: 'i64',
            f64: 'f64',
            bool: 'bool',
            string: 'string',
            ArrayBuffer: 'bytes',
            Address: 'address',
            U256: 'u256',
            String: 'string',
            boolean: 'bool'
        }

        function getOutputs(str) {
            if (str === 'void')
                return []
            const ret = TYPES[str]
            if (!ret)
                throw new Error(`invalid type: ${str}`)
            return [{ "type": ret }]
        }

        function getInputs(str, event) {
            const ret = []
            for (let p of str.split(',')) {
                if (!p)
                    continue
                const lr = p.split(':')
                let l = lr[0].trim()
                if (event) {
                    if (!l.startsWith('readonly'))
                        throw new Error(`event constructor field ${l} should starts with readonly`)
                    l = l.split(' ')[1]
                }
                const r = lr[1].trim()
                const o = {
                    name: l,
                    type: TYPES[r]
                }
                if (!o.type)
                    throw new Error(`invalid type: ${r}`)
                ret.push(o)
            }
            return ret
        }

        const ret = []
        let funRe = /export[\s\n\t]+function[\s\n\t]+([a-zA-Z_][a-zA-Z0-9_]*)[\s\n\t]*\(([a-z\n\s\tA-Z0-9_,:]*)\)[\s\n\t]*:[\s\n\t]*([a-zA-Z_][a-zA-Z0-9_]*)[\s\n\t]*{/g
        let eventRe = /@unmanaged[\s\n\t]+class[\s\n\t]+([a-zA-Z_][a-zA-Z0-9]*)[\s\n\t]*\{[\s\n\t]*constructor[\s\n\t]*\(([a-z\n\s\tA-Z0-9_,:]*)\)/g

        for (let m of str.match(funRe)) {
            funRe.lastIndex = 0
            const r = funRe.exec(m)
            if (r[1] === '__idof')
                continue
            ret.push({
                type: 'function',
                name: r[1],
                inputs: getInputs(r[2]),
                outputs: getOutputs(r[3])
            })
        }


        for (let m of str.match(eventRe)) {
            eventRe.lastIndex = 0
            const r = eventRe.exec(m)
            ret.push({
                type: 'event',
                name: r[1],
                inputs: [],
                outputs: getInputs(r[2], true)
            })
        }
        return ret
    }


    /**
     * 认证服务器
     * @param whiteList { Array<string> | undefined } 公钥白名单
     * @param privateKey {string | Uint8Array | ArrayBuffer } 私钥
     * @returns {Object}
     */
    function createAuthServer(privateKey, whiteList) {
        if (isBrowser)
            throw new Error('create auth server is available in nodejs')
        const URL = require('url');
        const http = require('http')
        const server = http.createServer()

        server.on('request', function (request, response) {

            let otherPublicKey = URL.parse(request.url, true).query['publicKey']
            if (whiteList && whiteList.length) {
                const exists = whiteList.map(x => x === otherPublicKey)
                    .reduce((x, y) => x || y, false)
                if (!exists)
                    throw new Error(`invalid public key, not in white list ${otherPublicKey}`)
            }

            // 对公钥进行解压缩
            if (otherPublicKey.substr(0, 2) !== '04') {
                otherPublicKey = sm2.deCompress(otherPublicKey)
            }

            // 生成密文
            const ret = {
                publicKey: privateKey2PublicKey(privateKey),
                cipherText: sm2.doEncrypt(Buffer.from(privateKey, 'hex'), otherPublicKey, sm2.C1C2C3)
            }

            response.write(JSON.stringify(ret))
            response.end()

        })
        return server
    }
})();

