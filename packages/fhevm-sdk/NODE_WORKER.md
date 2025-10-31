# Node.js Worker 支持

SDK 现在支持在 Node.js 环境中使用 Worker Threads 进行 FHE 加解密操作。

## 环境检测

SDK 会自动检测运行环境：
- **浏览器环境**: 使用 `WebWorker` API
- **Node.js 环境**: 使用 `worker_threads` API

## 基本使用

### 1. 自动检测环境

```typescript
import { FheWorker } from '@fhevm-sdk';

// SDK 会自动使用正确的 Worker 实现
const worker = new FheWorker({
  // 浏览器: wasmPath
  // Node.js: workerPath
  workerPath: './fhe-worker.node.js', // Node.js 需要
  wasmPath: '/wasm/fhe.wasm', // 浏览器需要
  debug: true
});

await worker.init();
const ciphertext = await worker.encrypt(42, {
  type: 'uint64',
  contractAddress: '0x...',
  userAddress: '0x...'
});
```

### 2. Node.js 专用 Worker

如果你明确知道在 Node.js 环境中运行，可以直接使用 `FheWorkerNode`：

```typescript
import { FheWorkerNode } from '@fhevm-sdk/workers';

const worker = new FheWorkerNode({
  workerPath: './fhe-worker.node.js',
  debug: true
});

await worker.init();
const ciphertext = await worker.encrypt(42, {
  type: 'uint64',
  contractAddress: '0x...',
  userAddress: '0x...'
});
```

## Worker 脚本

### Node.js Worker 脚本

SDK 提供了默认的 Node.js Worker 脚本：`src/workers/fhe-worker.node.js`

你也可以创建自定义的 Worker 脚本：

```javascript
// fhe-worker-custom.js
const { parentPort, workerData } = require('worker_threads');

let wasmModule = null;

// 初始化
async function init() {
  // 加载 WASM 模块
  if (workerData.wasmPath) {
    const wasmModule = await loadWASM(workerData.wasmPath);
  }
  
  parentPort.postMessage({ type: 'ready' });
}

// 加密
function encrypt(value, type) {
  // 实现加密逻辑
  return new Uint8Array(32);
}

// 消息处理
parentPort.on('message', async (message) => {
  const { type, payload, id } = message;
  
  switch (type) {
    case 'encrypt':
      const result = encrypt(payload.value, payload.type);
      parentPort.postMessage({
        type: 'encrypt-response',
        payload: Array.from(result),
        id
      });
      break;
  }
});

init();
```

## 完整示例

### Node.js 脚本中使用

```typescript
import { FheWorker } from '@fhevm-sdk';
import { createFhevmClient, encryptWithWorker } from '@fhevm-sdk';

async function main() {
  // 创建 client
  const client = createFhevmClient({
    network: 'https://eth.llamarpc.com',
    chainId: 1
  });

  const instance = await createInstance(client);

  // 使用 Worker 进行批量加密
  const result = await encryptWithWorker(client, {
    instance,
    contractAddress: '0x...',
    userAddress: '0x...',
    workerConfig: {
      workerPath: './fhe-worker.node.js', // Node.js 需要
      debug: true
    },
    values: [
      { type: 'uint64', value: 42 },
      { type: 'uint32', value: 100 }
    ]
  });

  console.log('Encryption result:', result);
}

main();
```

### 使用 child_process.fork() 替代方案

如果你更喜欢使用 `child_process.fork()`:

```typescript
import { fork } from 'child_process';

const worker = fork('./fhe-worker.js');

worker.send({ task: 'encrypt', data: 123 });

worker.on('message', (ciphertext) => {
  // 处理加密结果
  console.log('Encrypted:', ciphertext);
  
  // 可以发送到链上
  // provider.sendTransaction(ciphertext);
});
```

### 直接在 WASM 模块中并行执行

如果你的 WASM 模块支持并行执行：

```typescript
import { Worker } from 'worker_threads';
import { createFhevmClient } from '@fhevm-sdk';

const client = createFhevmClient({
  network: 'https://eth.llamarpc.com',
  chainId: 1
});

// 使用多个 Worker 并行处理
const workers = Array(4).fill(null).map(() => 
  new Worker('./fhe-worker.node.js')
);

const values = [1, 2, 3, 4];
const promises = values.map((value, index) => {
  return new Promise((resolve) => {
    workers[index].on('message', (result) => {
      resolve(result);
    });
    workers[index].postMessage({ 
      task: 'encrypt', 
      value,
      type: 'uint64'
    });
  });
});

const results = await Promise.all(promises);
console.log('All encrypted:', results);

// 清理
workers.forEach(w => w.terminate());
```

## 配置选项

### FheWorkerConfig (Node.js)

```typescript
interface FheWorkerConfig {
  /** Worker 脚本路径 (Node.js 必需) */
  workerPath?: string;
  /** WASM 模块路径 (可选) */
  wasmPath?: string;
  /** 启用调试日志 */
  debug?: boolean;
  /** Worker 选项 (仅浏览器) */
  workerOptions?: WorkerOptions;
}
```

## 性能对比

### WebWorker (浏览器)
- ✅ 不阻塞主线程
- ✅ 自动管理生命周期
- ✅ 支持内联 Worker 脚本

### Worker Threads (Node.js)
- ✅ 真正的多线程执行
- ✅ 更好的 CPU 利用率
- ✅ 可以与文件系统交互
- ✅ 支持原生模块

### child_process.fork() (Node.js)
- ✅ 完全独立的进程
- ✅ 更好的隔离性
- ❌ 进程间通信开销较大
- ❌ 内存占用更高

## 注意事项

1. **Worker 路径**: Node.js 中必须提供 `workerPath`，路径应该是绝对路径或相对于当前工作目录
2. **WASM 加载**: Node.js 中可以使用 `fs` 模块直接读取 WASM 文件
3. **错误处理**: Node.js Worker 的错误处理与浏览器略有不同
4. **资源清理**: 记得在不需要时调用 `terminate()`

## 故障排除

### 错误: "Worker path is required for Node.js environment"

**解决方案**: 提供 `workerPath` 配置：

```typescript
const worker = new FheWorker({
  workerPath: path.join(__dirname, 'fhe-worker.node.js')
});
```

### 错误: "Cannot find module 'worker_threads'"

**解决方案**: 确保 Node.js 版本 >= 12.0.0，并且不在浏览器环境中使用。

### Worker 脚本路径问题

**解决方案**: 使用绝对路径或 `path.join()`：

```typescript
import path from 'path';

const workerPath = path.join(__dirname, '../workers/fhe-worker.node.js');
const worker = new FheWorker({ workerPath });
```

