# js-sdk


## 安装

```bash
npm install --save @salaku/js-sdk
```

## 基本使用

### 常量

```js
const tdsSDK = require('@salaku/js-sdk')
console.log(tdsSDK.constants)
/*
constants 
{
  POA_VERSION: 1634693120,
  POW_VERSION: 7368567,
  POS_VERSION: 7368563,
  COINBASE: 0,
  TRANSFER: 1,
  DEPLOY: 2,
  CONTRACT_CALL: 3,
  PEER_AUTHENTICATION_ADDR: '0000000000000000000000000000000000000003',
  POA_AUTHENTICATION_ADDR: '0000000000000000000000000000000000000004',
  POS_CONTRACT_ADDR: '0000000000000000000000000000000000000005'
}
*/
```

### 事务签名

```js
const tdsSDK = require('@salaku/js-sdk')
const tx = tdsSDK.Transaction.from({
    "version" : 1634693120,
    "type" : 0,
    "createdAt" : 1596091121,
    "nonce" : 223814,
    "from" : "",
    "gasPrice" : 0,
    "amount" : 20,
    "payload" : "02b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936",
    "to" : "9cbf30db111483e4b84e77ca0e39378fd7605e1b",
})

// 填入事务和私钥
tdsSDK.sign(tx, 'f00df601a78147ffe0b84de1dffbebed2a6ea965becd5d0bd7faf54f1f29c6b5')
console.log(tx.signature)
```


### 计算事务哈希值

```js
const tdsSDK = require('@salaku/js-sdk')
const tx = tdsSDK.Transaction.from({
    "version" : 1634693120,
    "type" : 0,
    "createdAt" : 1596091121,
    "nonce" : 223814,
    "from" : "",
    "gasPrice" : 0,
    "amount" : 20,
    "payload" : "02b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936",
    "to" : "9cbf30db111483e4b84e77ca0e39378fd7605e1b",
})

console.log(tx.getHash())
```

### 公钥转地址

```js
const tdsSDK = require('@salaku/js-sdk')
const pk = '02a4d7ca616e70897b7874460da1aab58b56e54c200a08e52a04c69df26b138859' // 公钥
console.log(tdsSDK.publicKey2Address(pk))
```

### 生成随机的私钥

```js
const tdsSDK = require('@salaku/js-sdk')
const sk = tdsSDK.generatePrivateKey() // 私钥
console.log(sk)
```

### 私钥转公钥

```js
const tdsSDK = require('@salaku/js-sdk')
const sk = 'f00df601a78147ffe0b84de1dffbebed2a6ea965becd5d0bd7faf54f1f29c6b5' // 私钥
console.log(tdsSDK.privateKey2PublicKey(sk))
```

### 计算合约地址

```js
const tdsSDK = require('@salaku/js-sdk')
const pk = '02a4d7ca616e70897b7874460da1aab58b56e54c200a08e52a04c69df26b138859' // 公钥
const addr = tdsSDK.publicKey2Address(pk) // 合约构造者的地址
const nonce = '100' // nonce
console.log(tdsSDK.getContractAddress(addr, nonce))
```

### 编译 assembly script 合约（异步），需要 node 环境

```js
const tdsSDK = require('@salaku/js-sdk')
const ascPath = 'node_modules/.bin/asc'
const src = 'index.ts'
tdsSDK.compileContract(ascPath, src)
    .then(buf => console.log('buf length ' + buf.length))
```

### 生成 assembly script 合约 abi

```js
const fs = require('fs')
tdsSDK.compileABI(fs.readFileSync('assembly/coin.ts'))
```


## 使用事务构造器 TransactionBuilder

```js
const sk = 'f00df601a78147ffe0b84de1dffbebed2a6ea965becd5d0bd7faf54f1f29c6b5' // 私钥
const builder = new tdsSDK.TransactionBuilder(tdsSDK.constants.POA_VERSION, sk, /* gas limit */ 0, /* gas price */ 0)
```

如果 builder 的 nonce 为0，则构造好的事务不会被签名，如果 builder 的 nonce 不为0，则构造出的事务都是已经签名过的事务，且每构造一个事务 builder 的 nonce 会自增 1

### 构造转账事务

```js
const tx = builder.buildTransfer(1000, '****address****')
```

### 构造 POA 加入请求事务

```js
const tx = builder.buildAuthJoin(constants.PEER_AUTHENTICATION_ADDR)
tx.nonce = 1
builder.sign(tx)
```

### 构造 POA 同意请求事务

```js
const tx = builder.buildAuthApprove(constants.PEER_AUTHENTICATION_ADDR, '***同意的地址***')
```

### 构造 POA 退出事务并且签名

```js
const tx = builder.buildAuthExit(constants.PEER_AUTHENTICATION_ADDR)
```

### 构造 POS 投票事务

```js
const tx = builder.buildVote(1000, '***address***')
```

### 构造 POS 取消投票事务

```js
const tx = builder.buildCancelVote('***transaction hash***')
```

## RPC 工具类

```js
const rpc = new tdsSDK.RPC('localhost', 7010)
```

### 查看账户

```js
const pk = '02a4d7ca616e70897b7874460da1aab58b56e54c200a08e52a04c69df26b138859' // 公钥或者地址
rpc.getAccount(pk)
    .then(console.log)
```

### 获取 nonce

```js
const pk = '02a4d7ca616e70897b7874460da1aab58b56e54c200a08e52a04c69df26b138859' // 公钥
rpc.getNonce(pk)
    .then(nonce => console.log(`nonce = ${nonce}`))
```    

### 发送事务（异步）

```js
const tx = tdsSDK.Transaction.from({
    "version" : 1634693120,
    "type" : 0,
    "createdAt" : 1596091121,
    "nonce" : 223814,
    "from" : "",
    "gasPrice" : 0,
    "amount" : 20,
    "payload" : "02b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936",
    "to" : "9cbf30db111483e4b84e77ca0e39378fd7605e1b",
})

rpc.sendTransaction(tx)
.then(() => console.log('success'))
.catch(console.error)
```

### 发送事务并等待事务进入区块

```js
const tx = tdsSDK.Transaction.from({
    "version" : 1634693120,
    "type" : 0,
    "createdAt" : 1596091121,
    "nonce" : 223814,
    "from" : "",
    "gasPrice" : 0,
    "amount" : 20,
    "payload" : "02b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936",
    "to" : "9cbf30db111483e4b84e77ca0e39378fd7605e1b",
})

rpc.sendObserve(tx) 
.then(console.log) // 这里会打印出事务所在的区块以及gas消耗、手续费等信息
.catch(console.error)
```


### 查看区块（异步）

```js
rpc.getBlock(1) // 可以填区块哈希值或者区块高度
.then(console.log)
.catch(console.error)
```

### 查看区块头（异步）

```js
rpc.getHeader(1) // 可以填区块哈希值或者区块高度
.then(console.log)
.catch(console.error)
```

### 查看事务（异步）

```js
rpc.getTransaction('****') // 填写事务哈希
.then(console.log)
.catch(console.error)
// 事务的 confrims 字段 -1 表示在内存池中
// 0 或者以上表示被确认, confirms 表示确认数量
// 如出现异常，表示事务不存在
```


### 查看 POA 的 P2P 网络申请列表

```js
rpc.getAuthPending(constants.PEER_AUTHENTICATION_ADDR)
.then(console.log)
.catch(console.error)
```

### 查看 POA 的 P2P 网络已加入列表

```js
rpc.getAuthNodes(constants.PEER_AUTHENTICATION_ADDR)
.then(console.log)
.catch(console.error)
```

### 查看 POS 投票列表

```js
rpc.getPoSNodeInfos()
    .then(console.log)
    .catch(console.error)
```

### POS 根据事务哈希查看投票

```js
rpc.getPoSVoteInfo('**txhash**')
    .then(console.log)
    .catch(console.error)
```

### 撤回投票

撤回投票事务的 from 必须是投票事务的 from

```js
const tx = builder.buildCancelVote('c2458cad4c838b81b49500d9268b352b03cd1b78423c113f1b11f41c4ce13657')
```

## 智能合约编译部署和调用，假设入口文件如下
```ts
/**
 * erc 20 example in assembly script
 */

import { Util, U256, Globals, ABI_DATA_TYPE, ___idof} from '../lib'
import { Store } from '../lib'
import { Context, Address } from '../lib'

const _balance = Store.from<Address, U256>('balance');
const _freeze = Store.from<Address, U256>('freeze');

export function init(tokenName: string, symbol: string, totalSupply: U256, decimals: u64, owner: Address): void {
    // tokenName || symbol || totalSupply || decimals || owner
    Globals.set<string>('tokenName', tokenName);
    Globals.set<string>('symbol', symbol);
    Globals.set<U256>('totalSupply', totalSupply);
    Globals.set<u64>('decimals', decimals);
    Globals.set<Address>('owner', owner);
    _balance.set(owner, totalSupply);
}

// display balance
export function balanceOf(addr: Address): U256 {
    return _balance.getOrDefault(addr, U256.ZERO);
}


/* Send coins */
export function transfer(to: Address, amount: U256): void {
    const msg = Context.msg();
    assert(amount > U256.ZERO, 'amount is not positive');
    let b = balanceOf(msg.sender)
    assert(b >= amount, 'balance is not enough');
    _balance.set(to, balanceOf(to) + amount);
    _balance.set(msg.sender, balanceOf(msg.sender) - amount);
}

```

### 构造合约部署事务

```js
const contract = new tool.Contract()
// 编译合约得到字节码
contract.binary = await tool.compileContract(ascPath, 'assembly/coin.ts')
// 得到 abi
contract.abi = tool.compileABI(fs.readFileSync('assembly/coin.ts'))
// 写入 abi 文件
fs.writeFilesSync('coin.abi.json', JSON.stringify(contract.abi))
// 获取 nonce 
builder.nonce = (await rpc.getNonce(addr)) + 1

// 传入合约构造器参数
let tx = builder.buildDeploy(contract, {
    tokenName: 'doge',
    symbol: 'DOGE',
    totalSupply: '90000000000000000',
    decimals: 8,
    owner: addr
}, 0)
```

### 构造合约调用事务并且签名

```js
const abi = require('./coin.abi.json') // abi 文件
const contract = new tool.Contract('****address****', abi)
const tx = builder.buildContractCall(contract, 'transfer', ['****address****', 100000000], 0)
```

### 查看合约

```js
const abi = require('./coin.abi.json') // abi 文件
const contract = new tool.Contract('****address****', abi)
rpc.viewContract(contract, 'balanceOf', ['****address****'])
    .then(console.log)
```

### 生成 keystore

```js
const password = 'abc123'
const ks = tdsSDK.createKeyStore(password)
console.log(ks)
```

### 读取 keystore 中私钥
```js
const sk = tdsSDK.readKeyStore(
   {"publicKey":"0230632aa4863e9c0c027de7542b434adae169a8c439f595b244696bce306c8191","crypto":{"cipher":"sm4-128-ecb","cipherText":"f347b48dd1931d66d2e5bb8f4d030b3c5c5db9f32c3c763e6fadcd77de1b6886","iv":"5811eafed7a69b7f84c6b62d473afb0e","salt":"8d5196266292ff95778290983139ec427edea8639d0db37b9298924bf42879e6"},"id":"504e5c56-32da-41f8-8096-5160eda5936c","version":"1","mac":"a57423d830fd5267402838d7dc4e2ec6c54f8120797c369bc412b08585c32c88","kdf":"sm2-kdf","address":"521e3435917a9fe7b3e2841d8f9cf943758bf3e1"},
    "123456"
)
```

### 创建poa认证服务并启动

```js
// ['03e3198bd3c12ab68566fcf14903dee3456cd1e1d8a0121ca04aade9b752750216'] 是公钥白名单，只有持有此公钥对应的私钥的节点才能访问这个服务
const server = tdsSDK.createAuthServer(sk, ['03e3198bd3c12ab68566fcf14903dee3456cd1e1d8a0121ca04aade9b752750216'])

server.listen(3000, function () {
    console.log('服务器启动成功了，可以通过 http://127.0.0.1:3000/ 来进行访问')
})
```
