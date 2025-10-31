# WASM 模块集成指南

## 概述

FHEVM SDK 的 WebWorker 支持通过 WASM（WebAssembly）模块来加速 FHE 计算。本文档说明如何正确集成 WASM 模块。

## 当前实现状态

SDK 提供了 WASM 加载的基础框架，但**需要根据你的具体 WASM 模块结构来实现实际的初始化逻辑**。

### 默认行为

- 如果没有提供 WASM 路径，使用 JavaScript 回退实现（用于演示和开发）
- 如果 WASM 加载失败，自动回退到 JavaScript 实现
- Worker 不会因为 WASM 加载失败而崩溃

## 集成 WASM 模块

### 1. 准备 WASM 文件

首先，你需要有一个编译好的 WASM 文件。常见的来源：
- Rust 编译的 WASM（使用 `wasm-pack`）
- C/C++ 编译的 WASM（使用 Emscripten）
- 其他支持 WebAssembly 的语言

### 2. 放置 WASM 文件

在 Next.js 项目中，将 WASM 文件放在 `public` 目录下：

```
public/
  wasm/
    fhe.wasm
```

### 3. 实现 WASM 初始化

在 `src/workers/FheWorker.ts` 的 `loadWASM` 函数中，根据你的 WASM 模块类型实现初始化：

#### 使用 wasm-bindgen (Rust)

```typescript
// 在 loadWASM 函数中
async function loadWASM(wasmPath) {
  try {
    // 导入 wasm-bindgen 生成的 JS 包装
    const wasmModule = await import(wasmPath.replace('.wasm', '.js'));
    await wasmModule.default(wasmPath);
    return wasmModule;
  } catch (error) {
    console.error('Failed to load WASM:', error);
    return null; // 回退到 JS
  }
}

// 在 encrypt 函数中使用
if (wasmModule && wasmModule.encrypt) {
  return wasmModule.encrypt(value, type);
}
```

#### 使用 Emscripten (C/C++)

```typescript
async function loadWASM(wasmPath) {
  try {
    // 加载 Emscripten 生成的 JS 模块
    const wasmModule = await import(wasmPath.replace('.wasm', '.js'));
    return wasmModule;
  } catch (error) {
    console.error('Failed to load WASM:', error);
    return null;
  }
}
```

#### 使用原始 WebAssembly API

```typescript
async function loadWASM(wasmPath) {
  try {
    const response = await fetch(wasmPath);
    const wasmBytes = await response.arrayBuffer();
    
    // 定义导入对象（根据你的 WASM 模块需要）
    const imports = {
      env: {
        // 你的导入函数
      }
    };
    
    const wasmModule = await WebAssembly.instantiate(wasmBytes, imports);
    return wasmModule.instance.exports;
  } catch (error) {
    console.error('Failed to load WASM:', error);
    return null;
  }
}
```

## 使用示例

### 基本使用（无 WASM）

```typescript
import { FheWorker } from '@fhevm-sdk';

// 不提供 WASM 路径，使用 JavaScript 实现
const worker = new FheWorker({
  debug: true
});

await worker.init();
const ciphertext = await worker.encrypt(42, {
  type: 'uint64',
  contractAddress: '0x...',
  userAddress: '0x...'
});
```

### 使用 WASM 模块

```typescript
import { FheWorker } from '@fhevm-sdk';

// 提供 WASM 路径
const worker = new FheWorker({
  wasmPath: '/wasm/fhe.wasm',
  debug: true
});

await worker.init(); // 会自动加载 WASM
const ciphertext = await worker.encrypt(42, {
  type: 'uint64',
  contractAddress: '0x...',
  userAddress: '0x...'
});
```

## Next.js 配置

### 1. 确保 WASM 文件被正确服务

Next.js 会自动服务 `public` 目录下的文件，所以 `/wasm/fhe.wasm` 会被正确提供。

### 2. Webpack 配置（如果需要）

如果遇到模块解析问题，可以在 `next.config.js` 中添加：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // 确保 WASM 文件被正确处理
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    
    return config;
  },
};

module.exports = nextConfig;
```

## 调试

### 启用调试日志

```typescript
const worker = new FheWorker({
  wasmPath: '/wasm/fhe.wasm',
  debug: true // 启用详细日志
});
```

### 检查加载状态

Worker 会输出详细的加载日志：
- `WASM module loaded and initialized` - WASM 成功加载
- `WASM module not available, using JavaScript fallback` - 使用 JS 回退
- `Failed to load WASM module` - 加载失败（会自动回退）

## 注意事项

1. **CORS 问题**: 确保 WASM 文件可以从 Worker 的上下文中访问（可能需要配置 CORS）
2. **文件大小**: 大型 WASM 文件可能需要更长的加载时间
3. **兼容性**: 检查浏览器对 WebAssembly 的支持
4. **类型定义**: 如果使用 TypeScript，为 WASM 模块创建类型定义文件

## 示例：完整的 WASM 集成

```typescript
// worker.ts (Worker 脚本中的完整示例)
async function loadWASM(wasmPath) {
  try {
    // 假设使用 wasm-bindgen
    const wasmModule = await import(wasmPath.replace('.wasm', '.js'));
    
    // 初始化 WASM
    await wasmModule.default(wasmPath);
    
    // 验证模块是否可用
    if (wasmModule.encrypt && wasmModule.decrypt) {
      return wasmModule;
    } else {
      throw new Error('WASM module missing required functions');
    }
  } catch (error) {
    console.error('WASM load error:', error);
    return null;
  }
}

// 在 encrypt 函数中使用
async function encrypt(payload, id) {
  try {
    const { value, type } = payload;
    
    let encrypted;
    
    if (wasmModule && wasmModule.encrypt) {
      // 使用 WASM 加密
      encrypted = wasmModule.encrypt(value, type);
    } else {
      // 回退到 JS 实现
      encrypted = jsEncryptFallback(value, type);
    }
    
    post('encrypt-response', Array.from(encrypted), id, null);
  } catch (error) {
    post('error', null, id, error.message);
  }
}
```

## 故障排除

### 错误: "Failed to resolve module specifier"

**原因**: Worker 中不能直接使用 `import()` 加载 WASM 文件。

**解决方案**: 使用 `fetch()` 加载 WASM 字节码，然后使用 `WebAssembly.instantiate()` 初始化。

### 错误: "Cross-origin error"

**原因**: WASM 文件在不同源加载。

**解决方案**: 
- 确保 WASM 文件在 `public` 目录下
- 检查服务器 CORS 配置
- 考虑使用相对路径而非绝对路径

### Worker 初始化超时

**原因**: WASM 文件太大或网络慢。

**解决方案**:
- 增加超时时间（在 Worker 初始化代码中）
- 优化 WASM 文件大小
- 使用 CDN 加速

## 下一步

1. 根据你的 FHE 库实现实际的 WASM 加载逻辑
2. 更新 Worker 脚本中的 `encrypt` 和 `decrypt` 函数以使用 WASM
3. 添加适当的错误处理和回退机制
4. 测试性能提升

