# FHEVM SDK - 核心功能

## 🎯 SDK 定位

**纯 TypeScript、框架无关的 FHEVM SDK**

本 SDK 是一个完全框架无关的纯 TypeScript 实现，可以在任何 JavaScript/TypeScript 环境中使用。

## ✨ 核心功能

### 1. 📡 事件系统
- 完整的生命周期事件监控
- 10+ 种事件类型
- 类型安全的事件处理

### 2. 🔄 中间件系统
- **5个内置中间件**：
  - 自动重试（指数退避）
  - 请求去重
  - 性能监控
  - 限流控制
  - 操作日志
- 支持自定义中间件

### 3. 💾 高级缓存
- TTL（生存时间）支持
- LRU（最近最少使用）淘汰
- 多级缓存（L1 + L2）
- 自动清理机制
- 缓存统计

### 4. 🔌 插件系统
- **5个内置插件**：
  - 分析插件
  - 性能插件
  - 错误恢复插件
  - 缓存预热插件
  - 开发工具插件
- 可扩展架构

### 5. 🧪 测试工具
- Mock 组件（Storage, Signer, Provider, Instance）
- 测试助手（wait, waitFor, spy）
- 断言库
- 预配置的测试客户端

### 6. 📘 增强的 TypeScript 类型
- 30+ 工具类型
- 品牌类型（Address, HexString, ChainId）
- FHEVM 特定类型映射

## 🎯 使用场景

### ✅ 完全支持

- **Node.js 应用**
- **浏览器应用**
- **Next.js 应用**
- **React 应用** (直接使用核心 API)
- **Vue 应用** (直接使用核心 API)
- **Svelte 应用**
- **Angular 应用**
- **任何 JavaScript/TypeScript 环境**

## 📦 安装

```bash
npm install @fhevm-sdk ethers
```

## 🚀 快速开始

```typescript
import { 
  createFhevmClient,
  createInstance,
  encrypt,
  decrypt 
} from '@fhevm-sdk'

// 1. 创建客户端
const client = createFhevmClient({
  network: 'https://devnet.zama.ai',
  chainId: 8009,
  debug: true
})

// 2. 创建实例
const instance = await createInstance(client)

// 3. 加密
const encrypted = await encrypt(client, {
  instance,
  contractAddress: '0x...',
  userAddress: '0x...',
  buildInputs: (builder) => builder.add64(42)
})

// 4. 解密
const results = await decrypt(client, {
  instance,
  signer: toFhevmSigner(signer),
  requests: [{ handle: '0x...', contractAddress: '0x...' }]
})
```

## 🎨 在不同框架中使用

### React

```tsx
import { createFhevmClient, encrypt } from '@fhevm-sdk'
import { useState } from 'react'

function MyComponent() {
  const [client] = useState(() => 
    createFhevmClient({ network: provider })
  )
  
  const handleEncrypt = async () => {
    const result = await encrypt(client, {
      contractAddress: '0x...',
      userAddress: address,
      buildInputs: (builder) => builder.add64(42)
    })
  }
  
  return <button onClick={handleEncrypt}>加密</button>
}
```

### Vue

```vue
<script setup>
import { ref } from 'vue'
import { createFhevmClient, encrypt } from '@fhevm-sdk'

const client = ref(createFhevmClient({ network: provider }))

const handleEncrypt = async () => {
  const result = await encrypt(client.value, {
    contractAddress: '0x...',
    userAddress: address.value,
    buildInputs: (builder) => builder.add64(42)
  })
}
</script>
```

### Node.js

```typescript
import { createFhevmClient, createInstance } from '@fhevm-sdk'
import { JsonRpcProvider } from 'ethers'

const provider = new JsonRpcProvider('https://devnet.zama.ai')
const client = createFhevmClient({ network: provider })
const instance = await createInstance(client)
```

## 🔧 高级功能

### 添加中间件

```typescript
import { 
  retryMiddleware,
  dedupeMiddleware,
  performanceMiddleware 
} from '@fhevm-sdk/middleware'

// 自动重试
client.middleware.encrypt.use(retryMiddleware({
  maxRetries: 3,
  backoffFactor: 2
}))

// 请求去重
client.middleware.encrypt.use(dedupeMiddleware())

// 性能监控
client.middleware.encrypt.use(performanceMiddleware({
  threshold: 5000,
  onMetric: (metric) => console.log(metric)
}))
```

### 使用插件

```typescript
import { 
  analyticsPlugin,
  performancePlugin 
} from '@fhevm-sdk/plugin'

// 分析插件
await client.use(analyticsPlugin, {
  onEvent: (type, data) => analytics.track(type, data)
})

// 性能插件
await client.use(performancePlugin)
```

### 监听事件

```typescript
// 监听加密成功
client.events.on('encrypt:success', (data) => {
  console.log(`加密成功，耗时 ${data.duration}ms`)
})

// 监听错误
client.events.on('error', (data) => {
  console.error('发生错误:', data.error.message)
})
```

### 高级缓存

```typescript
import { AdvancedCache } from '@fhevm-sdk/cache'

const cache = new AdvancedCache({
  maxSize: 100,
  ttl: 60000,
  autoCleanup: true
})

cache.set('key', value, 30000)
const stats = cache.getStats()
```

## 🧪 测试

```typescript
import { 
  createMockClient,
  MockSigner,
  assert 
} from '@fhevm-sdk/testing'

// 创建 Mock 客户端
const client = createMockClient()

// Mock 组件
const signer = new MockSigner()

// 断言
assert.equal(result, expected)
```

## 📚 文档

- **优化总结.md** - 中文完整文档
- **ENHANCED_FEATURES.md** - 英文完整指南
- **README.md** - 本文档

## 🎯 核心优势

1. **完全框架无关** - 纯 TypeScript 实现
2. **生产就绪** - 内置重试、去重、错误恢复
3. **高性能** - 高级缓存、性能监控
4. **可观测** - 完整事件和指标系统
5. **类型安全** - 优秀的 TypeScript 支持
6. **易测试** - 完整的 mock 和测试工具
7. **可扩展** - 插件和中间件系统

## 📦 包导出

```typescript
// 核心功能
import { createFhevmClient, encrypt, decrypt } from '@fhevm-sdk'

// 中间件
import { retryMiddleware, dedupeMiddleware } from '@fhevm-sdk/middleware'

// 插件
import { analyticsPlugin, performancePlugin } from '@fhevm-sdk/plugin'

// 缓存
import { AdvancedCache } from '@fhevm-sdk/cache'

// 事件
import { FhevmEventEmitter } from '@fhevm-sdk/events'

// 测试
import { createMockClient } from '@fhevm-sdk/testing'

// 类型工具
import type { DeepPartial, Awaitable } from '@fhevm-sdk/types/utils'
```

## 🚀 生产环境建议配置

```typescript
import { 
  createFhevmClient,
  retryMiddleware,
  dedupeMiddleware,
  performanceMiddleware,
  analyticsPlugin,
  performancePlugin
} from '@fhevm-sdk'

// 创建生产环境客户端
const client = createFhevmClient({
  network: process.env.RPC_URL,
  chainId: parseInt(process.env.CHAIN_ID),
  debug: process.env.NODE_ENV === 'development'
})

// 添加中间件
client.middleware.encrypt.use(retryMiddleware({ maxRetries: 3 }))
client.middleware.encrypt.use(dedupeMiddleware())
client.middleware.encrypt.use(performanceMiddleware({
  threshold: 5000,
  onMetric: logMetric
}))

// 添加插件
await client.use(analyticsPlugin, {
  onEvent: trackAnalytics
})
await client.use(performancePlugin)

// 监听错误
client.events.on('error', (data) => {
  errorTracker.captureException(data.error)
})
```

## 📄 License

MIT

---

**为 Zama FHEVM 社区精心打造 ❤️**

