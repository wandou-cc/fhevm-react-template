/**
 * Decryption operations - Decrypt FHEVM handles
 * High cohesion: All decryption logic in one place
 */

import type { FhevmClient } from "./client";
import type { FhevmInstance, DecryptedResults } from "../fhevmTypes";
import type { Signer, DecryptRequest } from "../types";
import { 
  FhevmDecryptionError, 
  FhevmConfigError,
  FhevmSignatureError
} from "../errors";
import { validateDecryptRequests } from "../utils/validation";
import { FhevmDecryptionSignature } from "../FhevmDecryptionSignature";

/**
 * Decryption parameters
 */
export interface DecryptParams {
  /** FHEVM instance (optional if client has cached instance) */
  instance?: FhevmInstance;
  /** Signer for EIP-712 signature */
  signer: Signer;
  /** Decryption requests */
  requests: DecryptRequest[];
}

/**
 * Decrypt encrypted handles (userDecrypt with EIP-712 signature)
 * 
 * @param client - FHEVM client
 * @param params - Decryption parameters
 * @returns Decrypted values mapped by handle
 * 
 * @example
 * ```ts
 * import { createFhevmClient, createInstance, decrypt } from 'fhevm-sdk'
 * import { toFhevmSigner } from 'fhevm-sdk/adapters/ethers'
 * 
 * const client = createFhevmClient({ network: provider })
 * const instance = await createInstance(client)
 * 
 * const results = await decrypt(client, {
 *   instance,
 *   signer: toFhevmSigner(ethersSigner),
 *   requests: [
 *     { handle: '0x...', contractAddress: '0x...' }
 *   ]
 * })
 * 
 * console.log(results['0x...']) // decrypted value
 * ```
 */
export async function decrypt(
  client: FhevmClient,
  params: DecryptParams
): Promise<DecryptedResults> {
  const { signer, requests } = params;
  const startTime = Date.now();

  // Emit start event
  client.events.emit('decrypt:start', {
    requests,
    timestamp: startTime,
  });

  // Execute with middleware
  try {
    const results = await client.middleware.decrypt.execute(
      {
        type: 'decrypt',
        client,
        requestCount: requests.length,
        timestamp: startTime,
      },
      async () => {
        // Get instance from params or client cache
        const instance = params.instance ?? client.instance;

        if (!instance) {
          throw new FhevmConfigError(
            "FHEVM instance is required. Create one using createInstance() first."
          );
        }

        if (!signer) {
          throw new FhevmConfigError("Signer is required for decryption");
        }

        // Validate requests
        validateDecryptRequests(requests);

        client.debug(`Decrypting ${requests.length} handle(s)`);

        // Get unique contract addresses
        const uniqueAddresses = Array.from(
          new Set(requests.map((r) => r.contractAddress))
        ) as `0x${string}`[];

        client.debug(`Unique contracts: ${uniqueAddresses.length}`);

        // Load or create decryption signature
        client.debug("Creating/loading decryption signature");
        
        const signature = await FhevmDecryptionSignature.loadOrSign(
          instance,
          uniqueAddresses,
          signer as any, // Cast to internal type
          client.storage
        );

        if (!signature) {
          throw new FhevmSignatureError("Failed to create decryption signature");
        }

        client.debug("Signature obtained, performing userDecrypt");

        // Perform userDecrypt
        const results = await instance.userDecrypt(
          requests.map((r) => ({
            handle: r.handle,
            contractAddress: r.contractAddress as `0x${string}`,
          })),
          signature.privateKey,
          signature.publicKey,
          signature.signature,
          signature.contractAddresses,
          signature.userAddress,
          signature.startTimestamp,
          signature.durationDays
        );

        client.debug(`Decryption successful: ${Object.keys(results).length} value(s)`);

        return results;
      }
    );

    // Emit success event
    client.events.emit('decrypt:success', {
      results,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
    });

    return results;
  } catch (error: any) {
    // Emit error event
    client.events.emit('decrypt:error', {
      error,
      timestamp: Date.now(),
    });

    client.events.emit('error', {
      error,
      context: { type: 'decrypt', requestCount: requests.length },
      timestamp: Date.now(),
    });

    // Check for signature errors
    if (error.message?.includes("signature") || error.message?.includes("sign")) {
      throw new FhevmSignatureError(
        `Signature error: ${error?.message || "Unknown error"}`,
        error
      );
    }

    throw new FhevmDecryptionError(
      `Decryption failed: ${error?.message || "Unknown error"}`,
      error
    );
  }
}

/**
 * Public decrypt (no signature required)
 * For handles that are publicly accessible
 * 
 * @param client - FHEVM client
 * @param params - Decryption parameters without signer
 * @returns Decrypted values
 * 
 * @example
 * ```ts
 * const results = await publicDecrypt(client, {
 *   instance,
 *   requests: [{ handle: '0x...', contractAddress: '0x...' }]
 * })
 * ```
 */
export async function publicDecrypt(
  client: FhevmClient,
  params: {
    instance?: FhevmInstance;
    requests: DecryptRequest[];
  }
): Promise<DecryptedResults> {
  const { requests } = params;

  // Get instance from params or client cache
  const instance = params.instance ?? client.instance;

  if (!instance) {
    throw new FhevmConfigError(
      "FHEVM instance is required. Create one using createInstance() first."
    );
  }

  // Validate requests
  validateDecryptRequests(requests);

  client.debug(`Public decrypting ${requests.length} handle(s)`);

  // Check if publicDecrypt is available
  if (typeof (instance as any).publicDecrypt !== "function") {
    throw new FhevmDecryptionError(
      "Public decryption is not supported by this FHEVM instance"
    );
  }

  try {
    const results = await (instance as any).publicDecrypt(
      requests.map((r) => ({
        handle: r.handle,
        contractAddress: r.contractAddress,
      }))
    );

    client.debug(`Public decryption successful: ${Object.keys(results).length} value(s)`);

    return results;
  } catch (error: any) {
    throw new FhevmDecryptionError(
      `Public decryption failed: ${error?.message || "Unknown error"}`,
      error
    );
  }
}

