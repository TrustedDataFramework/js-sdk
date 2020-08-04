# js-sdk


## 安装

```bash
npm install --save @salaku/js-sdk
```

## 基本使用

### 常量

```js
const tool = require('@salaku/js-sdk')
console.log(constants)
constants ==
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

```

### 事务签名

```js
const tool = require('@salaku/js-sdk')
const tx = {
    "version" : 1634693120,
    "type" : 0,
    "createdAt" : 1596091121,
    "nonce" : 223814,
    "from" : "",
    "gasPrice" : 0,
    "amount" : 20,
    "payload" : "02b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936",
    "to" : "9cbf30db111483e4b84e77ca0e39378fd7605e1b",
}

// 填入事务和私钥
tool.sign(tx, 'f00df601a78147ffe0b84de1dffbebed2a6ea965becd5d0bd7faf54f1f29c6b5')
console.log(tx.signature)
```


### 计算事务哈希值

```js
const tool = require('@salaku/js-sdk')
const tx = {
    "version" : 1634693120,
    "type" : 0,
    "createdAt" : 1596091121,
    "nonce" : 223814,
    "from" : "",
    "gasPrice" : 0,
    "amount" : 20,
    "payload" : "02b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936",
    "to" : "9cbf30db111483e4b84e77ca0e39378fd7605e1b",
}

console.log(tool.getTransactionHash(tx).toString('hex'))
```

### 构造 payload 或者 parameters

例如调用 call 方法，填入 [255, 255] 参数
```js
const tool = require('@salaku/js-sdk')
const p = tool.buildPayload("call", Buffer.from('ffff', 'hex')).toString('hex')
console.log(p)
```

### 公钥转地址

```js
const tool = require('@salaku/js-sdk')
const pk = '02a4d7ca616e70897b7874460da1aab58b56e54c200a08e52a04c69df26b138859' // 公钥
console.log(tool.publicKey2Address(pk))
```

### 私钥转公钥

```js
const tool = require('@salaku/js-sdk')
const sk = 'f00df601a78147ffe0b84de1dffbebed2a6ea965becd5d0bd7faf54f1f29c6b5' // 私钥
console.log(tool.privateKey2PublicKey(sk))
```

### 计算合约地址

```js
const tool = require('@salaku/js-sdk')
const pk = '02a4d7ca616e70897b7874460da1aab58b56e54c200a08e52a04c69df26b138859' // 公钥
const nonce = 100 // nonce
console.log(tool.getContractAddress(pk, nonce))
```

### 查看账户

```js
const tool = require('@salaku/js-sdk')
const pk = '02a4d7ca616e70897b7874460da1aab58b56e54c200a08e52a04c69df26b138859' // 公钥或者地址
tool.getAccont('localhost', 7010, pk)
    .then(console.log)
```

### 获取 nonce （异步）

```js
const tool = require('@salaku/js-sdk')
const pk = '02a4d7ca616e70897b7874460da1aab58b56e54c200a08e52a04c69df26b138859' // 公钥
tool.getNonce('localhost', 7010, pk)
    .then(nonce => console.log(`nonce = ${nonce}`))
```    

### 发送事务（异步）

```js
const tool = require('@salaku/js-sdk')
const tx = {
    "version" : 1634693120,
    "type" : 0,
    "createdAt" : 1596091121,
    "nonce" : 223814,
    "from" : "",
    "gasPrice" : 0,
    "amount" : 20,
    "payload" : "02b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936",
    "to" : "9cbf30db111483e4b84e77ca0e39378fd7605e1b",
}

tool.sendTransaction('localhost', 7010, tx)
.then(console.log)
.catch(console.error)
```


### 查看区块（异步）

```js
const tool = require('@salaku/js-sdk')
tool.getBlock('localhost', 7010, 1) // 可以填区块哈希值或者区块高度
.then(console.log)
.catch(console.error)
```

### 查看区块头（异步）

```js
const tool = require('@salaku/js-sdk')
tool.getHeader('localhost', 7010, 1) // 可以填区块哈希值或者区块高度
.then(console.log)
.catch(console.error)
```

### 查看事务（异步）

```js
const tool = require('@salaku/js-sdk')
tool.getTransaction('localhost', 7010, '****') // 填写事务哈希
.then(console.log)
.catch(console.error)
// 事务的 confrims 字段 -1 表示在内存池中
// 0 或者以上表示被确认, confirms 表示确认数量
// 如出现异常，表示事务不存在
```

### 查看合约（异步）

```js
const tool = require('@salaku/js-sdk')
tool.viewContract('localhost', 7010, '****合约地址****', 'method', Buffer.from('ff', 'hex')) // 额外参数
.then(console.log)
.catch(console.error)
// 事务的 confrims 字段 -1 表示在内存池中
// 0 或者以上表示被确认, confirms 表示确认数量
// 如出现异常，表示事务不存在
```

### 编译合约（异步）

```js
const tool = require('@salaku/js-sdk')
const ascPath = 'node_modules/.bin/asc'
const src = 'index.ts'
tool.compileContract(ascPath, src)
    .then(buf => console.log('buf length ' + buf.length))
```


## 使用事务构造器

```js
const sk = 'f00df601a78147ffe0b84de1dffbebed2a6ea965becd5d0bd7faf54f1f29c6b5' // 私钥
const builder = new tool.TransactionBuilder(constants.POA_VERSION, sk, 0)
```

### 构造转账事务并且签名

```js
const tx = builder.buildTransfer(1000, '****address****')
tx.nonce = 1
builder.sign(tx)
```


### 构造合约部署事务并且签名

```js
const buf = await tool.compileContract('index.ts')
const tx = builder.buildDeploy(buf, 1000) // 
tx.nonce = 1
builder.sign(tx)
```

### 构造合约调用事务并且签名

```js
const tx = builder.buildContractCall('****address****', buildPaylod('method', '00'), 0)
tx.nonce = 1
builder.sign(tx)
```

### 构造加入请求事务并且签名

```js
const tx = builder.buildAuthJoin(constants.PEER_AUTHENTICATION_ADDR)
tx.nonce = 1
builder.sign(tx)
```

### 构造同意请求事务并且签名

```js
const tx = builder.buildAuthApprove(constants.PEER_AUTHENTICATION_ADDR, '***同意的地址***')
tx.nonce = 1
builder.sign(tx)
```

### 构造退出事务并且签名

```js
const tx = builder.buildAuthExit(constants.PEER_AUTHENTICATION_ADDR)
tx.nonce = 1
builder.sign(tx)
```

### 构造投票事务

```js
const tx = builder.buildVote(1000, '***address***')
tx.nonce = 1
builder.sign(tx)
```

### 构造取消投票事务

```js
const tx = builder.buildCancelVote('***transaction hash***')
tx.nonce = 1
builder.sign(tx)
```

## RPC 工具类

```js
const rpc = new tool.RPC('localhost', 7010)
```

### 查看账户

```js
const pk = '02a4d7ca616e70897b7874460da1aab58b56e54c200a08e52a04c69df26b138859' // 公钥或者地址
rpc.getAccont(pk)
    .then(console.log)
```

### 获取 nonce （异步）

```js
const pk = '02a4d7ca616e70897b7874460da1aab58b56e54c200a08e52a04c69df26b138859' // 公钥
rpc.getNonce(pk)
    .then(nonce => console.log(`nonce = ${nonce}`))
```    

### 发送事务（异步）

```js
const tx = {
    "version" : 1634693120,
    "type" : 0,
    "createdAt" : 1596091121,
    "nonce" : 223814,
    "from" : "",
    "gasPrice" : 0,
    "amount" : 20,
    "payload" : "02b507fe1afd0cc7a525488292beadbe9f143784de44f8bc1c991636509fd50936",
    "to" : "9cbf30db111483e4b84e77ca0e39378fd7605e1b",
}

rpc.sendTransaction(tx)
.then(console.log)
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

### 查看合约（异步）

```js
rpc.viewContract('****合约地址****', 'method', Buffer.from('ff', 'hex')) // 额外参数
.then(console.log)
.catch(console.error)
// 事务的 confrims 字段 -1 表示在内存池中
// 0 或者以上表示被确认, confirms 表示确认数量
// 如出现异常，表示事务不存在
```

### 查看申请列表

```js
rpc.getAuthPending(constants.PEER_AUTHENTICATION_ADDR)
.then(console.log)
.catch(console.error)
```

### 查看已加入列表

```js
rpc.getAuthNodes(constants.PEER_AUTHENTICATION_ADDR)
.then(console.log)
.catch(console.error)
```

### 查看投票列表

```js
rpc.getPoSNodeInfos()
    .then(console.log)
    .catch(console.error)
```

### 根据事务哈希查看投票

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
