export { __change_t, __malloc, __peek } from '../lib/prelude'
import {Context, TransactionType, Util} from '../lib'

export function init(): void{
    const msg = Context.msg()
    assert(msg.amount.u64() == 1234567890, 'msg amount')
    assert(msg.sender.toString() == '9cbf30db111483e4b84e77ca0e39378fd7605e1b', 'msg sender')
    const hd = Context.header()
    assert(hd.createdAt == 123456789, 'header created at is ' + hd.createdAt.toString())
    assert(hd.height == 2, 'header height is ' + hd.height.toString())
    assert(Util.encodeHex(hd.parentHash) == '9cbf30db111483e4b84e77ca0e39378fd7605e1b')
    const tx = Context.transaction()
    assert(tx.type == TransactionType.CONTRACT_DEPLOY, 'tx type should be deploy')
    assert(tx.createdAt == 12345, 'tx created at')
    assert(tx.nonce == 2, 'tx nonce')
    assert(tx.origin.toString() == '9cbf30db111483e4b84e77ca0e39378fd7605e1b', 'tx origin')
    assert(tx.gasPrice.u64() == 123456789, 'tx gas price is ' + tx.gasPrice.u64().toString())
    assert(tx.amount.u64() == 1234567890, 'tx amount')
    assert(tx.to.toString() == '9cbf30db111483e4b84e77ca0e39378fd7605e1b')
    assert(Util.encodeHex(tx.signature) == '9cbf30db111483e4b84e77ca0e39378fd7605e1b')
    assert(Util.encodeHex(tx.hash) == '9cbf30db111483e4b84e77ca0e39378fd7605e1b')
    // log('tx hash = ' + Util.encodeHex(tx.hash))
}