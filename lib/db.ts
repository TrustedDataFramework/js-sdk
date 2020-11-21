import { Util } from './util'
import { RLP } from './rlp'

enum Type {
    SET, GET, REMOVE, HAS
}

// @ts-ignore
@external("env", "_db")
declare function _db(type: u64, arg1: u64, arg2: u64): u64;

export class Store<K, V>{
    static from<U, R>(str: string): Store<U, R>{
        return new Store(Util.str2bin(str));
    }
    constructor(readonly prefix: ArrayBuffer) {
    }

    private _key(key: K): ArrayBuffer{
        return Util.concatBytes(this.prefix, RLP.encode<K>(key));
    }

    set(key: K, value: V): void {
        DB.set(this._key(key), RLP.encode<V>(value));
    }

    remove(key: K): void {
        DB.remove(this._key(key));
    }

    has(key: K): bool {
        return DB.has(this._key(key));
    }

    getOrDefault(key: K, def: V): V {
        return this.has(key) ? this.get(key) : def;
    }

    get(key: K): V {
        return RLP.decode<V>(DB.get(this._key(key)));
    }
}

export class Globals{
    static set<V>(str: string, value: V): void {
        DB.set(Util.str2bin(str), RLP.encode<V>(value));
    }

    static get<V>(str: string): V {
        return RLP.decode<V>(DB.get(Util.str2bin(str)));
    }

    static getOrDefault<V>(str: string, value: V): V {
        return DB.has(Util.str2bin(str)) ? RLP.decode<V>(DB.get(Util.str2bin(str))) : value;
    }

    static has(str: string): bool {
        return DB.has(Util.str2bin(str));
    }
}

export class DB {

    static set(key: ArrayBuffer, value: ArrayBuffer): void {
        _db(
            Type.SET,
            changetype<usize>(key),
            changetype<usize>(value),
        )
    }

    static remove(key: ArrayBuffer): void {
        _db(
            Type.REMOVE,
            changetype<usize>(key), 0
        )
    }


    static has(key: ArrayBuffer): bool {
        return _db(Type.HAS, changetype<usize>(key), 0) > 0
    }

    static get(key: ArrayBuffer): ArrayBuffer {
        let r = _db(Type.GET, changetype<usize>(key), 0)
        return changetype<ArrayBuffer>(usize(r))
    }
}
