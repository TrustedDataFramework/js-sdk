// @ts-ignore
@external("env", "_log")
declare function _log(offset: usize, len: usize): void;

// @ts-ignore
@external("env", "abort")
declare function abort(
    message: string | null,
    fileName: string | null,
    lineNumber: u32,
    columnNumber: u32
): void

// @ts-ignore
export function log(a: string): void {
    const str = String.UTF8.encode(a);
    _log(changetype<usize>(str), str.byteLength)
}

export * from './context';
export * from './rlp'
export * from './db';
export * from './safemath'
export * from './hash'
export * from './util'