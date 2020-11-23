import { Util } from "./util";

export class U256{
    private static ONE: U256 | null = null
    public static ZERO: U256 = new U256(new Uint8Array(32).buffer)
    readonly buf: ArrayBuffer

    @operator("+")
    static __op_add(left: U256, right: U256): U256 {
        return left.safeAdd(right);
    }
    @operator("-")
    static __op_sub(left: U256, right: U256): U256 {
        return left.safeSub(right);
    }

    @operator(">")
    static __op_gt(left: U256, right :U256): bool {
        return left.compareTo(right) > 0;
    }
    @operator(">=")
    static __op_gte(left: U256, right :U256): bool {
        return left.compareTo(right) >= 0;
    }
    @operator("<")
    static __op_lt(left: U256, right :U256): bool {
        return left.compareTo(right) < 0;
    }
    @operator("<=")
    static __op_lte(left: U256, right :U256): bool {
        return left.compareTo(right) <= 0;
    }
    @operator("==")
    static __op_eq(left: U256, right :U256): bool {
        return left.compareTo(right) == 0;
    }

    compareTo(u: U256): i32{
        return Util.compareBytes(this.buf, u.buf)
    }

    static one(): U256{
        if(U256.ONE != null)
            return changetype<U256>(U256.ONE)

        const buf = new Uint8Array(32)
        buf[31] = 1
        U256.ONE = new U256(buf.buffer)
        return changetype<U256>(U256.ONE)
    }

    constructor(buf: ArrayBuffer){
        if(buf.byteLength > 32){
            unreachable()
        }
        const u = new Uint8Array(32)
        u.set(Uint8Array.wrap(buf), 32 - buf.byteLength)
        this.buf = u.buffer
    }

    add(u: U256): U256{
        const l = Uint8Array.wrap(this.buf)
        const r = Uint8Array.wrap(u.buf)
        const newData = new Uint8Array(32)
        for (let i = 31, overflow = 0; i >= 0; i--) {
            let v = (l[i] as u32) + (r[i] as u32) + overflow
            newData[i] = u8(v)
            overflow = v >>> 8
        }
        return new U256(newData.buffer)
    }

    sub(u: U256): U256{
        const r = Uint8Array.wrap(u.buf)
        const neg = new Uint8Array(32)
        for(let i = 0; i < neg.length; i++){
            neg[i] = ~r[i]
        }
        const n = new U256(neg.buffer)
        return this.add(n.add(U256.one()))
    }


    // 左移动一个 bit ，相当于乘以2
    private lshift(): U256{
        let r = new Uint8Array(32)
        let u = Uint8Array.wrap(this.buf)
        for(let i = 0; i < r.length; i++){
            r[i] = (u[i] << 1) & 0xff
            if(i + 1 < u.length){
                r[i] |= (u[i + 1] & 0x80) >> 7
            }
        }
        return new U256(r.buffer)
    }

    // 右移动一个 bit ，相当于除以2
    private rshift(): U256{
        let r = new Uint8Array(32)
        let u = Uint8Array.wrap(this.buf)
        for(let i = u.length - 1; i >= 0; i--){
            r[i] = (u[i] >> 1) & 0xff
            if(i - 1 >= 0){
                r[i] |= (u[i - 1] & 0x01) << 7
            }
        }
        return new U256(r.buffer)
    }

    lastBit(): bool{
        let arr = Uint8Array.wrap(this.buf)
        return (arr[31] & 1) > 0
    }

    mul(r: U256): U256{
        let ret = U256.ZERO
        let l = new U256(this.buf)
        while (!r.isZero()){
            let n = r.lastBit()
            if(n){
                ret = ret.add(l)
            }
            l = l.lshift()
            r = r.rshift()
        }
        return ret
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

    isZero(): bool{
        const u = Uint8Array.wrap(this.buf)
        for(let i = 0; i < u.length; i++){
            if(u[i] != 0)
                return false
        }
        return true
    }

    toString(): string{
        return Util.encodeHex(this.buf)
    }

    u64(): u64{
        const arr = this.buf.slice(24, 32)
        return Util.bytesToU64(arr)
    }

    static fromU64(u: u64): U256{
        const bytes = Util.u64ToBytes(u)
        const v = Uint8Array.wrap(bytes)
        const arr = new Uint8Array(32)
        arr.set(v, arr.length - v.length)
        return new U256(arr.buffer)
    }

    static fromHex(hex: string): U256{
        const buf = Util.decodeHex(hex)
        return new U256(buf)
    }
}