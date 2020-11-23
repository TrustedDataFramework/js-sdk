export { __malloc, __change_t, __peek } from '../lib/prelude'

import { Address, RLP, RLPList, log, Util} from '../lib'

export function init(): ArrayBuffer{
    const u = new Donor('', '', 0, '', ZERO_ADDRESS, ZERO_ADDRESS, '')
    const encoded = u.getEncoded()
    assert(Util.encodeHex(encoded) == 'f480808080940000000000000000000000000000000000000000940000000000000000000000000000000000000000808080808080')
    const d = Donor.fromEncoded(encoded)
    assert(d.address == ZERO_ADDRESS)
    return encoded
}

export const ZERO_ADDRESS = new Address(new Uint8Array(20).buffer)
export const ZERO_HASH = new Uint8Array(32).buffer

export class Donor {
  // 捐赠姓名
  name: string
  // 捐赠内容
  content: string
  // 捐赠数量
  quantity: u64
  // 简介信息
  info: string
  // 捐赠地址
  address: Address
  // 受益人
  get: Address
  // 捐赠机构
  donor: string
  // 上链区块高度
  blockHeight: u64
  // 上链事务哈希值
  txHash: ArrayBuffer
  // 上链时间戳
  timestamp: u64
  // 是否被确认
  confirmed: boolean
  // 确认事务的哈希值
  confirmHash: ArrayBuffer

  constructor(
    name: string,
    content: string,
    quantity: u64,
    info: string,
    address: Address,
    get: Address,
    donor: string
  ) {
    this.name = name
    this.content = content
    this.quantity = quantity
    this.info = info
    this.address = address
    this.get = get
    this.donor = donor
    this.txHash = new ArrayBuffer(0)
    this.confirmHash = new ArrayBuffer(0)
  }

  // 从 rlp 解码
  static fromEncoded(buf: ArrayBuffer): Donor {
    const u = new Donor('', '', 0, '', ZERO_ADDRESS, ZERO_ADDRESS, '')
    let i = 0
    const li = RLPList.fromEncoded(buf)
    u.name = li.getItem(i++).string()
    u.content = li.getItem(i++).string()
    u.quantity = li.getItem(i++).u64()
    u.info = li.getItem(i++).string()
    u.address = new Address(li.getItem(i++).bytes())
    u.get = new Address(li.getItem(i++).bytes())
    u.donor = li.getItem(i++).string()
    u.blockHeight = li.getItem(i++).u64()
    u.txHash = li.getItem(i++).bytes()
    u.timestamp = li.getItem(i++).u64()
    u.confirmed = li.getItem(i++).u8() != 0
    u.confirmHash = li.getItem(i++).bytes()
    return u
  }

  // rlp 编码
  getEncoded(): ArrayBuffer {
    const els = new Array<ArrayBuffer>()
    els.push(RLP.encodeString(this.name))
    els.push(RLP.encodeString(this.content))
    els.push(RLP.encodeU64(this.quantity))
    els.push(RLP.encodeString(this.info))
    els.push(RLP.encode<Address>(this.address))
    els.push(RLP.encode<Address>(this.get))
    els.push(RLP.encodeString(this.donor))
    els.push(RLP.encodeU64(this.blockHeight))
    els.push(RLP.encodeBytes(this.txHash))
    els.push(RLP.encodeU64(this.timestamp))
    els.push(RLP.encodeU64(this.confirmed ? 1 : 0))
    els.push(RLP.encodeBytes(this.confirmHash))
    return RLP.encodeElements(els)
  }
}