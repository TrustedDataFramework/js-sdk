export class U256{
    private static ONE: U256 | null = null
    public static ZERO: U256 = new U256(new Uint8Array(32).buffer)

    static one(): U256{
        if(U256.ONE != null)
            return changetype<U256>(U256.ONE)

        const buf = new Uint8Array(32)
        buf[31] = 1
        U256.ONE = new U256(buf.buffer)
        return changetype<U256>(U256.ONE)
    }

    constructor(readonly buf: ArrayBuffer){

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
    lshift(): U256{
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
    rshift(): U256{
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

    private isZero(): bool{
        const u = Uint8Array.wrap(this.buf)
        for(let i = 0; i < u.length; i++){
            if(u[i] != 0)
                return false
        }
        return true
    }


    @operator("==")
    static __op_eq(left: U256, right: U256): bool {
        return Util.compareBytes(left.buf, right.buf) == 0
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
        let u: u64 = 0
        // 低位在后面
        let j = 0
        for(let i = v.length - 1; i >= 0; i--){
            u |= u64(v[i]) << (u8(j) << 3)
            j ++
        }
        return u
    }
}
