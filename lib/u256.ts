import { Util } from "./util"

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
        return left.divMod(right)[0]
    }

    // 求模不会溢出，除数不能为 0
    @operator("%")
    static __op_mod(left: U256, right: U256): U256 {
        return left.divMod(right)[1]
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
        const l = Uint8Array.wrap(this.buf)
        const r = Uint8Array.wrap(u.buf)
        const newData = new Uint8Array(32)
        for (let i = 31, overflow: u32 = 0; i >= 0; i--) {
            let v = u32(l[i]) + u32(r[i]) + overflow
            newData[i] = u8(v & 0xff)
            overflow = v >>> 8
        }
        return new U256(newData.buffer)
    }

    sub(u: U256): U256 {
        const r = Uint8Array.wrap(u.buf)
        const neg = new Uint8Array(32)
        for (let i = 0; i < neg.length; i++) {
            neg[i] = ~r[i]
        }
        const n = new U256(neg.buffer)
        return this.add(n.add(U256.one()))
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
        let ret = U256.ZERO
        let l = new U256(this.buf)
        while (!r.isZero()) {
            let n = r.lastBit()
            if (n) {
                ret = ret.add(l)
            }
            l = l.lshift()
            r = r.rshift()
        }
        return ret
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
            const dm = n.divMod(BASE)
            n = dm[0]
            let m = dm[1]
            ret = chars.charAt(i32(m.u64())) + ret
        }
        return ret
    }

    u64(): u64 {
        const arr = this.buf.slice(24, 32)
        return Util.bytesToU64(arr)
    }

    div(divisor: U256): U256 {
        return this.divMod(divisor)[0]
    }


    divMod(divisor: U256): U256[] {
        if (divisor == U256.ZERO)
            // 除法溢出
            unreachable()
        let dividend = new U256(this.buf)
        let quo = U256.ZERO
        for (let i = 255; i >= 0; i--) {
            //比较dividend是否大于divisor的(1<<i)次方，不要将dividend与(divisor<<i)比较，而是用(dividend>>i)与divisor比较，
            //效果一样，但是可以避免因(divisor<<i)操作可能导致的溢出，如果溢出则会可能dividend本身小于divisor，但是溢出导致dividend大于divisor       
            if (dividend.rshiftN(i) >= divisor) {
                quo = quo.add(U256.oneLshift(i))
                dividend = dividend.safeSub(divisor.lshiftN(i))
            }
        }
        return [quo, dividend]
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