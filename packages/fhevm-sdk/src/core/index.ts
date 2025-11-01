/**
 * FHEVM SDK Core Module
 * 
 * High cohesion, low coupling design:
 * - Each module has a single responsibility
 * - Clear separation between client, instance, encrypt, decrypt
 * - Centralized error handling and validation
 * - Type-safe throughout
 */

// ============================================
// Client
// ============================================
export { FhevmClient, createFhevmClient } from "./client";

// ============================================
// Instance Management
// ============================================
export {
  createInstance,
  getInstance,
  clearInstance,
  ensureInstance,
  type CreateInstanceOptions,
} from "./instance";

// ============================================
// Encryption
// ============================================
export {
  encrypt,
  createEncryptedInput,
  type EncryptParams,
} from "./encrypt";

// ============================================
// Decryption
// ============================================
export {
  decrypt,
  publicDecrypt,
  type DecryptParams,
} from "./decrypt";

// ============================================
// Batch Operations
// ============================================
export {
  batchEncrypt,
  batchDecrypt,
  batchPublicDecrypt,
  createDecryptRequests,
  groupDecryptResultsByContract,
  type BatchEncryptItem,
} from "./batch";

// ============================================
// Provider Management
// ============================================
export {
  detectProviderType,
  createProviderConfig,
  getProviderInfo,
  validateProviderUrl,
  createHttpProvider,
  createWebSocketProvider,
  ProviderManager,
  type ProviderType,
  type ProviderConfig,
  type ProviderInfo,
} from "./provider";

// ============================================
// Chain Data Queries
// ============================================
export {
  getBalance,
  getBlock,
  getTransaction,
  getTransactionReceipt,
  call,
  estimateGas,
  getGasPrice,
  getBlockNumber,
  getTransactionCount,
  type BlockInfo,
  type TransactionInfo,
  type TransactionReceipt,
  type CallResult,
  type GasEstimate,
} from "./chain";

// ============================================
// Internal Utilities (Advanced)
// ============================================
export { createFhevmInstance } from "../internal/fhevm";
export { RelayerSDKLoader, isFhevmWindowType } from "../internal/RelayerSDKLoader";
export { publicKeyStorageGet, publicKeyStorageSet } from "../internal/PublicKeyStorage";
export type { 
  FhevmInitSDKOptions,
  FhevmWindowType,
  FhevmRelayerSDKType
} from "../internal/fhevmTypes";
export { SDK_CDN_URL } from "../internal/constants";

