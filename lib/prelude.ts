import {ABI_DATA_TYPE, Address} from "./context";
import { U256 } from "./util";
import {log} from "./index";

enum CharSet{
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
    log(`ABORT: ${message} - ${fileName}:${lineNumber.toString()}`)
    unreachable()
}

export function __meta(): usize{
    const buf = new Uint8Array(2)
    buf[0] = 2
    buf[1] = CharSet.UTF16LE
    changetype<usize>(buf.buffer)
    return changetype<usize>(buf.buffer)
}

export function __malloc(size: usize, type: ABI_DATA_TYPE): u64{
    switch (type) {
        case ABI_DATA_TYPE.STRING:{
            const ret = u64(__new(size, idof<string>()))
            return ret << 32 | ret
        }
        case ABI_DATA_TYPE.BYTES:{
            const buf = new ArrayBuffer(size)
            const ret = u64(changetype<usize>(buf))
            return ret << 32 | ret
        }
        case ABI_DATA_TYPE.ADDRESS:{
            let addr = new Address(new ArrayBuffer(size))
            const ret = u64(changetype<usize>(addr.buf))
            return (u64(changetype<usize>(addr)) << 32) | ret
        }
        case ABI_DATA_TYPE.U256:{
            let u = new U256(new ArrayBuffer(size))
            const ret = u64(changetype<usize>(u.buf))
            return  (u64(changetype<usize>(u)) << 32) | ret
        }
    }
    return 0
}

export function __mpeek(ptr: usize, type: ABI_DATA_TYPE): u64{
    switch (type) {
        case ABI_DATA_TYPE.STRING:{
            const str = changetype<string>(ptr)
            let len = u64(str.length * 2)
            return  (len << 32) | ptr
        }
        case ABI_DATA_TYPE.BYTES:{
            const buf = changetype<ArrayBuffer>(ptr)
            let len = u64(buf.byteLength)
            return (len << 32) | ptr
        }
        case ABI_DATA_TYPE.ADDRESS:{
            let addr = changetype<Address>(ptr)
            let len = u64(addr.buf.byteLength)
            return (len << 32) | u64(changetype<usize>(addr.buf))
        }
        case ABI_DATA_TYPE.U256:{
            let u = changetype<U256>(ptr)
            let len = u64(u.buf.byteLength)
            return (len << 32) | u64(changetype<usize>(u.buf))
        }
    }
    return 0
}