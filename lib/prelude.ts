import { ABI_DATA_TYPE, Address } from "./context"
import { U256 } from "./util"

// @ts-ignore
@external("env", "_log")
declare function _log(ptr: u64): void;

// @ts-ignore
export function log(a: string): void {
    _log(changetype<usize>(a))
}


enum CharSet {
    UTF8,
    UTF16,
    UTF16LE
}

export function abort(
    message: string | null,
    fileName: string | null,
    lineNumber: u32,
    columnNumber: u32
): void {
    if (message === null || fileName === null) return;
    // @ts-ignore
    log('ABORT: ' + message + ' - ' + fileName + ':' + lineNumber.toString())
    unreachable()
}

let META: ArrayBuffer | null = null

export function __meta(): usize {
    if (META != null)
        return changetype<usize>(META)

    const buf = new Uint8Array(3)
    // 有 1 个 meta 信息
    buf[0] = 1
    // 唯一一个 meta 信息的长度是 1
    buf[1] = 1
    // 这个 meta 信息表示字符串编码
    buf[2] = CharSet.UTF16LE
    META = buf.buffer
    return changetype<usize>(buf.buffer)
}

export function __malloc(size: i32, type: ABI_DATA_TYPE): u64 {
    switch (type) {
        case ABI_DATA_TYPE.STRING: {
            const ret = u64(__new(size, idof<string>()))
            return ret << 32 | ret
        }
        case ABI_DATA_TYPE.BYTES: {
            const buf = new ArrayBuffer(size)
            const ret = u64(changetype<usize>(buf))
            return ret << 32 | ret
        }
        case ABI_DATA_TYPE.ADDRESS: {
            let addr = new Address(new ArrayBuffer(size))
            const ret = u64(changetype<usize>(addr.buf))
            return (u64(changetype<usize>(addr)) << 32) | ret
        }
        case ABI_DATA_TYPE.U256: {
            let u = new U256(new ArrayBuffer(size))
            const ret = u64(changetype<usize>(u.buf))
            return (u64(changetype<usize>(u)) << 32) | ret
        }
    }
    return 0
}

export function __mpeek(ptr: usize, type: ABI_DATA_TYPE): u64 {
    switch (type) {
        case ABI_DATA_TYPE.STRING: {
            let len = load<u32>(ptr - 4)
            return (u64(len) << 32) | ptr
        }
        case ABI_DATA_TYPE.BYTES: {
            const buf = changetype<ArrayBuffer>(ptr)
            let len = u64(buf.byteLength)
            return (len << 32) | ptr
        }
        case ABI_DATA_TYPE.ADDRESS: {
            let addr = changetype<Address>(ptr)
            let len = u64(addr.buf.byteLength)
            return (len << 32) | u64(changetype<usize>(addr.buf))
        }
        case ABI_DATA_TYPE.U256: {
            let u = changetype<U256>(ptr)
            let len = u64(u.buf.byteLength)
            return (len << 32) | u64(changetype<usize>(u.buf))
        }
    }
    return 0
}