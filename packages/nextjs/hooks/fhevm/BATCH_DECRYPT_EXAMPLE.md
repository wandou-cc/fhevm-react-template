# 批量解密使用示例

## 使用 useBatchDecrypt Hook

`useBatchDecrypt` Hook 提供了批量解密多个 handles 的功能，可以一次性解密来自不同合约的多个 handles。

### 基本用法

```tsx
import { useBatchDecrypt } from "~~/hooks/fhevm";
import { useFhevmClient, useFhevmInstance } from "~~/hooks/fhevm";
import { toFhevmSigner } from "@fhevm-sdk";

function MyComponent() {
  const client = useFhevmClient({
    network: window.ethereum,
    chainId: 8009,
  });

  const { instance } = useFhevmInstance(client);

  const signer = useMemo(() => {
    // 从 ethers.js 或其他库获取 signer
    return toFhevmSigner(ethersSigner);
  }, [ethersSigner]);

  // 准备解密请求
  const requests = useMemo(() => [
    { handle: "0x...1", contractAddress: "0x...A" },
    { handle: "0x...2", contractAddress: "0x...A" },
    { handle: "0x...3", contractAddress: "0x...B" },
  ], []);

  // 使用批量解密 Hook
  const {
    batchDecryptData,
    results,
    isDecrypting,
    canDecrypt,
    message,
    requestCount,
    resultCount,
  } = useBatchDecrypt(client, {
    instance,
    signer,
    requests,
    usePublicDecrypt: false, // false = 需要签名, true = 公开解密（无需签名）
  });

  return (
    <div>
      <button onClick={batchDecryptData} disabled={!canDecrypt || isDecrypting}>
        {isDecrypting ? "解密中..." : `批量解密 ${requestCount} 个 handles`}
      </button>
      
      {message && <p>{message}</p>}
      
      {resultCount > 0 && (
        <div>
          <h3>解密结果 ({resultCount}):</h3>
          {Object.entries(results).map(([handle, value]) => (
            <div key={handle}>
              <strong>{handle}:</strong> {String(value)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 公开解密（无需签名）

如果你需要解密公开的 handles（不需要用户签名），可以设置 `usePublicDecrypt: true`：

```tsx
const {
  batchDecryptData,
  results,
} = useBatchDecrypt(client, {
  instance,
  requests: [
    { handle: "0x...1", contractAddress: "0x...A" },
    { handle: "0x...2", contractAddress: "0x...B" },
  ],
  usePublicDecrypt: true, // 无需签名
});
```

### 与单个解密对比

单个解密 (`useDecrypt`) 和批量解密 (`useBatchDecrypt`) 的主要区别：

| 特性 | useDecrypt | useBatchDecrypt |
|------|-----------|----------------|
| 解密数量 | 单个或多个 | 批量（推荐多个） |
| 性能 | 每次调用一个签名 | 一次签名解密多个 |
| 使用场景 | 单个或少量 handles | 大量 handles |
| 签名次数 | N 次（N = handles 数量） | 1 次（按合约分组） |

### 在 FHE Counter 中的使用

在 `useFHECounterWagmi` hook 中，我们已经集成了批量解密功能：

```tsx
const fheCounter = useFHECounterWagmi({
  initialMockChains,
});

// 单个解密（向后兼容）
fheCounter.decryptCountHandle();

// 批量解密（推荐，如果将来有多个 handles）
fheCounter.batchDecryptCountHandle();
```

两个方法会使用相同的结果，批量解密会在有结果时优先使用。

### 高级用法：解密多个合约的 handles

```tsx
const requests = useMemo(() => {
  const handles = [];
  
  // 从合约 A 获取多个 handles
  if (contractAHandles) {
    handles.push(
      ...contractAHandles.map(handle => ({
        handle,
        contractAddress: contractA.address,
      }))
    );
  }
  
  // 从合约 B 获取多个 handles
  if (contractBHandles) {
    handles.push(
      ...contractBHandles.map(handle => ({
        handle,
        contractAddress: contractB.address,
      }))
    );
  }
  
  return handles;
}, [contractAHandles, contractBHandles]);

const { batchDecryptData, results } = useBatchDecrypt(client, {
  instance,
  signer,
  requests,
});
```

批量解密会自动按合约地址分组，并优化签名次数，提供更好的性能。

