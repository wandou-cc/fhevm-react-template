/**
 * Encryption operations - Encrypt data for FHEVM contracts
 * High cohesion: All encryption logic in one place
 */

import type { FhevmClient } from "./client";
import type { FhevmInstance } from "../fhevmTypes";
import type { EncryptResult, EncryptedInputBuilder } from "../types";
import { 
  FhevmEncryptionError, 
  FhevmConfigError 
} from "../errors";
import { 
  validateContractAddress, 
  validateUserAddress 
} from "../utils/validation";

/**
 * Encryption parameters
 */
export interface EncryptParams {
  /** FHEVM instance (optional if client has cached instance) */
  instance?: FhevmInstance;
  /** Contract address */
  contractAddress: string;
  /** User address */
  userAddress: string;
  /** Builder function to add encrypted values */
  buildInputs: (builder: EncryptedInputBuilder) => void | Promise<void>;
}

/**
 * Encrypt data for FHEVM contract
 * 
 * @param client - FHEVM client
 * @param params - Encryption parameters
 * @returns Encryption result with handles and proof
 * 
 * @example
 * ```ts
 * import { createFhevmClient, createInstance, encrypt } from 'fhevm-sdk'
 * 
 * const client = createFhevmClient({ network: provider })
 * const instance = await createInstance(client)
 * 
 * const result = await encrypt(client, {
 *   instance,
 *   contractAddress: '0x...',
 *   userAddress: '0x...',
 *   buildInputs: (builder) => {
 *     builder.add64(42)
 *   }
 * })
 * ```
 */
export async function encrypt(
  client: FhevmClient,
  params: EncryptParams
): Promise<EncryptResult> {
  const { contractAddress, userAddress, buildInputs } = params;
  
  // Get instance from params or client cache
  const instance = params.instance ?? client.instance;
  
  if (!instance) {
    throw new FhevmConfigError(
      "FHEVM instance is required. Create one using createInstance() first."
    );
  }

  // Validate parameters
  validateContractAddress(contractAddress);
  validateUserAddress(userAddress);

  if (typeof buildInputs !== "function") {
    throw new FhevmConfigError("buildInputs must be a function");
  }

  client.debug(`Encrypting for contract ${contractAddress}`);

  try {
    // Create encrypted input
    const input = instance.createEncryptedInput(
      contractAddress,
      userAddress
    ) as EncryptedInputBuilder;

    // Build inputs
    await buildInputs(input);

    // Perform encryption
    const result = await input.encrypt();

    client.debug(
      `Encryption successful: ${result.handles.length} handles, proof size ${result.inputProof.length}`
    );

    return result;
  } catch (error: any) {
    throw new FhevmEncryptionError(
      `Encryption failed: ${error?.message || "Unknown error"}`,
      error
    );
  }
}

/**
 * Create an encrypted input builder (for advanced use)
 * 
 * @param client - FHEVM client
 * @param instance - FHEVM instance
 * @param contractAddress - Contract address
 * @param userAddress - User address
 * @returns Encrypted input builder
 * 
 * @example
 * ```ts
 * const builder = createEncryptedInput(client, instance, contractAddress, userAddress)
 * builder.add64(42).add32(100)
 * const result = await builder.encrypt()
 * ```
 */
export function createEncryptedInput(
  client: FhevmClient,
  instance: FhevmInstance,
  contractAddress: string,
  userAddress: string
): EncryptedInputBuilder {
  validateContractAddress(contractAddress);
  validateUserAddress(userAddress);

  client.debug(`Creating encrypted input for ${contractAddress}`);

  return instance.createEncryptedInput(
    contractAddress,
    userAddress
  ) as EncryptedInputBuilder;
}

