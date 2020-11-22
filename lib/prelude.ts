import { ABI_DATA_TYPE, Address } from "./context"
import { U256 } from "./u256"

// @ts-ignore
@external("env", "_log")
declare function _log(ptr: u64): void;

// @ts-ignore
export function log(a: string): void {
    _log(changetype<usize>(a))
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


export function __malloc(size: u64): u64 {
    const buf = new ArrayBuffer(i32(size))
    return changetype<usize>(buf)
}

export function __change_t(t: u64, ptr: u64, size: u64): u64{
    const buf = changetype<ArrayBuffer>(usize(ptr))
    switch (u8(t)){
        case ABI_DATA_TYPE.ADDRESS:
            return changetype<usize>(new Address(buf))
        case ABI_DATA_TYPE.BYTES:
            return changetype<usize>(buf)
        case ABI_DATA_TYPE.U256:
            return changetype<usize>(new U256(buf))
        case ABI_DATA_TYPE.STRING:
            return changetype<usize>(String.UTF8.decode(buf))
    }
    return 0
}

export function __peek(ptr: u64, type: u64): u64 {
    switch (u8(type)) {
        case ABI_DATA_TYPE.STRING: {
            const str = changetype<string>(usize(ptr))
            const buf = String.UTF8.encode(str, false)
            return __peek(changetype<usize>(buf), ABI_DATA_TYPE.BYTES)
        }
        case ABI_DATA_TYPE.BYTES: {
            const buf = changetype<ArrayBuffer>(usize(ptr))
            let len = u64(buf.byteLength)
            return (ptr << 32) | len
        }
        case ABI_DATA_TYPE.ADDRESS: {
            let addr = changetype<Address>(usize(ptr))
            return __peek(changetype<usize>(addr.buf), ABI_DATA_TYPE.BYTES)
        }
        case ABI_DATA_TYPE.U256: {
            let u = changetype<U256>(usize(ptr))
            return __peek(changetype<usize>(u.buf), ABI_DATA_TYPE.BYTES)
        }
    }
    return 0
}