import { WorkerData } from './constants'
import { workerData } from 'worker_threads'
import { convert } from './utils'
import { VirtualMachine } from './vm'
import rlp = require('./rlp')

const d: WorkerData = workerData

const vm = VirtualMachine.fromDump(d.dumped)

vm.callInternal(d.method, d.ctx, d.params)
  .then((r) => {
    const dumped = vm.dump()
    const v = new DataView(d.buf)
    const u8 = new Uint8Array(d.buf)
    v.setInt32(0, dumped.byteLength, false)
    VirtualMachine.fromDump(dumped)
    u8.set(new Uint8Array(dumped), 4)
    if (d.ret.length > 0) {
      const enc = rlp.encode([convert(r.result, d.ret[0])])
      v.setInt32(4 + dumped.byteLength, enc.length, false)
      u8.set(enc, 4 + dumped.byteLength + 4)
    }

    Atomics.store(d.lock, 0, 1)
    Atomics.notify(d.lock, 0)
  })
  .catch(console.error)
