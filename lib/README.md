# WebAssembly Blockchain Interface (WBI)

# WASM-区块链应用程序接口


在 WebAssembly 区块链账本之间进行数据交换需要建立接口(WBI)，考虑到未来可能会使用到其他编程语言编写智能合约，
而且 AssemblyScript 的版本也在快速迭代中，接口的设计必须具有一定的兼容多语言的能力，而且易于实现。

本文以 AssemblyScript 为例提供了一种WBI的实现方案，该方案不局限于特定的编程语言语法，也没有直接操作 WebAssembly 的内存，
也可以在 Rust，Go, C, C++ 等以 WebAssembly 为目标代码的编程语言中实现。


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

对于 AssemblyScript，这个内存分配函数是 ```__alloc(size: usize, id: u32)```，在最新版的 AssemblyScript 中这个函数被改名为了 ```__new(size: usize, id: u32)```，在 C 语言中则通过 ```malloc``` 分配内存

所以为了能够兼容多版本和多语言我们在标准库中引入了 ```__malloc``` 和 ```__change_t``` 函数，它是这样子的

```typescript
export function __malloc(size: i32): usize {
    const buf = new ArrayBuffer(size)
    return changetype<usize>(buf)
}
```

```typescript
export function __change_t(t: u64, ptr: u64, size: u64): u64{
    const buf = load<ArrayBuffer>(ptr)
    switch (u8(t)){
        case ABI_DATA_TYPE.ADDRESS:
            return changetype<usize>(new Address(buf))
        case ABI_DATA_TYPE.BYTES:
            return changetype<usize>(buf)
        case ABI_DATA_TYPE.U256:
            return changetype<usize>(new U256(buf))
        case ABI_DATA_TYPE.STRING:
            return changetype<usize>(String.UTF8.decode(buf))
    }
    return 0
}
```


__malloc 它的作用是告诉 wasm，宿主机需要分配一段内存用于存储 ```string, bytes, address u256``` 类型的二进制编码，并且返回这段内存的起始位置。

宿主机收到这个起始位置后，把二进制流写入到 wasm 内存中。

```__change_t``` 的作用是告诉 wasm 宿主机需要把二进制编码转换成指针类型，
wasm 在解析出二进制编码数据后，要根据 t 的不同，转换成指针类型返回给宿主机




### 如何从 WebAssembly 向宿主机返回参数

```typescript
export function __peek(ptr: u64, type: ABI_DATA_TYPE): u64{
}
```

它的作用是告诉 WebAssembly，宿主机需要访问一段内存，以便转换成宿主机需要的格式，返回的类型是 u64 类型，这个 u64 类型的低 32 位（ 通过 i & 0xffffffff 获取) 表示的是返回参数的二进制长度，高32位表示的是用于填充的内存起始位置

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

### 参考示例

WBI 的实现可以参考 src/vm/WasmInterface 中的 malloc 和 peek

Rust 的实现可以参考如下代码


```rust
extern "C" {
    pub fn _log(a: u64);
}

unsafe fn log(msg: &str) {
    let d: Data = Data { ptr: msg.as_ptr(), len: msg.len() as u32 };
    _log(&d as *const _ as u64);
}

enum AbiDataType {
    BOOL,
    // 0
    I64,
    // 1
    U64,
    //  2 BN
    F64,
    STRING,
    // 3 string
    BYTES,
    // 4
    ADDRESS,
    // 5
    U256, // 6
}

// WBI 在 rust 中的实现
// 因为 rust 没有内存管理，需要用一个结构体来保存字节流的长度
#[repr(C)]
#[no_mangle]
pub struct Data {
    ptr: *const u8,
    len: u32,
}

impl Data {
    pub unsafe fn string(&self) -> String {
        let mut bytes: Vec<u8> = Vec::with_capacity(self.len as usize);
        bytes.set_len(self.len as usize);
        for x in 0..self.len{
            bytes[x as usize] = *(self.ptr.offset(x as isize))
        }
        return String::from_utf8_unchecked(bytes);
    }
}

#[no_mangle]
pub unsafe extern fn __malloc(size: u64) -> u64 {
    let mut bytes: Vec<u8> = Vec::with_capacity(size as usize);
    bytes.set_len(size as usize);
    return bytes.as_ptr() as u64;
}

#[no_mangle]
pub unsafe extern fn __change_t(t: u64, ptr: u64, size: u64) -> u64 {
    let d = Data { ptr: ptr as usize as *const u8, len: size as u32 };
    return &d as *const _ as u64;
}


#[no_mangle]
pub unsafe extern fn __peek(ptr: u64, t: u64) -> u64 {
    let p: *const Data = ptr as usize as *const _;
    let len = (*p).len;
    return (((*p).ptr as u64) << 32) | (len as u64);
}

#[no_mangle]
pub unsafe extern fn init(s: &Data) {
    log(s.string().as_str());
}
```


