export { __change_t, __malloc, __peek} from '../lib/prelude'

import { DB, Util } from '../lib'

export function init(): void{
    const k = Util.str2bin('key')
    const v = Util.str2bin('val')
    assert(!DB.has(v))
    DB.set(k, v)
    assert(DB.has(k))
    assert(String.UTF8.decode(DB.get(k)) == 'val')
}
