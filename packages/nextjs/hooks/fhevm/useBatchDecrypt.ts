"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { 
  batchDecrypt,
  batchPublicDecrypt,
  type FhevmClient,
  type FhevmInstance, 
  type DecryptedResults, 
  type Signer, 
  type DecryptRequest 
} from "@fhevm-sdk";

/**
 * Hook options for batch decryption
 */
export interface UseBatchDecryptOptions {
  /** FHEVM instance (optional, will use client's cached instance if not provided) */
  instance?: FhevmInstance;
  /** Signer for user decryption (required for userDecrypt, not needed for publicDecrypt) */
  signer?: Signer;
  /** Decryption requests */
  requests?: DecryptRequest[];
  /** Use public decryption (no signature required) */
  usePublicDecrypt?: boolean;
}

/**
 * Hook to batch decrypt multiple handles
 * 
 * @param client - FHEVM client
 * @param options - Batch decryption options
 * @returns Batch decryption state and methods
 * 
 * @example
 * ```tsx
 * const { batchDecryptData, results, isDecrypting } = useBatchDecrypt(client, {
 *   instance,
 *   signer,
 *   requests: [
 *     { handle: '0x...1', contractAddress: '0x...A' },
 *     { handle: '0x...2', contractAddress: '0x...A' },
 *     { handle: '0x...3', contractAddress: '0x...B' }
 *   ]
 * })
 * 
 * await batchDecryptData()
 * // results = {
 * //   '0x...1': 42n,
 * //   '0x...2': true,
 * //   '0x...3': 100n
 * // }
 * ```
 */
export function useBatchDecrypt(
  client: FhevmClient | undefined,
  options: UseBatchDecryptOptions = {}
) {
  const { instance, signer, requests, usePublicDecrypt = false } = options;

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [results, setResults] = useState<DecryptedResults>({});
  const [error, setError] = useState<Error | undefined>(undefined);
  const [message, setMessage] = useState<string>("");

  const isDecryptingRef = useRef(false);

  const canDecrypt = useMemo(() => {
    if (!client || !instance || !requests || requests.length === 0 || isDecrypting) {
      return false;
    }

    // For user decrypt, signer is required
    if (!usePublicDecrypt && !signer) {
      return false;
    }

    return true;
  }, [client, instance, signer, requests, isDecrypting, usePublicDecrypt]);

  const batchDecryptData = useCallback(async () => {
    if (
      isDecryptingRef.current ||
      !client ||
      !instance ||
      !requests ||
      requests.length === 0
    ) {
      return;
    }

    // Validate signer for user decrypt
    if (!usePublicDecrypt && !signer) {
      setError(new Error("Signer is required for user decryption"));
      setMessage("Signer is required");
      return;
    }

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    setMessage(`Decrypting ${requests.length} handle(s)...`);
    setError(undefined);

    try {
      let decryptedResults: DecryptedResults;

      if (usePublicDecrypt) {
        // Public decryption (no signature required)
        decryptedResults = await batchPublicDecrypt(client, {
          instance,
          requests,
        });
      } else {
        // User decryption (requires signature)
        decryptedResults = await batchDecrypt(client, {
          instance,
          signer: signer!,
          requests,
        });
      }

      setResults(decryptedResults);
      setMessage(
        `Successfully decrypted ${Object.keys(decryptedResults).length} value(s)`
      );
    } catch (err) {
      const error = err as Error;
      setError(error);
      setMessage(`Decryption failed: ${error.message}`);
    } finally {
      isDecryptingRef.current = false;
      setIsDecrypting(false);
    }
  }, [client, instance, signer, requests, usePublicDecrypt]);

  const reset = useCallback(() => {
    setResults({});
    setError(undefined);
    setMessage("");
  }, []);

  return {
    batchDecryptData,
    decrypt: batchDecryptData, // Alias for consistency with useDecrypt
    results,
    isDecrypting,
    error,
    message,
    canDecrypt,
    reset,
    setMessage,
    setError,
    /** Number of handles being decrypted */
    requestCount: requests?.length ?? 0,
    /** Number of successfully decrypted values */
    resultCount: Object.keys(results).length,
  };
}

