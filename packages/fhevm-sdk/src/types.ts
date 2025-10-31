/**
 * Core types for FHEVM SDK
 * Centralized type definitions for better maintainability
 */

// Re-export from fhevmTypes for convenience
export type { 
  FhevmInstance, 
  FhevmInstanceConfig,
  HandleContractPair,
  DecryptedResults 
} from "./fhevmTypes";

/**
 * Network provider type
 * Can be a string (RPC URL) or an EIP-1193 provider
 */
export type NetworkProvider = string | {
  request(args: { method: string; params?: any[] }): Promise<any>;
};

/**
 * Storage interface for caching keys and signatures
 */
export interface Storage {
  getItem(key: string): string | Promise<string | null> | null;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/**
 * Signer interface for framework-agnostic signing
 */
export interface Signer {
  getAddress(): Promise<string>;
  signTypedData(domain: any, types: any, message: any): Promise<string>;
}

/**
 * Instance creation status
 */
export type InstanceStatus = 
  | "sdk-loading"
  | "sdk-loaded" 
  | "sdk-initializing"
  | "sdk-initialized"
  | "creating";

/**
 * Client configuration
 */
export interface ClientConfig {
  /** Network provider (RPC URL or EIP-1193 provider) */
  network: NetworkProvider;
  /** Chain ID (optional) */
  chainId?: number;
  /** Mock chains for local development (optional) */
  mockChains?: Record<number, string>;
  /** Storage adapter (optional, defaults to in-memory) */
  storage?: Storage;
  /** Enable debug logging (optional) */
  debug?: boolean;
}

/**
 * Decryption request
 */
export interface DecryptRequest {
  /** Encrypted handle */
  handle: string;
  /** Contract address */
  contractAddress: string;
}

/**
 * Encryption result
 */
export interface EncryptResult {
  /** Encrypted handles */
  handles: Uint8Array[];
  /** Input proof */
  inputProof: Uint8Array;
}

/**
 * Encrypted input builder
 */
export interface EncryptedInputBuilder {
  addBool(value: boolean): this;
  add8(value: number | bigint): this;
  add16(value: number | bigint): this;
  add32(value: number | bigint): this;
  add64(value: number | bigint): this;
  add128(value: bigint): this;
  add256(value: bigint): this;
  addAddress(value: string): this;
  encrypt(): Promise<EncryptResult>;
}

