import { RLP } from "./rlp"
import { Util } from "./util"
import { U256 } from './u256'

function __getAbiOf<T>(): ABI_DATA_TYPE {
    if (isBoolean<T>()) {
        return ABI_DATA_TYPE.BOOL;
    }
    if (isInteger<T>()) {
        if (isSigned<T>()) {
            return ABI_DATA_TYPE.I64;
        } else {
            return ABI_DATA_TYPE.U64;
        }
    }
    if (isFloat<T>())
        return ABI_DATA_TYPE.F64;
    if (isString<T>())
        return ABI_DATA_TYPE.STRING;

    if (idof<T>() == idof<Address>())
        return ABI_DATA_TYPE.ADDRESS;

    if (idof<T>() == idof<U256>())
        return ABI_DATA_TYPE.U256;

    assert(false, 'unexpected type ' + nameof<T>());
    return ABI_DATA_TYPE.BOOL;
}

export enum ABI_DATA_TYPE {
    BOOL, // 0
    I64,  // 1
    U64, //  2 BN
    F64,
    STRING, // 3 string
    BYTES, // 4
    ADDRESS, // 5
    U256, // 6
}

// @ts-ignore
@external("env", "_context")
// type, address?
declare function _context(type: u64, arg0: u64): u64;

// @ts-ignore
@external("env", "_reflect")
// type, address, method, parameters, dst
// type, binary, parameters, 0, 0, amount , dst
declare function _reflect(type: u64, addrOrBin: u64, method: u64, params: u64, amount: u64, abi: u64): u64;

// @ts-ignore
@external("env", "_transfer")
// type, address, amount
declare function _transfer(type: u64, arg0: u64, arg1: u64): void;


// @ts-ignore
@external("env", "_event")
//result z
declare function _event(
    arg0: u64,
    arg1: u64
): void;

function _bytes(type: u32): ArrayBuffer {
    let ptr = usize(_context(type, 0))
    return changetype<ArrayBuffer>(ptr)
}

function _u256(type: u32): U256 {
    let ptr = usize(_context(type, 0))
    return changetype<U256>(ptr)
}

function _address(type: u32): Address {
    let ptr = usize(_context(type, 0))
    return changetype<Address>(ptr)
}

function _u64(type: u32): u64 {
    return _context(type, 0);
}

enum ReflectType {
    CALL, // call without put into memory
    CREATE
}

export class Address {

    @operator(">")
    static __op_gt(left: Address, right: Address): bool {
        return Util.compareBytes(left.buf, right.buf) > 0;
    }

    @operator(">=")
    static __op_gte(left: Address, right: Address): bool {
        return Util.compareBytes(left.buf, right.buf) >= 0;
    }

    @operator("<")
    static __op_lt(left: Address, right: Address): bool {
        return Util.compareBytes(left.buf, right.buf) < 0;
    }

    @operator("<=")
    static __op_lte(left: Address, right: Address): bool {
        return Util.compareBytes(left.buf, right.buf) <= 0;
    }

    @operator("==")
    static __op_eq(left: Address, right: Address): bool {
        return Util.compareBytes(left.buf, right.buf) == 0;
    }

    @operator("!=")
    static __op_ne(left: Address, right: Address): bool {
        return Util.compareBytes(left.buf, right.buf) != 0;
    }


    constructor(readonly buf: ArrayBuffer) {
    }

    transfer(amount: U256): void {
        const ptr = changetype<usize>(this)
        _transfer(0, ptr, changetype<usize>(amount))
    }

    call<T>(method: string, parameters: Parameters, amount: U256): T {
        let abiType: ArrayBuffer = isVoid<T>() ? RLP.emptyList() : RLP.encodeU64(__getAbiOf<T>());
        abiType = isVoid<T>() ? abiType : RLP.encodeElements([abiType]);
        // [输入类型] [输入] [输出类型]
        const arr: Array<ArrayBuffer> = [RLP.encodeElements(parameters.types), RLP.encodeElements(parameters.li), abiType]
        const encodedParams = RLP.encodeElements(arr)

        const r = _reflect(
            ReflectType.CALL, changetype<usize>(this), changetype<usize>(method),
            changetype<usize>(encodedParams), changetype<usize>(amount),
            0
        )
        if(isFloat<T>())
            return reinterpret<T>(r)
        if(isInteger<T>())
            return r as T
        if (!isVoid<T>()) {
            return changetype<T>(usize(r))
        }
    }

    balance(): U256 {
        let ptr = usize(_context(ContextType.ACCOUNT_BALANCE, changetype<usize>(this)))
        return changetype<U256>(ptr)
    }

    nonce(): u64 {
        const ptr = changetype<usize>(this);
        return _context(ContextType.ACCOUNT_NONCE, ptr);
    }

    // get contract code
    code(): ArrayBuffer {
        const ptr = changetype<usize>(this);
        const ret = usize(_context(ContextType.CONTRACT_CODE, ptr))
        return changetype<ArrayBuffer>(ret)
    }

    // get contract abi
    abi(): ArrayBuffer {
        const ptr = _context(ContextType.CONTRACT_ABI, changetype<usize>(this));
        return changetype<ArrayBuffer>(usize(ptr))
    }

    toString(): string {
        return Util.encodeHex(this.buf);
    }
}



enum ContextType {
    HEADER_PARENT_HASH,
    HEADER_CREATED_AT,
    HEADER_HEIGHT,
    TX_TYPE,
    TX_CREATED_AT,
    TX_NONCE,
    TX_ORIGIN,
    TX_GAS_PRICE,
    TX_AMOUNT,
    TX_TO,
    TX_SIGNATURE,
    TX_HASH,
    CONTRACT_ADDRESS,
    CONTRACT_NONCE,
    CONTRACT_CREATED_BY,
    ACCOUNT_NONCE,
    ACCOUNT_BALANCE,
    MSG_SENDER,
    MSG_AMOUNT,
    CONTRACT_CODE,
    CONTRACT_ABI
}

export enum TransactionType {
    // coinbase transaction has code 0
    COIN_BASE,
    // the amount is transferred from sender to recipient
    // if type is transfer, payload is null
    // and fee is a constant
    TRANSFER,
    // if type is contract deploy, payload is wasm binary module
    // fee = gasPrice * gasUsage
    CONTRACT_DEPLOY,
    // if type is contract call, payload = gasLimit(little endian, 8 bytes) +
    // method name length (an unsigned byte) +
    // method name(ascii string, [_a-zA-Z][_a-zA-Z0-9]*) +
    // custom parameters, could be load by Parameters.load() in contract
    // fee = gasPrice * gasUsage
    // e.g.

    CONTRACT_CALL
}

export class ParametersBuilder {
    private readonly types: Array<ArrayBuffer>;
    private readonly elements: Array<ArrayBuffer>;

    constructor() {
        this.elements = new Array<ArrayBuffer>();
        this.types = new Array<ArrayBuffer>();

    }

    push<T>(data: T): void {
        this.types.push(RLP.encodeU64(__getAbiOf<T>()));
        this.elements.push(RLP.encode<T>(data));
    }

    build(): Parameters {
        const ar = RLP.encodeElements(this.elements);
        return new Parameters(this.types, this.elements);
    }
}

export class Parameters {
    static EMPTY: Parameters = new Parameters([], []);

    constructor(
        readonly types: Array<ArrayBuffer>,
        readonly li: Array<ArrayBuffer>
    ) { }
}

export class Header {
    constructor(
        readonly parentHash: ArrayBuffer,
        readonly createdAt: u64,
        readonly height: u64
    ) { }
}

export class Msg {
    constructor(
        readonly sender: Address,
        readonly amount: U256,
    ) { }
}

export class Transaction {
    constructor(
        readonly type: u32,
        readonly createdAt: u64,
        readonly nonce: u64,
        readonly origin: Address,
        readonly gasPrice: U256,
        readonly amount: U256,
        readonly to: Address,
        readonly signature: ArrayBuffer,
        readonly hash: ArrayBuffer
    ) {
    }
}

export class Contract {
    constructor(
        readonly address: Address,
        readonly nonce: u64,
        readonly createdBy: Address
    ) {
    }
}


export class Context {
    /**
     * get address of current contract
     */
    static self(): Address {
        return _address(ContextType.CONTRACT_ADDRESS)
    }

    static emit<T>(name: string, encoded: ArrayBuffer): void {
        _event(changetype<usize>(name), changetype<usize>(encoded))
    }


    static header(): Header {
        return new Header(
            _bytes(ContextType.HEADER_PARENT_HASH),
            _u64(ContextType.HEADER_CREATED_AT),
            _u64(ContextType.HEADER_HEIGHT)
        );
    }

    static msg(): Msg {
        return new Msg(
            _address(ContextType.MSG_SENDER),
            _u256(ContextType.MSG_AMOUNT)
        )
    }

    static transaction(): Transaction {
        return new Transaction(
            u8(_u64(ContextType.TX_TYPE)),
            _u64(ContextType.TX_CREATED_AT),
            _u64(ContextType.TX_NONCE),
            _address(ContextType.TX_ORIGIN),
            _u256(ContextType.TX_GAS_PRICE),
            _u256(ContextType.TX_AMOUNT),
            _address(ContextType.TX_TO),
            _bytes(ContextType.TX_SIGNATURE),
            _bytes(ContextType.TX_HASH),
        );
    }

    static contract(): Contract {
        return new Contract(
            _address(ContextType.CONTRACT_ADDRESS),
            _u64(ContextType.CONTRACT_NONCE),
            _address(ContextType.CONTRACT_CREATED_BY)
        )
    }

    static create(code: ArrayBuffer, abi: ArrayBuffer, parameters: Parameters, amount: U256): Address {
        const arr: Array<ArrayBuffer> = [RLP.encodeElements(parameters.types), RLP.encodeElements(parameters.li), RLP.emptyList()];
        const buf = RLP.encodeElements(arr);
        const r = _reflect(
            ReflectType.CREATE, changetype<usize>(code),
            changetype<usize>('init'), changetype<usize>(buf),
            changetype<usize>(amount), changetype<usize>(abi)
        )
        return changetype<Address>(usize(r))
    }
}
