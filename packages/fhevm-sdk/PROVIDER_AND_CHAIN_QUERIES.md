# Provider 管理和链上数据查询

## RPC Provider 管理

SDK 支持多种类型的 RPC Provider：
- **HTTP RPC**: 标准的 HTTP/HTTPS RPC 端点
- **WebSocket RPC**: WebSocket 连接（支持实时订阅）
- **EIP-1193 Provider**: 钱包提供者（如 MetaMask）
- **自定义节点**: 自定义的 RPC 提供者

### Provider 类型检测

```typescript
import { detectProviderType, getProviderInfo } from '@fhevm-sdk';

const network = "https://eth.llamarpc.com";
const type = detectProviderType(network);
console.log(type); // "http"

const info = getProviderInfo(network);
console.log(info);
// {
//   type: "http",
//   url: "https://eth.llamarpc.com",
//   isConnected: true
// }
```

### 创建 HTTP RPC Provider

```typescript
import { createRpcProvider, HttpRpcProvider } from '@fhevm-sdk';

// 方式 1: 使用工厂函数（自动检测类型）
const provider = createRpcProvider("https://eth.llamarpc.com", {
  timeout: 30000
});

// 方式 2: 直接创建 HTTP Provider
const httpProvider = new HttpRpcProvider("https://eth.llamarpc.com", 30000);

// 使用 provider
const balance = await provider.request({
  method: "eth_getBalance",
  params: ["0x...", "latest"]
});
```

### 创建 WebSocket RPC Provider

```typescript
import { createRpcProvider, WebSocketRpcProvider } from '@fhevm-sdk';

// 方式 1: 使用工厂函数
const wsProvider = createRpcProvider("wss://eth.llamarpc.com");

// 方式 2: 直接创建 WebSocket Provider
const ws = new WebSocketRpcProvider("wss://eth.llamarpc.com");

// 断开连接
ws.disconnect();
```

### Provider 配置管理

```typescript
import { ProviderManager, createProviderConfig } from '@fhevm-sdk';

// 创建 Provider 配置
const config = createProviderConfig("https://eth.llamarpc.com", {
  timeout: 30000,
  retry: {
    maxRetries: 3,
    retryDelay: 1000
  }
});

// 使用 ProviderManager
const manager = new ProviderManager("https://eth.llamarpc.com", {
  timeout: 30000
});

await manager.connect();
const info = manager.getInfo();
console.log(info.type); // "http"
console.log(manager.isConnected); // true
```

### 在 Client 中使用

```typescript
import { createFhevmClient, createRpcProvider } from '@fhevm-sdk';

// 使用字符串 URL（自动转换为 RPC Provider）
const client = createFhevmClient({
  network: "https://eth.llamarpc.com",
  chainId: 1
});

// 使用 WebSocket
const clientWS = createFhevmClient({
  network: "wss://eth.llamarpc.com",
  chainId: 1
});

// 使用 EIP-1193 Provider（如 MetaMask）
const clientWallet = createFhevmClient({
  network: window.ethereum,
  chainId: 1
});

// 使用自定义 RPC Provider
const customProvider = createRpcProvider("https://custom-rpc.com");
const clientCustom = createFhevmClient({
  network: customProvider,
  chainId: 1
});
```

## 链上数据查询

SDK 提供了完整的链上数据查询功能。

### 查询余额 (getBalance)

```typescript
import { createFhevmClient, getBalance } from '@fhevm-sdk';

const client = createFhevmClient({
  network: "https://eth.llamarpc.com",
  chainId: 1
});

// 获取最新余额
const balance = await getBalance(client, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");

// 在特定区块查询余额
const balanceAtBlock = await getBalance(client, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", 18500000);

console.log("Balance:", balance.toString(), "wei");
```

### 查询区块信息 (getBlock)

```typescript
import { getBlock, getBlockNumber } from '@fhevm-sdk';

// 获取当前区块号
const blockNumber = await getBlockNumber(client);
console.log("Current block:", blockNumber);

// 获取最新区块信息
const latestBlock = await getBlock(client, "latest");
console.log("Block number:", latestBlock.number);
console.log("Block hash:", latestBlock.hash);
console.log("Timestamp:", new Date(latestBlock.timestamp * 1000));
console.log("Gas used:", latestBlock.gasUsed.toString());

// 获取特定区块
const block = await getBlock(client, 18500000);

// 获取区块并包含完整交易信息
const blockWithTxs = await getBlock(client, "latest", true);
```

### 查询交易信息 (getTransaction)

```typescript
import { getTransaction, getTransactionReceipt } from '@fhevm-sdk';

// 获取交易信息
const tx = await getTransaction(client, "0x...");
console.log("From:", tx.from);
console.log("To:", tx.to);
console.log("Value:", tx.value.toString(), "wei");
console.log("Gas price:", tx.gasPrice.toString());
console.log("Block number:", tx.blockNumber);

// 获取交易收据
const receipt = await getTransactionReceipt(client, "0x...");
if (receipt) {
  console.log("Status:", receipt.status); // "success" or "failed"
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Contract address:", receipt.contractAddress);
}
```

### 调用合约方法 (call)

```typescript
import { call } from '@fhevm-sdk';

// 调用只读合约方法
const result = await call(client, {
  to: "0x...", // 合约地址
  data: "0x...", // ABI 编码的方法调用数据
  from: "0x...", // 可选：调用者地址
  blockTag: "latest" // 可选：区块标签
});

console.log("Result:", result.result);

// 示例：调用 ERC20 balanceOf
const balanceOfData = "0x70a08231" + // balanceOf(address) function selector
  "000000000000000000000000" + // padding
  "742d35Cc6634C0532925a3b844Bc9e7595f0bEb".slice(2); // address

const erc20Balance = await call(client, {
  to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  data: balanceOfData
});

console.log("Balance:", BigInt(erc20Balance.result).toString());
```

### 估算 Gas (estimateGas)

```typescript
import { estimateGas, getGasPrice } from '@fhevm-sdk';

// 估算交易 Gas
const estimate = await estimateGas(client, {
  from: "0x...",
  to: "0x...",
  data: "0x...",
  value: BigInt("1000000000000000000") // 1 ETH
});

console.log("Gas limit:", estimate.gasLimit.toString());

// 获取当前 Gas 价格
const gasPrice = await getGasPrice(client);
console.log("Gas price:", gasPrice.toString(), "wei");
```

### 获取交易计数 (getTransactionCount)

```typescript
import { getTransactionCount } from '@fhevm-sdk';

// 获取地址的 nonce（交易计数）
const nonce = await getTransactionCount(client, "0x...", "latest");
console.log("Nonce:", nonce);
```

## 完整示例

```typescript
import {
  createFhevmClient,
  getBalance,
  getBlock,
  getBlockNumber,
  getTransaction,
  call,
  estimateGas,
  createRpcProvider
} from '@fhevm-sdk';

async function chainQueryExample() {
  // 创建 client
  const client = createFhevmClient({
    network: createRpcProvider("https://eth.llamarpc.com"),
    chainId: 1,
    debug: true
  });

  const address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

  // 1. 查询余额
  const balance = await getBalance(client, address);
  console.log("Balance:", balance.toString(), "wei");

  // 2. 查询当前区块号
  const blockNumber = await getBlockNumber(client);
  console.log("Current block:", blockNumber);

  // 3. 查询区块信息
  const block = await getBlock(client, "latest");
  console.log("Block hash:", block.hash);
  console.log("Block timestamp:", new Date(block.timestamp * 1000));

  // 4. 查询交易
  const txHash = "0x..."; // 替换为实际的交易哈希
  try {
    const tx = await getTransaction(client, txHash);
    console.log("Transaction from:", tx.from);
    console.log("Transaction value:", tx.value.toString());
  } catch (error) {
    console.log("Transaction not found");
  }

  // 5. 调用合约方法
  const contractAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC
  const callData = "0x70a08231" + // balanceOf(address)
    "000000000000000000000000" +
    address.slice(2);
  
  const result = await call(client, {
    to: contractAddress,
    data: callData
  });
  console.log("Contract call result:", result.result);

  // 6. 估算 Gas
  const gasEstimate = await estimateGas(client, {
    from: address,
    to: contractAddress,
    data: callData
  });
  console.log("Estimated gas:", gasEstimate.gasLimit.toString());
}

chainQueryExample();
```

## 错误处理

所有链上查询函数都会抛出 `FhevmNetworkError` 或 `FhevmConfigError`：

```typescript
import { getBalance, FhevmNetworkError, FhevmConfigError } from '@fhevm-sdk';

try {
  const balance = await getBalance(client, "0x...");
} catch (error) {
  if (error instanceof FhevmNetworkError) {
    console.error("Network error:", error.message);
  } else if (error instanceof FhevmConfigError) {
    console.error("Configuration error:", error.message);
  }
}
```

## 性能优化建议

1. **使用 WebSocket**: 对于需要实时数据的场景，使用 WebSocket Provider
2. **批量查询**: 使用 Promise.all 并行查询多个数据
3. **缓存结果**: 对于不经常变化的数据，实现缓存机制
4. **错误重试**: Provider 配置支持自动重试

```typescript
// 批量查询示例
const [balance, block, gasPrice] = await Promise.all([
  getBalance(client, address),
  getBlock(client, "latest"),
  getGasPrice(client)
]);
```

