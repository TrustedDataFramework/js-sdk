# 智能合约开发

## WebAssembly

在 WebAssembly 中访问宿主机数据需要建立接口， 本文列举了目前需要的接口。 考虑到未来可能会使用到其他 WebAssembly 的前端语言，
而且 AssemblyScript 的版本也在快速迭代中，接口的设计必须具有一定的兼容多语言的能力，而且易于实现

### 元数据声明

声明元数据有助于兼容不同版本的语言，例如在 AssemblyScript 中字符串使用了 UTF16LE 编码，在宿主机中可以通过访问内存地址获取到这个变量

```typescript
enum CharSet{
    UTF8,
    UTF16,
    UTF16LE
}

export function __meta(): usize{
    const buf = new Uint8Array(2)
    buf[0] = 2
    buf[1] = CharSet.UTF16LE
    __retain(changetype<usize>(buf.buffer))
    return changetype<usize>(buf.buffer)
}
```



### 如何在宿主机中向 WebAssembly 注入参数

智能合约编程的类型如下，其中 ```bool, i64, u64, f64``` 可以直接在通过 WebAssembly 的参数传入到栈内存中，不需要转换

```typescript
export enum ABI_DATA_TYPE {
    BOOL, 
    I64,  
    U64, 
    F64,
    STRING, 
    BYTES, 
    ADDRESS, 
    U256, 
}
```

而 ```string, bytes, address, u256``` 保存在堆内存中，需要引入一个接口使得区块链环境可以正确的修改 WebAssembly 的堆内存，

对于 AssemblyScript，这个函数是 ```__alloc(size: usize, id: u32)```，在最新版的 AssemblyScript 中这个函数被改名为了 ```__new(size: usize, id: u32)```

所以为了能够兼容多版本和多语言我们在标准库中引入了 ```__malloc``` 函数，它是这样子的

```typescript
export function __malloc(size: usize, type: ABI_DATA_TYPE): u64{
    // 略
    return 0
}
```

它的作用是告诉 WebAssembly，宿主机需要分配一段内存用于存储 ```string, bytes, address 或者 u256 类型```，并且返回这个对象的内存起始位置。
注意到返回的类型是 u64 类型，这个 u64 类型的高 32 位（ 通过 i >>> 32 获取) 表示的是结构体的指针，低32位表示的是用于填充的内存起始位置


### 如何从 WebAssembly 向宿主机返回参数

```typescript
export function __mpeek(usize: ptr, type: ABI_DATA_TYPE): u64{
}
```

它的作用是告诉 WebAssembly，宿主机需要访问一段内存，以便转换成宿主机需要的格式，返回的类型是 u64 类型，这个 u64 类型的高 32 位（ 通过 i >>> 32 获取) 表示的是，低32位表示的是用于填充的内存起始位置

### 命令行参数

AssemblyScript 会默认引用一个 abort 函数, 在宿主机中实现这个 abort 会无法兼容其他语言, 所以我们在编译智能合约的命令行中加入了这样的代码, 覆盖了    abort 的引入

区块链智能合约的执行比较短暂，甚至不需要垃圾回收，所以我们在命令行中默认取消了内存管理

```js
const arr = [
    src,
    "-b",
    '--runtime',
    'none',
    '--use',
    `abort=${path.relative(process.cwd(), path.join(__dirname, '../lib/prelude/abort'))}`
]
```