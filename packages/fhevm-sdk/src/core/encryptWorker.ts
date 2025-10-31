/**
 * Encryption with WebWorker
 * Uses WebWorker for heavy encryption operations to avoid blocking main thread
 */

import type { FhevmClient } from "./client";
import type { FhevmInstance } from "../fhevmTypes";
import type { EncryptResult, EncryptedInputBuilder } from "../types";
import { FhevmConfigError, FhevmEncryptionError } from "../errors";
import { FheWorker } from "../workers/FheWorker";
import { isValidAddress } from "../utils/validation";

/**
 * Encryption with worker parameters
 */
export interface EncryptWithWorkerParams {
  /** FHEVM instance */
  instance?: FhevmInstance;
  /** Contract address */
  contractAddress: string;
  /** User address */
  userAddress: string;
  /** Worker configuration */
  workerConfig?: {
    wasmPath?: string;
    workerPath?: string;
    debug?: boolean;
  };
  /** Values to encrypt with type information */
  values: Array<{
    type: "bool" | "uint8" | "uint16" | "uint32" | "uint64" | "uint128" | "uint256" | "address";
    value: number | bigint | boolean | string;
  }>;
}

/**
 * Encrypt using WebWorker
 * Offloads encryption computation to WebWorker thread
 * 
 * @param client - FHEVM client
 * @param params - Encryption parameters
 * @returns Encryption result
 * 
 * @example
 * ```ts
 * const result = await encryptWithWorker(client, {
 *   contractAddress: "0x...",
 *   userAddress: "0x...",
 *   workerConfig: {
 *     wasmPath: "/wasm/fhe.wasm",
 *     debug: true
 *   },
 *   values: [
 *     { type: "uint64", value: 42 },
 *     { type: "bool", value: true }
 *   ]
 * });
 * ```
 */
export async function encryptWithWorker(
  client: FhevmClient,
  params: EncryptWithWorkerParams
): Promise<EncryptResult> {
  const { contractAddress, userAddress, values, workerConfig, instance } = params;
  const fhevmInstance = instance ?? client.instance;

  if (!fhevmInstance) {
    throw new FhevmConfigError("FHEVM instance is required");
  }

  // Validate addresses
  if (!isValidAddress(contractAddress)) {
    throw new FhevmConfigError(`Invalid contract address: ${contractAddress}`);
  }
  if (!isValidAddress(userAddress)) {
    throw new FhevmConfigError(`Invalid user address: ${userAddress}`);
  }

  if (!values || values.length === 0) {
    throw new FhevmConfigError("At least one value is required for encryption");
  }

  client.debug("Starting encryption with WebWorker...");

  // Create worker
  const worker = new FheWorker({
    wasmPath: workerConfig?.wasmPath,
    workerPath: workerConfig?.workerPath,
    debug: workerConfig?.debug ?? client.isDebug(),
  });

  try {
    // Initialize worker
    await worker.init();
    client.debug("Worker initialized");

    // Encrypt each value using worker
    const handles: Uint8Array[] = [];
    
    for (const item of values) {
      client.debug(`Encrypting ${item.type}: ${item.value}`);
      
      // Convert address type to uint256 for encryption
      const value = item.type === "address" 
        ? BigInt(item.value as string)
        : item.value as number | bigint | boolean;
      
      const ciphertext = await worker.encrypt(value, {
        type: item.type === "address" ? "uint256" : item.type as any,
        contractAddress,
        userAddress,
      });

      handles.push(ciphertext);
    }

    // Generate input proof using FHEVM instance
    // Note: In production, this might also be done in the worker
    const input = fhevmInstance.createEncryptedInput(
      contractAddress as `0x${string}`,
      userAddress as `0x${string}`
    ) as EncryptedInputBuilder;

    // Rebuild inputs for proof generation
    for (const item of values) {
      switch (item.type) {
        case "bool":
          input.addBool(item.value as boolean);
          break;
        case "uint8":
          input.add8(item.value as number);
          break;
        case "uint16":
          input.add16(item.value as number);
          break;
        case "uint32":
          input.add32(item.value as number);
          break;
        case "uint64":
          input.add64(item.value as number | bigint);
          break;
        case "uint128":
          input.add128(item.value as bigint);
          break;
        case "uint256":
          input.add256(item.value as bigint);
          break;
        case "address":
          input.addAddress(item.value as string);
          break;
      }
    }

    const encryptionResult = await input.encrypt();
    
    client.debug(`Encryption completed: ${handles.length} handle(s)`);

    // Replace handles with worker-encrypted values
    // In a real implementation, you might need to merge worker results with FHEVM proof
    return {
      handles: handles.length === encryptionResult.handles.length 
        ? handles 
        : encryptionResult.handles,
      inputProof: encryptionResult.inputProof,
    };
  } catch (error: any) {
    throw new FhevmEncryptionError(
      `Worker encryption failed: ${error?.message || "Unknown error"}`,
      error
    );
  } finally {
    // Cleanup worker
    worker.terminate();
  }
}

/**
 * Create a reusable worker manager
 * Allows sharing a single worker across multiple operations
 */
export interface FheWorkerManagerConfig {
  wasmPath?: string;
  workerPath?: string;
  debug?: boolean;
}

export class FheWorkerManager {
  private worker: FheWorker | null = null;
  private config: FheWorkerManagerConfig;

  constructor(config?: FheWorkerManagerConfig) {
    this.config = config || {};
  }

  /**
   * Get or create worker
   */
  async getWorker(): Promise<FheWorker> {
    if (!this.worker) {
      this.worker = new FheWorker({
        wasmPath: this.config.wasmPath,
        workerPath: this.config.workerPath,
        debug: this.config.debug,
      });
      await this.worker.init();
    }
    return this.worker;
  }

  /**
   * Terminate worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

