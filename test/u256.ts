export { __change_t, __malloc, __peek } from '../lib/prelude'
import { U256, log, Util, Context, Address } from '../lib'

const u = U256.fromHex('ffffffffffffffff')

export function init(): Address{
    return Context.self()
}

export function getOne(): U256{
    return U256.one()
}

export function add(x: U256, y: U256): U256{
    // @ts-ignore
    return x + y
}

export function sub(x: U256, y: U256): U256{
    // @ts-ignore
    return x - y
}

export function mul(x: U256, y: U256): U256{
    // @ts-ignore
    return x * y
}

export function mulUnsafe(x: U256, y: U256): U256{
    // @ts-ignore
    return x.mul(y)
}

export function div(x: U256, y: U256): U256{
    // @ts-ignore
    return x / y
}

export function mod(x: U256, y: U256): U256{
    // @ts-ignore
    return x % y
}