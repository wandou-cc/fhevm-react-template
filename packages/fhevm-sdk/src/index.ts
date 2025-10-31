/**
 * FHEVM SDK - Universal SDK for Fully Homomorphic Encryption
 * 
 * A framework-agnostic SDK with wagmi-like structure for building
 * confidential dApps with FHEVM.
 * 
 * @example
 * ```ts
 * // Core usage (framework-agnostic)
 * import { createFhevmClient, createInstance, encrypt, decrypt } from 'fhevm-sdk'
 * 
 * const client = createFhevmClient({
 *   network: 'https://devnet.zama.ai',
 *   chainId: 8009
 * })
 * 
 * const instance = await createInstance(client)
 * ```
 */

// ============================================
// Core API
// ============================================
export * from "./core";

// ============================================
// Types
// ============================================
export * from "./types";
export * from "./fhevmTypes";

// ============================================
// Storage Adapters
// ============================================
export * from "./storage";
// Re-export storage for convenience
export { 
  GenericStringInMemoryStorage,
  LocalStorageAdapter,
  IndexedDBStorageAdapter
} from "./storage";

// ============================================
// Errors (Note: FhevmAbortError also exported from core)
// ============================================
export * from "./errors";

// ============================================
// Framework Adapters
// ============================================
export * from "./adapters";
// Re-export adapters for convenience
export { toFhevmSigner, toFhevmProvider } from "./adapters/ethers";

// ============================================
// Utilities
// ============================================
export * from "./utils";
// Re-export utilities for convenience
export { 
  getEncryptionMethod, 
  buildParamsFromAbi
} from "./utils/abi";
export { 
  toHex,
  uint8ArrayToHex,
  stringToHex
} from "./utils/hex";
export { 
  isValidAddress,
  validateClientConfig,
  validateDecryptRequests
} from "./utils/validation";

// ============================================
// RPC Adapters
// ============================================
export {
  HttpRpcProvider,
  WebSocketRpcProvider,
  createRpcProvider,
  toRpcProvider,
} from "./adapters/rpc";

// ============================================
// WebWorker for Heavy Computations
// ============================================
export {
  FheWorker,
  type FheWorkerConfig,
  type FheWorkerResult,
  type FheWorkerMessage,
  type FheWorkerMessageType,
} from "./workers/FheWorker";

// ============================================
// Advanced (for custom implementations)
// ============================================
export { FhevmDecryptionSignature } from "./FhevmDecryptionSignature";
