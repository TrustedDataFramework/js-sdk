import { Address } from './context'
import { Util } from './util'
import { U256 } from './u256'

const OFFSET_SHORT_LIST = 0xc0
const OFFSET_SHORT_ITEM = 0x80
const SIZE_THRESHOLD = 56
const OFFSET_LONG_ITEM = 0xb7
const OFFSET_LONG_LIST = 0xf7

export class RLP {
    static emptyList(): ArrayBuffer {
        const ret = new Uint8Array(1);
        ret[0] = OFFSET_SHORT_LIST;
        return ret.buffer;
    }

    // supported types： u64 i64 f64 bool U256 string ArrayBuffer Address
    static encode<T>(t: T): ArrayBuffer {
        if (isFunction<T>()) {
            assert(false, 'rlp encode failed, invalid type ' + nameof<T>());
            return new ArrayBuffer(0);
        }

        if (isFloat<T>()) {
            return RLP.encodeU64(reinterpret<u64>(t));
        }

        if (isInteger<T>()) {
            return RLP.encodeU64(u64(t));
        }

        if (isString<T>()) {
            return RLP.encodeString(changetype<string>(t));
        }
        switch (idof<T>()) {
            case idof<ArrayBuffer>():
                return RLP.encodeBytes(changetype<ArrayBuffer>(t));
            case idof<U256>():
                return RLP.encodeBytes(changetype<U256>(t).buf);
            case idof<Address>():
                return RLP.encodeBytes(changetype<Address>(t).buf)
        }
        assert(false, 'rlp encode failed, invalid type ' + nameof<T>());
        return new ArrayBuffer(0);
    }

    // supported types： u64 i64 f64 bool U256 string ArrayBuffer Address
    static decode<T>(buf: ArrayBuffer): T {
        if (isFunction<T>()) {
            assert(false, 'rlp encode failed, invalid type ' + nameof<T>());
            return changetype<T>(null);
        }

        if (isFloat<T>()) {
            // @ts-ignore
            return reinterpret<f64>(RLP.decodeU64(buf))
        }

        if (isBoolean<T>()) {
            // @ts-ignore
            return RLP.decodeU64(buf) != 0;
        }

        if (isInteger<T>()) {
            const ret = RLP.decodeU64(buf);

            if (sizeof<T>() == 8) {
                // @ts-ignore
                return ret;
            }
            if (sizeof<T>() == 4) {
                assert(ret <= u32.MAX_VALUE, 'invalid u32: overflow')
                // @ts-ignore
                return u32(ret)
            }
            if (sizeof<T>() == 2) {
                assert(ret <= u16.MAX_VALUE, 'invalid u32: overflow')
                // @ts-ignore
                return u16(ret)
            }
            if (sizeof<T>() == 1) {
                assert(ret <= u8.MAX_VALUE, 'invalid u32: overflow')
                // @ts-ignore
                return u8(ret);
            }
        }
        if (isString<T>()) {
            return changetype<T>(RLP.decodeString(buf))
        }
        switch (idof<T>()) {
            case idof<ArrayBuffer>():
                return changetype<T>(RLP.decodeBytes(buf))
            case idof<U256>():
                return changetype<T>(new U256(RLP.decodeBytes(buf)))
            case idof<Address>():
                return changetype<T>(new Address(RLP.decodeBytes(buf)))
        }
        assert(false, 'rlp encode failed, invalid type ' + nameof<T>())
        return changetype<T>(0)
    }

    // if the byte array was encoded from a list
    static isList(encoded: ArrayBuffer): bool {
        const arr = Uint8Array.wrap(encoded)
        return arr[0] >= u8(OFFSET_SHORT_LIST)
    }

    static encodeU64(u: u64): ArrayBuffer {
        return encodeBytes(Util.u64ToBytes(u))
    }

    static encodeU256(u: U256): ArrayBuffer {
        let firstNoZero = 0;
        let arr = Uint8Array.wrap(u.buf)
    
        for(; firstNoZero <= u.buf.byteLength; firstNoZero++) {
            if (firstNoZero == u.buf.byteLength || arr[firstNoZero] != 0){
                break
            }
        }
        return encodeBytes(u.buf.slice(firstNoZero, u.buf.byteLength));
    }

    static decodeU64(u: ArrayBuffer): u64 {
        return RLPItem.fromEncoded(u).u64();
    }

    static decodeU256(u: ArrayBuffer): U256 {
        return RLPItem.fromEncoded(u).u256();
    }

    static decodeString(encoded: ArrayBuffer): string {
        return RLPItem.fromEncoded(encoded).string();
    }


    // encode a string
    static encodeString(s: string): ArrayBuffer {
        return encodeBytes(String.UTF8.encode(s));
    }

    // encode string list
    static encodeStringArray(s: Array<string>): ArrayBuffer {
        const elements: Array<ArrayBuffer> = new Array<ArrayBuffer>(s.length);
        for (let i = 0; i < elements.length; i++) {
            elements[i] = this.encodeString(s[i]);
        }
        return encodeElements(elements);
    }

    // encode a byte array
    static encodeBytes(bytes: ArrayBuffer): ArrayBuffer {
        return encodeBytes(bytes);
    }

    static encodeElements(elements: Array<ArrayBuffer>): ArrayBuffer {
        return encodeElements(elements);
    }

    static decodeBytes(data: ArrayBuffer): ArrayBuffer {
        const v = Uint8Array.wrap(data)
        const parser = new RLPParser(data)
        if (v.length === 1 && v[0] === 0x80)
            return new ArrayBuffer(0)
        if (parser.remained() > 1) {
            parser.skip(parser.prefixLength())
        }
        return parser.bytes(parser.remained())
    }
}

export class RLPItem {
    // before encoded data
    private readonly data: ArrayBuffer;

    private constructor(data: ArrayBuffer) {
        this.data = data;
    }

    static fromEncoded(encoded: ArrayBuffer): RLPItem {
        const decoded = RLP.decodeBytes(encoded);
        return new RLPItem(decoded);
    }

    u8(): u8 {
        assert(this.u64() <= u8.MAX_VALUE, 'integer overflow');
        return u8(this.u64());
    }

    u16(): u16 {
        assert(this.u64() <= u16.MAX_VALUE, 'integer overflow');
        return u16(this.u64());
    }

    u32(): u32 {
        assert(this.u64() <= u32.MAX_VALUE, 'integer overflow');
        return u32(this.u64());
    }

    u64(): u64 {
        assert(this.data.byteLength <= 8, 'invalid u64: overflow');
        return Util.bytesToU64(this.data);
    }

    u256(): U256 {
        return new U256(this.bytes());
    }

    bytes(): ArrayBuffer {
        return this.data
    }

    string(): string {
        return String.UTF8.decode(this.data);
    }

    isNull(): bool {
        return this.data.byteLength == 0;
    }
}

function copyOfRange(arr: Uint8Array, offset: i32, limit: i32): ArrayBuffer {
    let ret = new Uint8Array(limit - offset)
    ret.set(arr.slice(offset, limit))
    return ret.buffer
}

class RLPParser {
    buf: Uint8Array
    offset: i32
    limit: i32

    constructor(buf: ArrayBuffer, offset: i32 = 0, limit: i32 = buf.byteLength) {
        this.buf = Uint8Array.wrap(buf)
        this.offset = offset
        this.limit = limit
    }

    prefixLength(): i32 {
        const prefix = i32(this.buf[this.offset])
        if (prefix <= OFFSET_LONG_ITEM) {
            return 1
        }
        if (prefix < OFFSET_SHORT_LIST) {
            return 1 + (prefix - OFFSET_LONG_ITEM);
        }
        if (prefix <= OFFSET_LONG_LIST) {
            return 1
        }
        return 1 + (prefix - OFFSET_LONG_LIST)
    }

    skip(n: i32): void{
        this.offset += n
    }

    peekSize(): i32 {
        const prefix = i32(this.buf[this.offset])
        if (prefix < OFFSET_SHORT_ITEM) {
            return 1
        }
        if (prefix <= OFFSET_LONG_ITEM) {
            return prefix - OFFSET_SHORT_ITEM + 1
        }
        if (prefix < OFFSET_SHORT_LIST) {
            return i32(Util.bytesToU64(
                copyOfRange(this.buf, 1 + this.offset, 1 + this.offset + prefix - OFFSET_LONG_ITEM)
            ) + 1 + prefix - OFFSET_LONG_ITEM)
        }
        if (prefix <= OFFSET_LONG_LIST) {
            return prefix - OFFSET_SHORT_LIST + 1
        }
        return i32(Util.bytesToU64(
            copyOfRange(this.buf, 1 + this.offset, this.offset + 1 + prefix - OFFSET_LONG_LIST)
            ))
            + 1 + prefix - OFFSET_LONG_LIST
    }

    bytes(n: i32): ArrayBuffer {
        assert(this.offset + n <= this.limit, 'read overflow')
        const ret = new Uint8Array(n)
        ret.set(this.buf.slice(this.offset, this.offset + n))
        this.offset += n
        return ret.buffer
    }

    remained(): i32 {
        return this.limit - this.offset;
    }
}

function estimateSize(encoded: ArrayBuffer): i32 {
    const parser = new RLPParser(encoded)
    return parser.peekSize()
}

function validateSize(encoded: ArrayBuffer): void{
    assert(encoded.byteLength === estimateSize(encoded), 'invalid rlp format')
}

function isRLPList(encoded: ArrayBuffer): boolean{
    return Uint8Array.wrap(encoded)[0] >= u8(OFFSET_SHORT_LIST)
}

function decodeElements(enc: ArrayBuffer): ArrayBuffer[] {
    validateSize(enc);
    if (!isRLPList(enc)) {
        throw new Error('not a rlp list')
    }
    const parser = new RLPParser(enc)
    parser.skip(parser.prefixLength())
    const ret: ArrayBuffer[] = []
    while (parser.remained() > 0) {
        ret.push(parser.bytes(parser.peekSize()))
    }
    return ret;
}



export class RLPList {
    static EMPTY: RLPList = new RLPList([], RLP.emptyList());

    private constructor(readonly elements: Array<ArrayBuffer>, readonly encoded: ArrayBuffer) {
    }

    static fromEncoded(encoded: ArrayBuffer): RLPList {
        const elements = decodeElements(encoded)
        return new RLPList(elements, encoded);
    }

    getItem(index: u32): RLPItem {
        return RLPItem.fromEncoded(this.getRaw(index));
    }

    getList(index: u32): RLPList {
        return RLPList.fromEncoded(this.getRaw(index))
    }

    length(): u32 {
        return this.elements.length;
    }

    getRaw(index: u32): ArrayBuffer {
        return this.elements[index];
    }

    isNull(index: u32): bool {
        return this.elements[index].byteLength == 1 && Uint8Array.wrap(this.elements[index])[0] == 0x80;
    }
}

function encodeBytes(b: ArrayBuffer): ArrayBuffer {
    let v = Uint8Array.wrap(b)
    if (b.byteLength === 0) {
        const ret = new Uint8Array(1);
        ret[0] = OFFSET_SHORT_ITEM
        return ret.buffer
    }
    if (v.length === 1 && i32(v[0] & 0xFF) < OFFSET_SHORT_ITEM) {
        return b
    }
    if (v.length < SIZE_THRESHOLD) {
        // length = 8X
        const prefix = OFFSET_SHORT_ITEM + v.length
        const ret = new Uint8Array(v.length + 1)
        ret.set(v, 1)
        ret[0] = prefix
        return ret.buffer
    }

    let lenEncoded = Util.u64ToBytes(u64(v.length))

    const ret = new Uint8Array(1 + lenEncoded.byteLength + v.length)
    ret[0] = OFFSET_LONG_ITEM + lenEncoded.byteLength
    ret.set(Uint8Array.wrap(lenEncoded), 1)
    ret.set(v, 1 + lenEncoded.byteLength)
    return ret.buffer
}


export function encodeElements(elements: ArrayBuffer[]): ArrayBuffer {
    let totalLength = 0

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        totalLength += el.byteLength
    }

    let data: Uint8Array
    let copyPos = 0

    if (totalLength < SIZE_THRESHOLD) {
        data = new Uint8Array(1 + totalLength);
        data[0] = OFFSET_SHORT_LIST + totalLength;
        copyPos = 1;
    } else {
        // length of length = BX
        // prefix = [BX, [length]]
        let totalLengthEncoded = Util.u64ToBytes(u64(totalLength))

        // first byte = F7 + bytes.length
        data = new Uint8Array(1 + totalLengthEncoded.byteLength + totalLength)
        data[0] = OFFSET_LONG_LIST + totalLengthEncoded.byteLength
        data.set(Uint8Array.wrap(totalLengthEncoded), 1)
        copyPos = totalLengthEncoded.byteLength + 1
    }
    for (let i = 0; i < elements.length; i++) {
        const el = Uint8Array.wrap(elements[i])
        data.set(el, copyPos)
        copyPos += el.length
    }
    return data.buffer
}
