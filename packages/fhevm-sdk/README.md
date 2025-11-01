# FHEVM SDK

Universal SDK for Fully Homomorphic Encryption Virtual Machine (FHEVM) - A pure, framework-agnostic SDK with wagmi-like structure.

## ✨ Features

- 🌐 **100% Framework-Agnostic** - Pure TypeScript, works in any environment
- 🎯 **Production-Ready** - Built-in retry, deduplication, error recovery
- 🔧 **Modular & Extensible** - Plugin system, middleware, custom adapters
- 🔐 **Type-Safe** - Full TypeScript support with advanced types
- 📦 **Zero Framework Dependencies** - Pure SDK, works with any framework
- ⚡ **High Performance** - Advanced caching (TTL, LRU), performance monitoring
- 📡 **Observable** - Comprehensive event system and metrics
- 🧪 **Testing-Friendly** - Complete mocking and testing utilities
- 🚀 **Quick Setup** - Get started in less than 10 lines of code

## 🚀 Quick Start

### Installation

```bash
npm install @fhevm-sdk ethers
```

### Basic Usage

```typescript
import { createFhevmClient, createInstance, encrypt, decrypt } from 'fhevm-sdk'
import { toFhevmSigner } from 'fhevm-sdk/adapters/ethers'
import { BrowserProvider } from 'ethers'

// 1. Create client
const client = createFhevmClient({
  network: window.ethereum,
  chainId: 8009
})

// 2. Create instance
const instance = await createInstance(client)

// 3. Encrypt data
const provider = new BrowserProvider(window.ethereum)
const signer = await provider.getSigner()
const userAddress = await signer.getAddress()

const encrypted = await encrypt(client, {
  instance,
  contractAddress: '0x...',
  userAddress,
  buildInputs: (builder) => {
    builder.add64(42)
  }
})

// 4. Decrypt data
const results = await decrypt(client, {
  instance,
  signer: toFhevmSigner(signer),
  requests: [
    { handle: '0x...', contractAddress: '0x...' }
  ]
})

console.log(results['0x...']) // 42n
```

## 📖 Core Concepts

### Client

The client holds your configuration and manages state:

```typescript
const client = createFhevmClient({
  network: 'https://rpc-url' | window.ethereum,
  chainId: 8009,
  mockChains: { 31337: 'http://localhost:8545' },
  storage: myStorage, // Optional
  debug: true         // Optional
})
```

### Instance

The instance is needed for encryption/decryption:

```typescript
const instance = await createInstance(client)
```

### Encryption

Encrypt one or more values:

```typescript
// Single value
const result = await encrypt(client, {
  instance,
  contractAddress: '0x...',
  userAddress: '0x...',
  buildInputs: (builder) => builder.add64(42)
})

// Multiple values (batch)
const result = await encrypt(client, {
  instance,
  contractAddress: '0x...',
  userAddress: '0x...',
  buildInputs: (builder) => {
    builder
      .add64(42)
      .add32(100)
      .addBool(true)
  }
})
```

### Decryption

Decrypt one or more handles:

```typescript
// Single handle
const results = await decrypt(client, {
  instance,
  signer: toFhevmSigner(signer),
  requests: [
    { handle: '0x...', contractAddress: '0x...' }
  ]
})

// Multiple handles (batch)
const results = await decrypt(client, {
  instance,
  signer: toFhevmSigner(signer),
  requests: [
    { handle: '0x...1', contractAddress: '0x...' },
    { handle: '0x...2', contractAddress: '0x...' },
    { handle: '0x...3', contractAddress: '0x...' }
  ]
})
```

## 🔢 Supported Types

```typescript
builder.addBool(true)              // Boolean
builder.add8(255)                  // uint8
builder.add16(65535)               // uint16
builder.add32(4294967295)          // uint32
builder.add64(18446744073709551615n) // uint64
builder.add128(...)                // uint128
builder.add256(...)                // uint256
builder.addAddress('0x...')        // address
```

## 📦 Batch Operations

### Batch Encryption

```typescript
import { batchEncrypt } from 'fhevm-sdk/core'

const results = await batchEncrypt(client, {
  instance,
  items: [
    {
      contractAddress: '0x...1',
      userAddress: '0x...',
      values: [
        { type: 'uint64', value: 42 },
        { type: 'bool', value: true }
      ]
    },
    {
      contractAddress: '0x...2',
      userAddress: '0x...',
      values: [
        { type: 'uint32', value: 100 }
      ]
    }
  ]
})
```

### Batch Decryption

```typescript
import { batchDecrypt } from 'fhevm-sdk/core'

const results = await batchDecrypt(client, {
  instance,
  signer: toFhevmSigner(signer),
  requests: [
    { handle: '0x...1', contractAddress: '0x...' },
    { handle: '0x...2', contractAddress: '0x...' },
    { handle: '0x...3', contractAddress: '0x...' }
  ]
})
```

See [BATCH_OPERATIONS.md](./BATCH_OPERATIONS.md) for detailed batch operation guide.

## 💾 Storage Adapters

```typescript
// In-memory (default)
import { GenericStringInMemoryStorage } from 'fhevm-sdk/storage'
const storage = new GenericStringInMemoryStorage()

// LocalStorage (browser)
import { LocalStorageAdapter } from 'fhevm-sdk/storage'
const storage = new LocalStorageAdapter('fhevm')

// IndexedDB (browser)
import { IndexedDBStorageAdapter } from 'fhevm-sdk/storage'
const storage = new IndexedDBStorageAdapter('fhevm-db', 'kv-store')

// Use custom storage
const client = createFhevmClient({
  network: provider,
  storage
})
```

## 🔧 Advanced Features

### Instance Caching

```typescript
// First call - creates instance
const instance1 = await createInstance(client)

// Second call - returns cached instance (fast)
const instance2 = await createInstance(client)

// Force recreate
const instance3 = await createInstance(client, { force: true })
```

### Error Handling

```typescript
import { 
  FhevmConfigError,
  FhevmInstanceError,
  FhevmEncryptionError,
  FhevmDecryptionError
} from 'fhevm-sdk/errors'

try {
  const result = await encrypt(client, params)
} catch (error) {
  if (error instanceof FhevmConfigError) {
    console.log('Configuration error:', error.message)
  } else if (error instanceof FhevmEncryptionError) {
    console.log('Encryption error:', error.message)
  }
}
```

### Debug Mode

```typescript
const client = createFhevmClient({
  network: provider,
  debug: true  // Enable debug logging
})

// Logs:
// [FHEVM SDK] Creating new FHEVM instance
// [FHEVM SDK] Instance status: sdk-loading
// [FHEVM SDK] Encrypting for contract 0x...
```

## 📚 Documentation

- [Quick Start Guide](./QUICK_START.md) - Get started in < 10 lines
- [Core Logic](./CORE_LOGIC.md) - Architecture and design principles
- [Batch Operations](./BATCH_OPERATIONS.md) - Batch encrypt/decrypt guide
- [Architecture](./ARCHITECTURE.md) - Detailed architecture documentation
- [API Reference](./API.md) - Complete API documentation

## 🏗️ Architecture Highlights

### High Cohesion, Low Coupling

```
core-v2/
├── client.ts       # Configuration and state management
├── instance.ts     # Instance lifecycle management
├── encrypt.ts      # Encryption operations
├── decrypt.ts      # Decryption operations
└── batch.ts        # Batch operation utilities

support/
├── types.ts        # Centralized type definitions
├── errors.ts       # Custom error classes
├── utils/          # Utility functions
└── storage/        # Storage adapters
```

### Key Design Principles

- ✅ **Single Responsibility** - Each module has one clear purpose
- ✅ **Interface-based** - Depend on interfaces, not implementations
- ✅ **Dependency Injection** - Storage and signer are injectable
- ✅ **Type Safety** - Full TypeScript coverage
- ✅ **Error Handling** - Specific error types for better debugging

## 🎯 Examples

### Node.js

```typescript
import { createFhevmClient, createInstance } from 'fhevm-sdk'
import { JsonRpcProvider } from 'ethers'

const provider = new JsonRpcProvider('http://localhost:8545')
const client = createFhevmClient({ network: provider })
const instance = await createInstance(client)
```

### Browser

```typescript
import { createFhevmClient, createInstance, encrypt } from 'fhevm-sdk'

const client = createFhevmClient({
  network: window.ethereum,
  chainId: 8009
})

const instance = await createInstance(client)

// Ready to encrypt/decrypt!
```

### Vue.js

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { createFhevmClient, createInstance } from 'fhevm-sdk'

const instance = ref(null)

onMounted(async () => {
  const client = createFhevmClient({ network: window.ethereum })
  instance.value = await createInstance(client)
})
</script>
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT

## 🔗 Resources

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Zama](https://zama.ai)
- [GitHub Issues](https://github.com/zama-ai/fhevm-sdk/issues)
