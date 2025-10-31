"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { 
  decrypt,
  type FhevmClient,
  type FhevmInstance, 
  type DecryptedResults, 
  type Signer, 
  type DecryptRequest 
} from "@fhevm-sdk";

/**
 * Hook to decrypt handles
 */
export function useDecrypt(
  client: FhevmClient | undefined,
  params: {
    instance?: FhevmInstance;
    signer?: Signer;
    requests?: DecryptRequest[];
  }
) {
  const { instance, signer, requests } = params;

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [results, setResults] = useState<DecryptedResults>({});
  const [error, setError] = useState<Error | undefined>(undefined);
  const [message, setMessage] = useState<string>("");

  const isDecryptingRef = useRef(false);

  const canDecrypt = useMemo(() => {
    return Boolean(
      client &&
      instance &&
      signer &&
      requests &&
      requests.length > 0 &&
      !isDecrypting
    );
  }, [client, instance, signer, requests, isDecrypting]);

  const decryptData = useCallback(async () => {
    if (isDecryptingRef.current || !client || !instance || !signer || !requests || requests.length === 0) {
      return;
    }

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    setMessage("Starting decryption...");
    setError(undefined);

    try {
      const decryptedResults = await decrypt(client, {
        instance,
        signer,
        requests,
      });

      setResults(decryptedResults);
      setMessage("Decryption completed!");
    } catch (err) {
      setError(err as Error);
      setMessage("Decryption failed");
    } finally {
      isDecryptingRef.current = false;
      setIsDecrypting(false);
    }
  }, [client, instance, signer, requests]);

  const reset = useCallback(() => {
    setResults({});
    setError(undefined);
    setMessage("");
  }, []);

  return {
    decryptData,
    decrypt: decryptData,
    results,
    isDecrypting,
    error,
    message,
    canDecrypt,
    reset,
    setMessage,
    setError,
  };
}

