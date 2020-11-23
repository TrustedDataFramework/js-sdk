export { __change_t, __malloc, __peek } from '../lib/prelude'
import { U256, log, Util, Context, Address } from '../lib'

const u = U256.fromHex('ffffffffffffffff')

export function init(): Address{
    assert(u - U256.one() == U256.fromU64(u64.MAX_VALUE - 1), 'substract ')
    return Context.self()
}

export function getOne(): U256{
    return U256.one()
}
