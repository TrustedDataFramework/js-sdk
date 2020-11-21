export class Util {
    static concatBytes(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
        let concat = new ArrayBuffer(a.byteLength + b.byteLength)
        let v = Uint8Array.wrap(concat)
        v.set(Uint8Array.wrap(a), 0);
        v.set(Uint8Array.wrap(b), a.byteLength);
        return concat;
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
