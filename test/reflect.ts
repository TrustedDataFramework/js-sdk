export { __change_t, __malloc, __peek} from '../lib/prelude'

import {Address, Context, Parameters, ParametersBuilder, U256} from "../lib";

export function init(): Address{
    return Context.self()
}

// deploy self, and return new address
export function clone(): Address {
    const bd = new ParametersBuilder()
    let params = bd.build<Address>()
    return Context.create<Address>(Context.self().code(), Context.self().abi(), params, U256.ZERO)
}

export function echo(i: u64): u64{
    return i
}

// call another contract
export function proxy(addr: Address, i: u64): u64{
    const bd = new ParametersBuilder()
    bd.push<u64>(i)
    return addr.call<u64>('echo', bd.build<u64>(), U256.ZERO)
}