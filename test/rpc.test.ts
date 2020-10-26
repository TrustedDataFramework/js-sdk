import {RPC, constants, TransactionBuilder, privateKey2PublicKey} from '../src'

const privateKeys = require('../local/privateKeys')
const rpc = new RPC('localhost', 7010)
const bd = new TransactionBuilder()

async function syncNonce() {
    const n = await rpc.getNonce(privateKey2PublicKey(bd.sk))
    let num = typeof n === 'string' ? parseInt(n) : n
    num++
    bd.nonce = num.toString(10)
}

rpc.getAuthNodes(constants.POA_AUTHENTICATION_ADDR)
.then(console.log)