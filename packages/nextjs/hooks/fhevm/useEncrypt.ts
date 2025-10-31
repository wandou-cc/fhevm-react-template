"use client";

import { useCallback, useMemo } from "react";
import { 
  encrypt,
  type FhevmClient,
  type FhevmInstance, 
  type Signer, 
  type EncryptResult, 
  type EncryptedInputBuilder,
  getEncryptionMethod, 
  buildParamsFromAbi, 
  toHex 
} from "@fhevm-sdk";

/**
 * Hook to encrypt data
 */
export function useEncrypt(
  client: FhevmClient | undefined,
  params: {
    instance?: FhevmInstance;
    signer?: Signer;
    contractAddress?: string;
    userAddress?: string;
  }
) {
  const { instance, signer, contractAddress, userAddress } = params;

  const canEncrypt = useMemo(() => {
    return Boolean(client && instance && contractAddress && userAddress);
  }, [client, instance, contractAddress, userAddress]);

  const encryptData = useCallback(
    async (
      buildInputs: (builder: EncryptedInputBuilder) => void | Promise<void>
    ): Promise<EncryptResult | undefined> => {
      if (!client || !instance || !contractAddress || !userAddress) {
        return undefined;
      }

      return await encrypt(client, {
        instance,
        contractAddress,
        userAddress,
        buildInputs,
      });
    },
    [client, instance, contractAddress, userAddress]
  );

  return {
    encryptData,
    encrypt: encryptData,
    canEncrypt,
    getEncryptionMethod,
    buildParamsFromAbi,
    toHex,
  };
}

