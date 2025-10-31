/**
 * Batch operations - Convenience functions for batch encrypt/decrypt
 * High cohesion: Batch operation utilities
 */

import type { FhevmClient } from "./client";
import type { FhevmInstance } from "../fhevmTypes";
import type { Signer, EncryptResult, DecryptRequest, DecryptedResults } from "../types";
import { encrypt, type EncryptParams } from "./encrypt";
import { decrypt, publicDecrypt, type DecryptParams } from "./decrypt";
import { FhevmConfigError } from "../errors";

/**
 * Batch encryption item
 */
export interface BatchEncryptItem {
  /** Contract address */
  contractAddress: string;
  /** User address */
  userAddress: string;
  /** Values to encrypt */
  values: Array<{
    type: 'bool' | 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'uint128' | 'uint256' | 'address';
    value: any;
  }>;
}

/**
 * Batch encrypt multiple items
 * Each item can have multiple values
 * 
 * @param client - FHEVM client
 * @param params - Batch encryption parameters
 * @returns Array of encryption results
 * 
 * @example
 * ```ts
 * const results = await batchEncrypt(client, {
 *   instance,
 *   items: [
 *     {
 *       contractAddress: '0x...1',
 *       userAddress: '0x...',
 *       values: [
 *         { type: 'uint64', value: 42 },
 *         { type: 'bool', value: true }
 *       ]
 *     },
 *     {
 *       contractAddress: '0x...2',
 *       userAddress: '0x...',
 *       values: [
 *         { type: 'uint32', value: 100 }
 *       ]
 *     }
 *   ]
 * })
 * ```
 */
export async function batchEncrypt(
  client: FhevmClient,
  params: {
    instance?: FhevmInstance;
    items: BatchEncryptItem[];
  }
): Promise<EncryptResult[]> {
  const { instance, items } = params;

  if (!items || items.length === 0) {
    throw new FhevmConfigError("At least one item is required for batch encryption");
  }

  client.debug(`Batch encrypting ${items.length} item(s)`);

  const results = await Promise.all(
    items.map((item) =>
      encrypt(client, {
        instance,
        contractAddress: item.contractAddress,
        userAddress: item.userAddress,
        buildInputs: (builder) => {
          for (const { type, value } of item.values) {
            switch (type) {
              case 'bool':
                builder.addBool(value);
                break;
              case 'uint8':
                builder.add8(value);
                break;
              case 'uint16':
                builder.add16(value);
                break;
              case 'uint32':
                builder.add32(value);
                break;
              case 'uint64':
                builder.add64(value);
                break;
              case 'uint128':
                builder.add128(value);
                break;
              case 'uint256':
                builder.add256(value);
                break;
              case 'address':
                builder.addAddress(value);
                break;
            }
          }
        }
      })
    )
  );

  client.debug(`Batch encryption completed: ${results.length} result(s)`);

  return results;
}

/**
 * Batch decrypt multiple handles from different contracts
 * Automatically groups by contract address for efficient decryption
 * 
 * @param client - FHEVM client
 * @param params - Batch decryption parameters
 * @returns Decrypted values mapped by handle
 * 
 * @example
 * ```ts
 * const results = await batchDecrypt(client, {
 *   instance,
 *   signer,
 *   requests: [
 *     { handle: '0x...1', contractAddress: '0x...A' },
 *     { handle: '0x...2', contractAddress: '0x...A' },
 *     { handle: '0x...3', contractAddress: '0x...B' }
 *   ]
 * })
 * 
 * // results = {
 * //   '0x...1': 42n,
 * //   '0x...2': true,
 * //   '0x...3': 100n
 * // }
 * ```
 */
export async function batchDecrypt(
  client: FhevmClient,
  params: {
    instance?: FhevmInstance;
    signer: Signer;
    requests: DecryptRequest[];
  }
): Promise<DecryptedResults> {
  const { instance, signer, requests } = params;

  if (!requests || requests.length === 0) {
    throw new FhevmConfigError("At least one request is required for batch decryption");
  }

  client.debug(`Batch decrypting ${requests.length} handle(s)`);

  // Decrypt all at once (already batched internally)
  const results = await decrypt(client, {
    instance,
    signer,
    requests
  });

  client.debug(`Batch decryption completed: ${Object.keys(results).length} value(s)`);

  return results;
}

/**
 * Batch public decrypt (no signature required)
 * 
 * @param client - FHEVM client
 * @param params - Batch public decryption parameters
 * @returns Decrypted values
 * 
 * @example
 * ```ts
 * const results = await batchPublicDecrypt(client, {
 *   instance,
 *   requests: [
 *     { handle: '0x...1', contractAddress: '0x...' },
 *     { handle: '0x...2', contractAddress: '0x...' }
 *   ]
 * })
 * ```
 */
export async function batchPublicDecrypt(
  client: FhevmClient,
  params: {
    instance?: FhevmInstance;
    requests: DecryptRequest[];
  }
): Promise<DecryptedResults> {
  const { instance, requests } = params;

  if (!requests || requests.length === 0) {
    throw new FhevmConfigError("At least one request is required for batch public decryption");
  }

  client.debug(`Batch public decrypting ${requests.length} handle(s)`);

  const results = await publicDecrypt(client, {
    instance,
    requests
  });

  client.debug(`Batch public decryption completed: ${Object.keys(results).length} value(s)`);

  return results;
}

/**
 * Helper: Create multiple decrypt requests for the same contract
 * 
 * @param contractAddress - Contract address
 * @param handles - Array of handles
 * @returns Array of decrypt requests
 * 
 * @example
 * ```ts
 * const requests = createDecryptRequests('0x...', [
 *   '0x...1', '0x...2', '0x...3'
 * ])
 * 
 * const results = await decrypt(client, { signer, requests })
 * ```
 */
export function createDecryptRequests(
  contractAddress: string,
  handles: string[]
): DecryptRequest[] {
  return handles.map(handle => ({
    handle,
    contractAddress
  }));
}

/**
 * Helper: Group decrypt results by contract address
 * 
 * @param results - Decrypted results
 * @param requests - Original requests
 * @returns Results grouped by contract address
 * 
 * @example
 * ```ts
 * const grouped = groupDecryptResultsByContract(results, requests)
 * // {
 * //   '0x...A': { '0x...1': 42n, '0x...2': true },
 * //   '0x...B': { '0x...3': 100n }
 * // }
 * ```
 */
export function groupDecryptResultsByContract(
  results: DecryptedResults,
  requests: DecryptRequest[]
): Record<string, DecryptedResults> {
  const grouped: Record<string, DecryptedResults> = {};

  for (const request of requests) {
    const { handle, contractAddress } = request;
    
    if (!grouped[contractAddress]) {
      grouped[contractAddress] = {};
    }
    
    if (handle in results) {
      grouped[contractAddress][handle] = results[handle];
    }
  }

  return grouped;
}

