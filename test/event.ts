import { Context, RLP } from '../lib'

export { __change_t, __malloc, __peek} from '../lib/prelude'

@unmanaged
class Some {
    constructor(readonly name: string, readonly age: u64) {

    }
}

function encodeSome(s: Some): ArrayBuffer{
    const arr: ArrayBuffer[] = [
        RLP.encodeString(s.name),
        RLP.encodeU64(s.age)
    ]

    return RLP.encodeElements(arr)
}

export function init(): void {
    Context.emit('Some', encodeSome(new Some("inittttt", 111111)))
}
