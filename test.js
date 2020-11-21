

export class Word{
    private static ONE: Word | null = null
    public static ZERO: Word = new Word(new Uint8Array(32).buffer)

    static one(): Word{
        if(Word.ONE != null)
            return changetype<Word>(Word.ONE)

        const buf = new Uint8Array(32)
        buf[31] = 1
        Word.ONE = new Word(buf.buffer)
        return changetype<Word>(Word.ONE)
    }

    constructor(readonly buf: ArrayBuffer){

}

add(u: Word): Word{
    const l = Uint8Array.wrap(this.buf)
    const r = Uint8Array.wrap(u.buf)
    const newData = new Uint8Array(32)
    for (let i = 31, overflow = 0; i >= 0; i--) {
        let v = (l[i] as u32) + (r[i] as u32) + overflow
        newData[i] = u8(v)
        overflow = v >>> 8
    }
    return new Word(newData.buffer)
}

sub(u: Word): Word{
    const r = Uint8Array.wrap(u.buf)
    const neg = new Uint8Array(32)
    for(let i = 0; i < neg.length; i++){
        neg[i] = ~r[i]
    }
    const n = new Word(neg.buffer)
    return this.add(n.add(Word.one()))
}


// 左移动一个 bit ，相当于乘以2
lshift(): Word{
    let r = new Uint8Array(32)
    let u = Uint8Array.wrap(this.buf)
    for(let i = 0; i < r.length; i++){
        r[i] = (u[i] << 1) & 0xff
        if(i + 1 < u.length){
            r[i] |= (u[i + 1] & 0x80) >> 7
        }
    }
    return new Word(r.buffer)
}

// 右移动一个 bit ，相当于除以2
rshift(): Word{
    let r = new Uint8Array(32)
    let u = Uint8Array.wrap(this.buf)
    for(let i = u.length - 1; i >= 0; i--){
        r[i] = (u[i] >> 1) & 0xff
        if(i - 1 >= 0){
            r[i] |= (u[i - 1] & 0x01) << 7
        }
    }
    return new Word(r.buffer)
}

bit(n: i32): bool{
    const u = Uint8Array.wrap(this.buf)
    return (u[n / 8] & (1 << (u8(n) % 8))) > 0
}

mul(r: Word): Word{
    let ret = Word.ZERO
    let l = new Word(this.buf)
    while (!r.isZero()){
        let n = r.bit(255)
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
static __op_eq(left: Word, right: Word): bool {
    return Util.compareBytes(left.buf, right.buf) == 0
}

toString(): string{
    return Util.encodeHex(this.buf)
}

u64(): u64{
    const arr = this.buf.slice(24, 32)
    return Util.bytesToU64(arr)
}

static fromU64(u: u64): Word{
    const bytes = Util.u64ToBytes(u)
    const v = Uint8Array.wrap(bytes)
    const arr = new Uint8Array(32)
    arr.set(v, arr.length - v.length)
    return new Word(arr.buffer)
}
}