export { __change_t, __malloc, __peek} from '../lib/prelude'

import {Address, Context, ParametersBuilder, U256} from "../lib";

export function init(): Address{
    return Context.self()
}

export function echo(i: u64): u64{
    return i
}

export function proxy(addr: Address, i: u64): u64{
    const bd = new ParametersBuilder()
    bd.push<u64>(i)
    return addr.call<u64>('echo', bd.build(), U256.ZERO)
}