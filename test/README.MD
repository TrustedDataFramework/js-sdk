# 智能合约测试

## 准备工作

1. npm install

2. 你的环境变量中包含了 npm 目录，如果没有请在 ~/.zshrc 或者 ~/.bashrc 中添加 

```shell script
export PATH=$PATH:node_modules/.bin
```

3. 编译源代码和合约代码

```shell script
pwd # 确保当前路径在 js-sdk 下
tsc
npm run bundle
./test/compile.js test/u256.ts
```

3. 启动 http-server 

```shell script
light-server -s .
```

4. 打开 html 页面，通常位于 http://localhost/test/index.html