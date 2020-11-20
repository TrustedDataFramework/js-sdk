enum Algorithm{
    SM3, KECCAK256
}

// @ts-ignore
@external("env", "_hash")
declare function _hash(type: u64, ptr: u64): u64;

export class Hash {
    private static hash(data: ArrayBuffer, alg: Algorithm): ArrayBuffer{
        let r = _hash(alg, changetype<usize>(data))
        return changetype<ArrayBuffer>(usize(r))
    }

    static keccak256(data: Uint8Array): ArrayBuffer{
        return Hash.hash(data, Algorithm.KECCAK256)
    }

    static sm3(data: Uint8Array): ArrayBuffer{
        return Hash.hash(data, Algorithm.SM3)
    }
}