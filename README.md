# sm-crypto


## 安装

```bash
npm install --save @salaku/js-sdk
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

// 填入事务和私钥
console.log(tool.getTransactionHash(tx).toString('hex'))
```

### 构造 payload 或者 parameters

例如调用 call 方法，填入 [255, 255] 参数
```js
const p = tool.buildPayload("call", Buffer.from('ffff', 'hex')).toString('hex')
console.log(p)
```