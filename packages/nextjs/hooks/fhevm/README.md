# FHEVM React Hooks

React hooks for FHEVM SDK, designed for Next.js and React applications.

## 🎯 Overview

This directory contains React-specific hooks that wrap the core FHEVM SDK functionality. These hooks provide a React-friendly interface for:

- Creating and managing FHEVM clients
- Managing FHEVM instances
- Encrypting data
- Decrypting handles

## 📦 Hooks

### `useFhevmClient`

Creates and memoizes an FHEVM client.

```tsx
import { useFhevmClient } from '~~/hooks/fhevm'

function MyComponent() {
  const client = useFhevmClient({
    network: window.ethereum,
    chainId: 8009,
    mockChains: { 31337: 'http://localhost:8545' }
  })
}
```

### `useFhevmInstance`

Creates and manages an FHEVM instance with automatic caching.

```tsx
import { useFhevmInstance } from '~~/hooks/fhevm'

function MyComponent() {
  const client = useFhevmClient({ ... })
  const { instance, status, error, refetch } = useFhevmInstance(client, {
    enabled: true
  })
}
```

### `useEncrypt`

Hook for encrypting data.

```tsx
import { useEncrypt } from '~~/hooks/fhevm'

function MyComponent() {
  const { encryptData, canEncrypt } = useEncrypt(client, {
    instance,
    signer,
    contractAddress,
    userAddress
  })
  
  const handleEncrypt = async () => {
    const result = await encryptData((builder) => {
      builder.add64(42)
    })
  }
}
```

### `useDecrypt`

Hook for decrypting handles.

```tsx
import { useDecrypt } from '~~/hooks/fhevm'

function MyComponent() {
  const { decryptData, results, isDecrypting } = useDecrypt(client, {
    instance,
    signer,
    requests: [
      { handle: '0x...', contractAddress: '0x...' }
    ]
  })
}
```

## 🔧 Legacy Hooks

The following legacy hooks are also available for backward compatibility:

- `useFhevm` - Legacy FHEVM instance hook
- `useFHEEncryption` - Legacy encryption hook
- `useFHEDecrypt` - Legacy decryption hook
- `useInMemoryStorage` - Legacy storage hook

## 📝 Usage Example

Complete example combining all hooks:

```tsx
"use client";

import { useMemo } from 'react';
import { 
  useFhevmClient, 
  useFhevmInstance, 
  useEncrypt, 
  useDecrypt 
} from '~~/hooks/fhevm';
import { toFhevmSigner } from '@fhevm-sdk/adapters/ethers';
import { GenericStringInMemoryStorage } from '@fhevm-sdk/storage';
import { useWagmiEthers } from '~~/hooks/wagmi/useWagmiEthers';

export function MyFHEVMComponent() {
  const { ethersSigner, chainId } = useWagmiEthers();
  
  // 1. Create client
  const client = useFhevmClient({
    network: window.ethereum,
    chainId,
    mockChains: { 31337: 'http://localhost:8545' },
    storage: new GenericStringInMemoryStorage()
  });
  
  // 2. Create instance
  const { instance, status } = useFhevmInstance(client, {
    enabled: true
  });
  
  // 3. Convert signer
  const fhevmSigner = useMemo(() => {
    return ethersSigner ? toFhevmSigner(ethersSigner) : undefined;
  }, [ethersSigner]);
  
  // 4. Encrypt
  const { encryptData } = useEncrypt(client, {
    instance,
    signer: fhevmSigner,
    contractAddress: '0x...',
    userAddress: ethersSigner?.address
  });
  
  // 5. Decrypt
  const { decryptData, results } = useDecrypt(client, {
    instance,
    signer: fhevmSigner,
    requests: [
      { handle: '0x...', contractAddress: '0x...' }
    ]
  });
  
  if (status === 'loading') return <div>Loading FHEVM...</div>;
  if (status === 'error') return <div>Error loading FHEVM</div>;
  
  return (
    <div>
      <button onClick={() => encryptData((b) => b.add64(42))}>
        Encrypt
      </button>
      <button onClick={decryptData}>
        Decrypt
      </button>
    </div>
  );
}
```

## 🔗 Dependencies

These hooks depend on the core FHEVM SDK:

- `@fhevm-sdk/core` - Core SDK functionality
- `@fhevm-sdk/types` - Type definitions
- `@fhevm-sdk/utils` - Utility functions
- `@fhevm-sdk/storage` - Storage adapters
- `@fhevm-sdk/adapters/ethers` - Ethers.js adapter

## 📚 Related

- [FHEVM SDK Core](../../fhevm-sdk/README.md)
- [Next.js Migration Guide](../../../../NEXTJS_MIGRATION.md)

