import {log} from "./prelude";

@external("env", "_u256")
// type, a, b, dst, put ? : length
declare function _u256(t: u64, left: u64, right: u64): u64;

enum U256Type {
    ADD,
    SUB,
    MUL,
    DIV,
    MOD
}

export class U256 {
    @operator("+")
    static __op_add(left: U256, right: U256): U256 {
        return left.safeAdd(right);
    }

    @operator("-")
    static __op_sub(left: U256, right: U256): U256 {
        return left.safeSub(right);
    }

    @operator("*")
    static __op_mul(left: U256, right: U256): U256 {
        return left.safeMul(right);
    }

    @operator("/")
    static __op_div(left: U256, right: U256): U256 {
        return left.safeDiv(right);
    }

    @operator("%")
    static __op_mod(left: U256, right: U256): U256 {
        return left.safeMod(right);
    }

    @operator(">")
    static __op_gt(left: U256, right: U256): bool {
        return left.compareTo(right) > 0;
    }

    @operator(">=")
    static __op_gte(left: U256, right: U256): bool {
        return left.compareTo(right) >= 0;
    }

    @operator("<")
    static __op_lt(left: U256, right: U256): bool {
        return left.compareTo(right) < 0;
    }

    @operator("<=")
    static __op_lte(left: U256, right: U256): bool {
        return left.compareTo(right) <= 0;
    }

    @operator("==")
    static __op_eq(left: U256, right: U256): bool {
        return left.compareTo(right) == 0;
    }

    @operator("!=")
    static __op_ne(left: U256, right: U256): bool {
        return left.compareTo(right) != 0;
    }

    static ZERO: U256 = new U256(new ArrayBuffer(0))
    static ONE: U256 = U256.fromU64(1)

    static fromU64(u: u64): U256 {
        const buf = Util.u64ToBytes(u);
        return new U256(buf);
    }

    constructor(readonly buf: ArrayBuffer) {
        assert(buf.byteLength <= 32, 'invalid u256: overflow')
    }

    private arithmetic(t: U256Type, u: U256): U256 {
        let r = _u256(t, changetype<usize>(this), changetype<usize>(u))
        return changetype<U256>(usize(r))
    }

    add(u: U256): U256 {
        return this.arithmetic(U256Type.ADD, u);
    }

    safeAdd(u: U256): U256 {
        const c = this.add(u);
        assert(c.compareTo(this) >= 0 && c.compareTo(u) >= 0, "SafeMath: addition overflow");
        return c;
    }

    sub(u: U256): U256 {
        return this.arithmetic(U256Type.SUB, u);
    }

    safeSub(u: U256): U256 {
        assert(u.compareTo(this) <= 0, "SafeMath: subtraction overflow x = " + this.toString() + " y = " + u.toString());
        return this.sub(u);
    }

    mul(u: U256): U256 {
        return this.arithmetic(U256Type.MUL, u);
    }

    safeMul(u: U256): U256 {
        if (this == u) {
            return U256.ZERO;
        }

        const c = this.mul(u);
        assert(c.div(this).compareTo(u) == 0, "SafeMath: multiplication overflow ");
        return c;
    }

    div(u: U256): U256 {
        return this.arithmetic(U256Type.DIV, u);
    }

    safeDiv(u: U256): U256 {
        assert(u.compareTo(U256.ZERO) > 0, "SafeMath: modulo by zero");
        return this.div(u);
    }

    mod(u: U256): U256 {
        return this.arithmetic(U256Type.MOD, u);
    }

    safeMod(u: U256): U256 {
        assert(u.compareTo(U256.ZERO) > 0, "SafeMath: modulo by zero");
        return this.mod(u);
    }

    compareTo(u: U256): i32 {
        return Util.compareBytes(this.buf, u.buf);
    }

    toString(): string {
        let bf = new ArrayBuffer(32)
        let v = Uint8Array.wrap(bf)
        v.set(Uint8Array.wrap(this.buf), 32 - this.buf.byteLength)
        return Util.encodeHex(bf)
    }

    static fromHex(str: string): U256 {
        let bf = Util.decodeHex(str)
        assert(bf.byteLength <= 32, 'u256 overflow')
        let v = Uint8Array.wrap(bf)
        let i = 0
        while(v[i] == 0){
            i++
        }
        return new U256(bf.slice(i, bf.byteLength))
    }
}

export class Util {
    static concatBytes(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
        let concated = new ArrayBuffer(a.byteLength + b.byteLength)
        let v = Uint8Array.wrap(concated)
        v.set(Uint8Array.wrap(a), 0);
        v.set(Uint8Array.wrap(b), a.byteLength);
        return concated;
    }

    // decode hex
    static decodeHex(hex: string): ArrayBuffer {
        let ret = new ArrayBuffer(hex.length / 2)
        let v = Uint8Array.wrap(ret)
        for (let i = 0; i < hex.length / 2; i++) {
            v[i] = U8.parseInt(hex.substr(i * 2, 2), 16)
        }
        return ret
    }

    static encodeHex(data: ArrayBuffer): string {
        let out = ""
        let v = Uint8Array.wrap(data)
        for (let i = 0; i < data.byteLength; i++) {
            const a = v[i] as u32
            const b = a & 0xf
            const c = a >> 4

            let x: u32 = ((87 + b + (((b - 10) >> 8) & ~38)) << 8) | (87 + c + (((c - 10) >> 8) & ~38));
            out += String.fromCharCode(x as u8);
            x >>= 8;
            out += String.fromCharCode(x as u8);
        }

        return out
    }

    static compareBytes(a: ArrayBuffer, b: ArrayBuffer): i32 {
        const x = Uint8Array.wrap(a);
        const y = Uint8Array.wrap(b);
        if (x.length > y.length)
            return 1;
        if (x.length < y.length)
            return -1;

        for (let i = 0; i < x.length; i++) {
            if (x[i] > y[i])
                return 1;
            if (x[i] < y[i])
                return -1;
        }
        return 0;
    }

    static str2bin(str: string): ArrayBuffer {
        return String.UTF8.encode(str);
    }

    // convert u64 to bytes without leading zeros, bigendian
    static u64ToBytes(u: u64): ArrayBuffer {
        let ret = new ArrayBuffer(8)
        let v = Uint8Array.wrap(ret)
        let i = 0
        while (u > 0) {
            v[7 - i] = u8(u & 0xff)
            u = u >>> 8
            i++
        }
        return ret.slice(8 - i, 8)
    }

    static bytesToU64(bytes: ArrayBuffer): u64 {
        let v = Uint8Array.wrap(bytes)
        let u = 0
        // 低位在后面
        let j = 0
        for(let i = v.length - 1; i >= 0; i--){
            u |= v[i] << (u8(j) * 8)
            j ++
        }
        return u
    }
}
