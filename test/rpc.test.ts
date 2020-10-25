import {RPC} from '../src'

const rpc = new RPC('localhost', 7010)

rpc.getTransaction('4b560e65aac9fbdffae3d89b860d8dd79d161b7e0419129e8a6b8b6d5b9792dc')
    .then(console.log)