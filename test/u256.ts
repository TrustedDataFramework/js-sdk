export { __change_t, __malloc, __peek } from '../lib/prelude'
import { U256, log, Util, Context, Address } from '../lib'

const u = U256.fromHex('ffffffffffffffff')

export function init(): Address{
    // 加法
    // @ts-ignore
    assert(U256.fromU64(123456789) + U256.fromU64(456789) == U256.fromU64(123913578), 'u256 add')

    // 减法
    // @ts-ignore    
    assert((u - U256.one()) == U256.fromU64(u64.MAX_VALUE - 1), 'substract ')

    // 乘法
    // @ts-ignore
    assert((U256.fromU64(123456789) * U256.fromU64(456789)) == U256.fromU64(56393703190521), 'u256 mul')

    // 除法
    // @ts-ignore
    assert((U256.fromU64(123456789) / U256.fromU64(456789)) == U256.fromU64(270), 'u256 div')
    return Context.self()
}

export function getOne(): U256{
    return U256.one()
}
