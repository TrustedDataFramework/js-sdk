import { Util } from "./util"

// @ts-ignore
@external("env", "_u256")
// type, address?
declare function _u256(op: u64, left: u64, right: u64): u64;

function _u256_op(op: U256OP, left: U256, right: U256): U256 {
    let l = changetype<usize>(left)
    let r = changetype<usize>(right)
    return changetype<U256>(usize(_u256(u64(op), u64(l), u64(r))))
}


enum U256OP {
    SUM,
    SUB,
    MUL,
    DIV,
    MOD
}


const chars = '0123456789'

export class U256 {
    public static ZERO: U256 = new U256(new Uint8Array(32).buffer)
    readonly buf: ArrayBuffer

    @operator("+")
    static __op_add(left: U256, right: U256): U256 {
        return left.safeAdd(right)
    }
    @operator("-")
    static __op_sub(left: U256, right: U256): U256 {
        return left.safeSub(right)
    }

    @operator("*")
    static __op_mul(left: U256, right: U256): U256 {
        return left.safeMul(right)
    }

    // 除法不会溢出，除数不能为 0
    @operator("/")
    static __op_div(left: U256, right: U256): U256 {
        return left.div(right)
    }

    // 求模不会溢出，除数不能为 0
    @operator("%")
    static __op_mod(left: U256, right: U256): U256 {
        return left.mod(right)
    }

    @operator(">")
    static __op_gt(left: U256, right: U256): bool {
        return left.compareTo(right) > 0
    }
    @operator(">=")
    static __op_gte(left: U256, right: U256): bool {
        return left.compareTo(right) >= 0
    }
    @operator("<")
    static __op_lt(left: U256, right: U256): bool {
        return left.compareTo(right) < 0
    }
    @operator("<=")
    static __op_lte(left: U256, right: U256): bool {
        return left.compareTo(right) <= 0
    }
    @operator("==")
    static __op_eq(left: U256, right: U256): bool {
        return left.compareTo(right) == 0
    }

    @operator("!=")
    static __op_not_eq(left: U256, right: U256): bool {
        return left.compareTo(right) != 0
    }

    compareTo(u: U256): i32 {
        return Util.compareBytes(this.buf, u.buf)
    }

    static one(): U256 {
        const buf = new Uint8Array(32)
        buf[31] = 1
        return new U256(buf.buffer)
    }

    static max(): U256 {
        const buf = new Uint8Array(32)
        for (let i = 0; i < buf.length; i++) {
            buf[i] = u8(0xff)
        }
        return new U256(buf.buffer)
    }

    constructor(buf: ArrayBuffer) {
        if (buf.byteLength > 32) {
            unreachable()
        }
        const u = new Uint8Array(32)
        u.set(Uint8Array.wrap(buf), 32 - buf.byteLength)
        this.buf = u.buffer
    }

    add(u: U256): U256 {
        return _u256_op(U256OP.SUM, this, u)
    }

    sub(u: U256): U256 {
        return _u256_op(U256OP.SUB, this, u)
    }

    // 左移 n 个 单位
    lshiftN(n: i32): U256 {
        if (n < 0)
            unreachable()
        let count = n / 8
        let offset = u8(n % 8)
        let r = new Uint8Array(32)
        let u = Uint8Array.wrap(this.buf)
        for (let i = 31; i >= 0; i--) {
            let j = i - count
            if (j >= 0) {
                // u8 << 8 会被忽略，所以先转成 u32 再移位
                r[j] |= u8((u32(u[i]) << offset) & u32(0xff))
            }
            if (j > 0) {
                const mask = (u32(0xff) << (8 - offset))
                const x = (u32(u[i]) & mask) >> (8 - offset)
                r[j - 1] |= u8(x & 0xff)
            }
        }
        return new U256(r.buffer)
    }

    rshiftN(n: i32): U256 {
        if (n < 0)
            unreachable()

        let count = n / 8
        let offset = u8(n % 8)

        let r = new Uint8Array(32)
        let u = Uint8Array.wrap(this.buf)
        for (let i = 0; i < u.length; i++) {
            let j = i + count
            if (j < r.length) {
                r[j] |= u8((u32(u[i]) >> offset) & 0xff)
            }
            if (j + 1 < r.length) {
                const mask = u32(0xff) >> (8 - offset)
                let x = (u32(u[i]) & mask) << (8 - offset)
                r[j + 1] |= u8(x & 0xff)
            }
        }
        return new U256(r.buffer)
    }

    // 左移动一个 bit ，相当于乘以2
    lshift(): U256 {
        let r = new Uint8Array(32)
        let u = Uint8Array.wrap(this.buf)
        for (let i = 0; i < r.length; i++) {
            r[i] = u[i] << 1
            if (i + 1 < u.length) {
                r[i] |= (u[i + 1] & 0x80) >> 7
            }
        }
        return new U256(r.buffer)
    }

    // 右移动一个 bit ，相当于除以2
    rshift(): U256 {
        let r = new Uint8Array(32)
        let u = Uint8Array.wrap(this.buf)
        for (let i = u.length - 1; i >= 0; i--) {
            r[i] = u[i] >> 1
            if (i - 1 >= 0) {
                r[i] |= (u[i - 1] & 0x01) << 7
            }
        }
        return new U256(r.buffer)
    }

    lastBit(): bool {
        let arr = Uint8Array.wrap(this.buf)
        return (arr[31] & 1) > 0
    }

    mul(r: U256): U256 {
        return _u256_op(U256OP.MUL, this, r)
    }

    safeMul(u: U256): U256 {
        if (this == U256.ZERO || u == U256.ZERO) {
            return U256.ZERO;
        }

        const c = this.mul(u)
        assert(c.div(this).compareTo(u) == 0, "SafeMath: multiplication overflow ")
        return c
    }

    safeAdd(u: U256): U256 {
        const c = this.add(u);
        assert(c.compareTo(this) >= 0 && c.compareTo(u) >= 0, "SafeMath: addition overflow");
        return c;
    }


    safeSub(u: U256): U256 {
        assert(u.compareTo(this) <= 0, "SafeMath: subtraction overflow x = " + this.toString() + " y = " + u.toString());
        return this.sub(u);
    }

    isZero(): bool {
        if(this == U256.ZERO)
            return true
        const u = Uint8Array.wrap(this.buf)
        for (let i = 0; i < u.length; i++) {
            if (u[i] != 0)
                return false
        }
        return true
    }

    toString(): string {
        let ret = ''
        const BASE = U256.fromU64(10)
        let n = new U256(this.buf)
        if (n == U256.ZERO)
            return '0'
        while (n > U256.ZERO) {
            const div = n.div(BASE)
            const m = n.mod(BASE)
            n = div
            ret = chars.charAt(i32(m.u64())) + ret
        }
        return ret
    }

    u64(): u64 {
        const arr = this.buf.slice(24, 32)
        return Util.bytesToU64(arr)
    }

    div(divisor: U256): U256 {       
        return _u256_op(U256OP.DIV, this, divisor)
    }

    mod(divisor: U256): U256 {
        return _u256_op(U256OP.MOD, this, divisor)
    }

    public static oneLshift(i: i32): U256 {
        let count = i / 8
        let offset = i % 8
        const r = new Uint8Array(32)
        r[31 - count] = (1 << offset)
        return new U256(r.buffer)
    }

    static fromU64(u: u64): U256 {
        const bytes = Util.u64ToBytes(u)
        const v = Uint8Array.wrap(bytes)
        const arr = new Uint8Array(32)
        arr.set(v, arr.length - v.length)
        return new U256(arr.buffer)
    }

    static fromHex(hex: string): U256 {
        const buf = Util.decodeHex(hex)
        return new U256(buf)
    }
}