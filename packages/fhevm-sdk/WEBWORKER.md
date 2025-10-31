# WebWorker 支持 - 异步 FHE 加解密

FHE（全同态加密）的计算量非常大，在主线程进行加密/解密操作会阻塞 UI。SDK 提供了 WebWorker 支持，可以将这些重计算操作放到后台线程执行。

## 特性

- ✅ **WebWorker 异步加密**: 不阻塞主线程
- ✅ **WASM 支持**: 可加载 WebAssembly 模块加速计算
- ✅ **自动管理**: Worker 生命周期自动管理
- ✅ **类型安全**: 完整的 TypeScript 支持
- ✅ **错误处理**: 完善的错误处理和超时机制

## 基本使用

### 1. 使用 FheWorker 直接加密

```typescript
import { FheWorker } from '@fhevm-sdk';

// 创建 Worker
const worker = new FheWorker({
  wasmPath: '/wasm/fhe.wasm', // 可选：WASM 模块路径
  debug: true // 可选：启用调试日志
});

// 初始化 Worker
await worker.init();

// 加密值
const ciphertext = await worker.encrypt(42, {
  type: 'uint64',
  contractAddress: '0x...',
  userAddress: '0x...'
});

console.log('Encrypted:', ciphertext);

// 解密
const decrypted = await worker.decrypt(ciphertext, {
  contractAddress: '0x...',
  userAddress: '0x...'
});

console.log('Decrypted:', decrypted);

// 完成后终止 Worker
worker.terminate();
```

### 2. 使用 encryptWithWorker 函数

```typescript
import { 
  createFhevmClient, 
  createInstance, 
  encryptWithWorker 
} from '@fhevm-sdk';

const client = createFhevmClient({
  network: window.ethereum,
  chainId: 8009
});

const instance = await createInstance(client);

// 使用 Worker 进行加密
const result = await encryptWithWorker(client, {
  instance,
  contractAddress: '0x...',
  userAddress: '0x...',
  workerConfig: {
    wasmPath: '/wasm/fhe.wasm',
    debug: true
  },
  values: [
    { type: 'uint64', value: 42 },
    { type: 'bool', value: true },
    { type: 'uint32', value: 100 }
  ]
});

console.log('Handles:', result.handles);
console.log('Proof:', result.inputProof);
```

### 3. 使用 FheWorkerManager 复用 Worker

如果需要进行多次加密操作，可以使用 `FheWorkerManager` 来复用同一个 Worker：

```typescript
import { FheWorkerManager } from '@fhevm-sdk';

// 创建 Worker 管理器
const manager = new FheWorkerManager({
  wasmPath: '/wasm/fhe.wasm',
  debug: true
});

// 多次使用同一个 Worker
async function encryptMultipleValues() {
  const worker = await manager.getWorker();
  
  const results = await Promise.all([
    worker.encrypt(42, { type: 'uint64', contractAddress: '0x...', userAddress: '0x...' }),
    worker.encrypt(100, { type: 'uint32', contractAddress: '0x...', userAddress: '0x...' }),
    worker.encrypt(true, { type: 'bool', contractAddress: '0x...', userAddress: '0x...' })
  ]);
  
  return results;
}

// 完成后终止 Worker
manager.terminate();
```

## 支持的数据类型

Worker 支持以下数据类型：

- `bool` - 布尔值
- `uint8` - 8 位无符号整数
- `uint16` - 16 位无符号整数
- `uint32` - 32 位无符号整数
- `uint64` - 64 位无符号整数
- `uint128` - 128 位无符号整数
- `uint256` - 256 位无符号整数
- `address` - 地址（自动转换为 uint256）

## WASM 模块集成

### 准备 WASM 模块

1. 编译你的 FHE WASM 模块（使用 Rust、C++ 或其他支持 WASM 的语言）
2. 将 WASM 文件放在 public 目录下（例如 `public/wasm/fhe.wasm`）

### 使用 WASM 模块

```typescript
const worker = new FheWorker({
  wasmPath: '/wasm/fhe.wasm', // 指向你的 WASM 文件
  debug: true
});

await worker.init();
// Worker 会自动加载并初始化 WASM 模块
```

### Worker 脚本要求

如果你使用自定义 Worker 脚本，它需要：

1. 实现 `init` 消息处理器，加载 WASM 模块
2. 实现 `encrypt` 消息处理器
3. 实现 `decrypt` 消息处理器
4. 发送 `ready` 消息表示初始化完成

## 错误处理

```typescript
try {
  const worker = new FheWorker({ wasmPath: '/wasm/fhe.wasm' });
  await worker.init();
  
  const ciphertext = await worker.encrypt(42, {
    type: 'uint64',
    contractAddress: '0x...',
    userAddress: '0x...'
  });
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('Worker operation timeout');
  } else if (error.message.includes('initialization')) {
    console.error('Worker initialization failed');
  } else {
    console.error('Encryption failed:', error);
  }
}
```

## 性能优化建议

### 1. 复用 Worker

对于需要多次加密的场景，使用 `FheWorkerManager` 复用 Worker：

```typescript
const manager = new FheWorkerManager({ wasmPath: '/wasm/fhe.wasm' });

// 多次操作共享同一个 Worker
for (const value of values) {
  const worker = await manager.getWorker();
  await worker.encrypt(value, params);
}

manager.terminate();
```

### 2. 批量加密

使用 `encryptWithWorker` 可以一次加密多个值，效率更高：

```typescript
const result = await encryptWithWorker(client, {
  instance,
  contractAddress: '0x...',
  userAddress: '0x...',
  values: [
    { type: 'uint64', value: 42 },
    { type: 'uint64', value: 100 },
    { type: 'uint64', value: 200 }
  ]
});
```

### 3. 并行加密

对于多个独立的值，可以并行加密：

```typescript
const worker = new FheWorker({ wasmPath: '/wasm/fhe.wasm' });
await worker.init();

const results = await Promise.all([
  worker.encrypt(value1, params1),
  worker.encrypt(value2, params2),
  worker.encrypt(value3, params3)
]);
```

## 在 React 中使用

```tsx
import { useEffect, useState } from 'react';
import { FheWorker } from '@fhevm-sdk';

function MyComponent() {
  const [worker, setWorker] = useState<FheWorker | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const w = new FheWorker({
      wasmPath: '/wasm/fhe.wasm',
      debug: true
    });

    w.init().then(() => {
      setWorker(w);
    });

    return () => {
      w.terminate();
    };
  }, []);

  const handleEncrypt = async (value: number) => {
    if (!worker) return;

    setLoading(true);
    try {
      const ciphertext = await worker.encrypt(value, {
        type: 'uint64',
        contractAddress: '0x...',
        userAddress: '0x...'
      });
      console.log('Encrypted:', ciphertext);
    } catch (error) {
      console.error('Encryption failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button 
        onClick={() => handleEncrypt(42)}
        disabled={!worker || loading}
      >
        {loading ? 'Encrypting...' : 'Encrypt'}
      </button>
    </div>
  );
}
```

## 注意事项

1. **Worker 生命周期**: 记得在不需要时调用 `terminate()` 释放资源
2. **WASM 加载**: 首次加载 WASM 模块可能需要一些时间，建议显示加载状态
3. **浏览器兼容性**: WebWorker 需要现代浏览器支持，建议检查兼容性
4. **内存管理**: 长时间运行的 Worker 可能占用内存，定期重启 Worker
5. **错误恢复**: Worker 错误后需要重新创建 Worker

## API 参考

### FheWorker

```typescript
class FheWorker {
  constructor(config?: FheWorkerConfig);
  init(): Promise<void>;
  encrypt(value: number | bigint | boolean, params?: EncryptParams): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array | string, params?: DecryptParams): Promise<number | bigint | boolean>;
  terminate(): void;
  get initialized(): boolean;
}
```

### FheWorkerManager

```typescript
class FheWorkerManager {
  constructor(config?: FheWorkerManagerConfig);
  getWorker(): Promise<FheWorker>;
  terminate(): void;
}
```

### encryptWithWorker

```typescript
function encryptWithWorker(
  client: FhevmClient,
  params: EncryptWithWorkerParams
): Promise<EncryptResult>;
```

## 完整示例

```typescript
import {
  createFhevmClient,
  createInstance,
  encryptWithWorker,
  FheWorkerManager
} from '@fhevm-sdk';

async function fheExample() {
  // 1. 创建 client 和 instance
  const client = createFhevmClient({
    network: window.ethereum,
    chainId: 8009
  });
  const instance = await createInstance(client);

  // 2. 使用 Worker 加密多个值
  const result = await encryptWithWorker(client, {
    instance,
    contractAddress: '0x...',
    userAddress: '0x...',
    workerConfig: {
      wasmPath: '/wasm/fhe.wasm',
      debug: true
    },
    values: [
      { type: 'uint64', value: 42 },
      { type: 'uint32', value: 100 },
      { type: 'bool', value: true }
    ]
  });

  console.log('Encryption result:', result);

  // 3. 使用 Worker Manager 进行多次操作
  const manager = new FheWorkerManager({
    wasmPath: '/wasm/fhe.wasm'
  });

  const worker = await manager.getWorker();
  
  const ciphertext1 = await worker.encrypt(42, {
    type: 'uint64',
    contractAddress: '0x...',
    userAddress: '0x...'
  });

  const ciphertext2 = await worker.encrypt(100, {
    type: 'uint32',
    contractAddress: '0x...',
    userAddress: '0x...'
  });

  manager.terminate();
}

fheExample();
```

