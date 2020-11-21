export { __change_t, __malloc, __peek } from '../lib/prelude'
import {Context, Util} from '../lib'

export function init(): void{
    const msg = Context.msg()
    assert(msg.amount.u64() == 1234567890, 'msg amount')
    assert(msg.sender.toString() == '9cbf30db111483e4b84e77ca0e39378fd7605e1b', 'msg sender')
    const hd = Context.header()
    assert(hd.createdAt == 123456789, 'header created at is ' + hd.createdAt.toString())
    assert(hd.height == 2, 'header height is ' + hd.height.toString())
    // assert(Util.encodeHex(hd.parentHash) == '9cbf30db111483e4b84e77ca0e39378fd7605e1b')
    // const tx = Context.transaction()
    // log('tx type = ' + tx.type.toString())
    // log('tx created at = ' + tx.createdAt.toString())
    // log('tx nonce = ' + tx.nonce.toString())
    // log('tx origin = ' + tx.origin.toString())
    // log('tx gas price = ' + tx.gasPrice.u64().toString())
    // log('tx amount = ' + tx.amount.u64().toString())
    // log('tx to = ' + tx.to.toString())
    // log('tx signature = ' + Util.encodeHex(tx.signature))
    // log('tx hash = ' + Util.encodeHex(tx.hash))
}