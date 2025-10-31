# FHEVM SDK - 核心逻辑说明

## 🎯 设计原则

本SDK严格遵循**高内聚、低耦合**的设计原则：

### 高内聚 (High Cohesion)
每个模块职责单一，相关功能集中在一起：
- **Client模块** - 只负责配置和状态管理
- **Instance模块** - 只负责实例的创建和管理
- **Encrypt模块** - 只负责加密操作
- **Decrypt模块** - 只负责解密操作

### 低耦合 (Low Coupling)
模块间依赖最小化，通过接口交互：
- 使用接口而非具体实现
- 依赖注入（Storage、Signer等）
- 统一的错误处理
- 清晰的类型定义

## 📦 核心模块结构

```
core-v2/
├── client.ts       # 客户端管理（配置、状态、缓存）
├── instance.ts     # 实例管理（创建、缓存、清理）
├── encrypt.ts      # 加密操作（输入构建、加密执行）
├── decrypt.ts      # 解密操作（签名、解密执行）
└── index.ts        # 统一导出

支持模块/
├── types.ts        # 类型定义（接口、类型别名）
├── errors.ts       # 错误类（统一错误处理）
├── utils/          # 工具函数
│   ├── validation.ts  # 参数验证
│   ├── hex.ts         # 十六进制转换
│   └── abi.ts         # ABI处理
└── storage/        # 存储适配器
    ├── GenericStringStorage.ts
    ├── LocalStorage.ts
    └── IndexedDBStorage.ts
```

## 🔄 核心流程

### 1. 客户端创建

```typescript
const client = createFhevmClient({
  network: provider,    // 网络提供者
  chainId: 8009,       // 链ID（可选）
  storage: myStorage,  // 存储适配器（可选）
  debug: true          // 调试模式（可选）
})
```

**职责划分：**
- `createFhevmClient` - 工厂函数，创建客户端
- `FhevmClient` - 客户端类，管理配置和状态
- `validateClientConfig` - 验证配置参数

### 2. 实例创建

```typescript
const instance = await createInstance(client, {
  signal: abortSignal,           // 取消信号
  onStatusChange: (status) => {}, // 状态回调
  force: false                   // 强制重建
})
```

**职责划分：**
- `createInstance` - 创建或返回缓存的实例
- `getInstance` - 获取缓存实例
- `clearInstance` - 清除缓存
- `ensureInstance` - 确保实例存在

**缓存机制：**
1. 首次调用创建实例
2. 后续调用返回缓存实例
3. 使用 `force: true` 强制重建

### 3. 加密操作

```typescript
const result = await encrypt(client, {
  instance,              // FHEVM实例（可选，使用缓存）
  contractAddress,       // 合约地址
  userAddress,          // 用户地址
  buildInputs: (builder) => {
    builder.add64(42)
    builder.addBool(true)
  }
})
```

**职责划分：**
- `encrypt` - 执行加密操作
- `createEncryptedInput` - 创建加密输入构建器（高级用法）
- `validateContractAddress` - 验证合约地址
- `validateUserAddress` - 验证用户地址

**流程：**
1. 验证参数
2. 获取或使用缓存实例
3. 创建加密输入构建器
4. 执行buildInputs回调
5. 执行加密
6. 返回结果

### 4. 解密操作

```typescript
const results = await decrypt(client, {
  instance,              // FHEVM实例（可选）
  signer,               // 签名器
  requests: [
    { handle: '0x...', contractAddress: '0x...' }
  ]
})
```

**职责划分：**
- `decrypt` - 用户解密（需要签名）
- `publicDecrypt` - 公开解密（无需签名）
- `validateDecryptRequests` - 验证请求参数
- `FhevmDecryptionSignature` - 签名管理（缓存和创建）

**流程：**
1. 验证参数
2. 获取实例
3. 提取唯一合约地址
4. 加载或创建签名（自动缓存）
5. 执行userDecrypt
6. 返回解密结果

## 🛡️ 错误处理

### 错误类型层次

```
FhevmError (基类)
├── FhevmAbortError          # 操作取消
├── FhevmConfigError         # 配置错误
├── FhevmInstanceError       # 实例创建失败
├── FhevmEncryptionError     # 加密失败
├── FhevmDecryptionError     # 解密失败
├── FhevmSignatureError      # 签名失败
└── FhevmNetworkError        # 网络错误
```

### 错误处理示例

```typescript
try {
  const instance = await createInstance(client)
} catch (error) {
  if (error instanceof FhevmAbortError) {
    console.log('操作被取消')
  } else if (error instanceof FhevmConfigError) {
    console.log('配置错误:', error.message)
  } else if (error instanceof FhevmInstanceError) {
    console.log('实例创建失败:', error.message, error.cause)
  }
}
```

## 🔍 类型系统

### 核心接口

```typescript
// 网络提供者
type NetworkProvider = string | EIP1193Provider

// 存储接口
interface Storage {
  getItem(key: string): string | Promise<string | null> | null
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

// 签名器接口
interface Signer {
  getAddress(): Promise<string>
  signTypedData(domain, types, message): Promise<string>
}

// 客户端配置
interface ClientConfig {
  network: NetworkProvider
  chainId?: number
  mockChains?: Record<number, string>
  storage?: Storage
  debug?: boolean
}
```

## 📊 数据流

### 加密流程

```
用户调用 encrypt()
    ↓
验证参数 (validation.ts)
    ↓
获取/确保实例 (instance.ts)
    ↓
创建加密输入 (instance.createEncryptedInput)
    ↓
构建输入 (buildInputs callback)
    ↓
执行加密 (input.encrypt())
    ↓
返回结果 { handles, inputProof }
```

### 解密流程

```
用户调用 decrypt()
    ↓
验证参数 (validation.ts)
    ↓
获取/确保实例 (instance.ts)
    ↓
提取唯一合约地址
    ↓
加载/创建签名 (FhevmDecryptionSignature)
    ├─→ 检查缓存 (storage)
    ├─→ 创建EIP-712消息
    └─→ 签名并缓存
    ↓
执行userDecrypt (instance.userDecrypt)
    ↓
返回结果 { handle: value }
```

## 🔧 依赖注入

### Storage注入

```typescript
// 默认：内存存储
const client = createFhevmClient({ network })

// 自定义：LocalStorage
import { LocalStorageAdapter } from 'fhevm-sdk/storage'
const client = createFhevmClient({
  network,
  storage: new LocalStorageAdapter('my-app')
})

// 自定义实现
class MyStorage implements Storage {
  async getItem(key: string) { /* ... */ }
  async setItem(key: string, value: string) { /* ... */ }
  async removeItem(key: string) { /* ... */ }
}
```

### Signer注入

```typescript
// Ethers.js适配器
import { toFhevmSigner } from 'fhevm-sdk/adapters/ethers'
const fhevmSigner = toFhevmSigner(ethersSigner)

// 自定义实现
const mySigner: Signer = {
  async getAddress() { return '0x...' },
  async signTypedData(domain, types, message) { return '0x...' }
}
```

## 🎯 高内聚设计示例

### Client模块（单一职责：配置管理）

```typescript
export class FhevmClient {
  private _config: ClientConfig
  private _storage: Storage
  private _instance?: FhevmInstance

  // 配置相关
  get config(): ClientConfig
  get storage(): Storage
  isDebug(): boolean
  debug(message: string): void

  // 实例缓存相关
  get instance(): FhevmInstance | undefined
  setInstance(instance: FhevmInstance): void
  clearInstance(): void
}
```

**内聚性分析：**
- ✅ 所有方法都与配置/状态管理相关
- ✅ 不包含加密/解密逻辑
- ✅ 不包含实例创建逻辑
- ✅ 只提供状态访问和管理

### Instance模块（单一职责：实例管理）

```typescript
// 创建实例
export async function createInstance(
  client: FhevmClient,
  options?: CreateInstanceOptions
): Promise<FhevmInstance>

// 获取实例
export function getInstance(client: FhevmClient): FhevmInstance | undefined

// 清除实例
export function clearInstance(client: FhevmClient): void

// 确保实例存在
export async function ensureInstance(
  client: FhevmClient,
  options?: CreateInstanceOptions
): Promise<FhevmInstance>
```

**内聚性分析：**
- ✅ 所有函数都与实例生命周期相关
- ✅ 不包含加密/解密逻辑
- ✅ 不包含配置管理
- ✅ 专注于实例的CRUD操作

## 🔗 低耦合设计示例

### 模块间通过接口交互

```typescript
// encrypt.ts 不直接依赖具体的Storage实现
export async function encrypt(
  client: FhevmClient,  // 通过client访问storage
  params: EncryptParams
): Promise<EncryptResult> {
  // 使用client.storage（接口）而非具体实现
  const storage = client.storage
}
```

### 使用依赖注入而非硬编码

```typescript
// ❌ 紧耦合
function decrypt() {
  const storage = new LocalStorage() // 硬编码依赖
}

// ✅ 松耦合
function decrypt(client: FhevmClient) {
  const storage = client.storage // 注入的依赖
}
```

## 📝 最佳实践

### 1. 始终使用Client

```typescript
// ✅ 推荐
const client = createFhevmClient(config)
const instance = await createInstance(client)

// ❌ 不推荐
const instance = await createFhevmInstance(/* 直接使用内部API */)
```

### 2. 利用实例缓存

```typescript
// 第一次调用 - 创建实例
const instance1 = await createInstance(client)

// 后续调用 - 返回缓存实例（快速）
const instance2 = await createInstance(client)

// instance1 === instance2 (true)
```

### 3. 使用ensureInstance简化代码

```typescript
// ❌ 繁琐
let instance = getInstance(client)
if (!instance) {
  instance = await createInstance(client)
}

// ✅ 简洁
const instance = await ensureInstance(client)
```

### 4. 正确处理错误

```typescript
import { 
  FhevmConfigError,
  FhevmInstanceError,
  FhevmEncryptionError 
} from 'fhevm-sdk/errors'

try {
  const result = await encrypt(client, params)
} catch (error) {
  if (error instanceof FhevmConfigError) {
    // 处理配置错误
  } else if (error instanceof FhevmEncryptionError) {
    // 处理加密错误
  }
}
```

### 5. 使用debug模式

```typescript
const client = createFhevmClient({
  network: provider,
  debug: true  // 开启调试日志
})

// 日志输出示例：
// [FHEVM SDK] Creating new FHEVM instance
// [FHEVM SDK] Instance status: sdk-loading
// [FHEVM SDK] Instance status: sdk-loaded
// [FHEVM SDK] Encrypting for contract 0x...
```

## 🎓 架构优势总结

### 高内聚带来的好处

1. **易于理解** - 每个模块职责清晰
2. **易于测试** - 可以独立测试每个模块
3. **易于维护** - 修改只影响相关模块
4. **代码复用** - 功能集中便于复用

### 低耦合带来的好处

1. **灵活性** - 易于替换实现（如Storage）
2. **可扩展性** - 易于添加新功能
3. **可测试性** - 易于mock依赖
4. **独立性** - 模块可以独立开发和部署

## 🚀 总结

通过严格遵循高内聚低耦合原则，FHEVM SDK实现了：

- ✅ **清晰的模块划分** - Client、Instance、Encrypt、Decrypt各司其职
- ✅ **统一的错误处理** - 专门的错误类层次
- ✅ **完整的类型系统** - 类型安全，减少错误
- ✅ **灵活的依赖注入** - Storage、Signer可替换
- ✅ **智能的缓存机制** - 实例和签名自动缓存
- ✅ **完善的验证逻辑** - 统一的参数验证

这使得SDK既**通用**（适用于任何框架），又**易用**（API简洁直观），同时保持了**高质量**的代码结构。

