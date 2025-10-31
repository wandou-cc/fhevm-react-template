"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeployedContractInfo } from "../helper";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { useFhevmClient, useFhevmInstance, useEncrypt, useDecrypt, useBatchDecrypt } from "~~/hooks/fhevm";
import { toFhevmSigner, getEncryptionMethod, buildParamsFromAbi, GenericStringInMemoryStorage } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";
import { useReadContract } from "wagmi";

/**
 * useFHECounterWagmi - Minimal FHE Counter hook adapted for new SDK
 */
export const useFHECounterWagmi = (parameters: {
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { initialMockChains } = parameters;

  // Wagmi + ethers interop
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  // Create FHEVM client (using new SDK)
  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  // Determine network: prefer provider, fallback to mock chain RPC URL
  const network = useMemo(() => {
    if (provider) return provider;
    if (chainId && initialMockChains?.[chainId]) {
      return initialMockChains[chainId];
    }
    return undefined; // Will be validated when instance is created
  }, [provider, chainId, initialMockChains]);

  const client = useFhevmClient({
    network,
    chainId,
    mockChains: initialMockChains as Record<number, string>,
    storage: new GenericStringInMemoryStorage(),
  });

  // Create FHEVM instance (using new SDK)
  // Only create instance when network is available
  const { instance, status: fhevmStatus } = useFhevmInstance(client, {
    enabled: Boolean(network && chainId),
  });

  // Resolve deployed contract info
  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: fheCounter } = useDeployedContractInfo({ contractName: "FHECounter", chainId: allowedChainId });

  const [message, setMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  type FHECounterInfo = Contract<"FHECounter"> & { chainId?: number };

  const isRefreshing = false as unknown as boolean;

  // Helpers
  const hasContract = Boolean(fheCounter?.address && fheCounter?.abi);
  const hasProvider = Boolean(ethersReadonlyProvider);
  const hasSigner = Boolean(ethersSigner);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(
      fheCounter!.address,
      (fheCounter as FHECounterInfo).abi,
      providerOrSigner,
    );
  };

  // Read count handle via wagmi
  const readResult = useReadContract({
    address: (hasContract ? (fheCounter!.address as unknown as `0x${string}`) : undefined) as
      | `0x${string}`
      | undefined,
    abi: (hasContract ? ((fheCounter as FHECounterInfo).abi as any) : undefined) as any,
    functionName: "getCount" as const,
    query: {
      enabled: Boolean(hasContract && hasProvider),
      refetchOnWindowFocus: false,
    },
  });

  const countHandle = useMemo(() => (readResult.data as string | undefined) ?? undefined, [readResult.data]);
  const canGetCount = Boolean(hasContract && hasProvider && !readResult.isFetching);
  
  const refreshCountHandle = useCallback(async () => {
    const res = await readResult.refetch();
    if (res.error) setMessage("FHECounter.getCount() failed: " + (res.error as Error).message);
  }, [readResult]);

  // Decrypt using new SDK
  const fhevmSigner = useMemo(() => {
    return ethersSigner ? toFhevmSigner(ethersSigner) : undefined;
  }, [ethersSigner]);

  const requests = useMemo(() => {
    if (!hasContract || !countHandle || countHandle === ethers.ZeroHash) return undefined;
    return [{ handle: countHandle, contractAddress: fheCounter!.address }];
  }, [hasContract, fheCounter?.address, countHandle]);

  // Single decrypt (for backward compatibility)
  const { 
    decryptData, 
    results, 
    isDecrypting, 
    message: decMsg,
    canDecrypt 
  } = useDecrypt(client, {
    instance,
    signer: fhevmSigner,
    requests,
  });

  // Batch decrypt (can decrypt multiple handles at once)
  const {
    batchDecryptData,
    results: batchResults,
    isDecrypting: isBatchDecrypting,
    message: batchDecMsg,
    canDecrypt: canBatchDecrypt,
    requestCount: batchRequestCount,
    resultCount: batchResultCount,
  } = useBatchDecrypt(client, {
    instance,
    signer: fhevmSigner,
    requests,
    usePublicDecrypt: false, // Set to true for public decryption (no signature)
  });

  // Update message from either decrypt method
  useEffect(() => {
    if (decMsg) setMessage(decMsg);
    if (batchDecMsg && Object.keys(batchResults).length > 0) setMessage(batchDecMsg);
  }, [decMsg, batchDecMsg, batchResults]);

  // Use batch decrypt results if available, otherwise fall back to single decrypt
  const activeResults = useMemo(() => {
    return Object.keys(batchResults).length > 0 ? batchResults : results;
  }, [batchResults, results]);

  const clearCount = useMemo(() => {
    if (!countHandle) return undefined;
    if (countHandle === ethers.ZeroHash) return { handle: countHandle, clear: BigInt(0) } as const;
    const clear = activeResults[countHandle];
    if (typeof clear === "undefined") return undefined;
    return { handle: countHandle, clear } as const;
  }, [countHandle, activeResults]);

  const isDecrypted = Boolean(countHandle && clearCount?.handle === countHandle);
  // Provide both single and batch decrypt functions
  const decryptCountHandle = decryptData;
  const batchDecryptCountHandle = batchDecryptData;

  // Encrypt using new SDK
  const userAddress = useMemo(() => {
    return ethersSigner ? ethersSigner.address : undefined;
  }, [ethersSigner]);

  const { encryptData } = useEncrypt(client, {
    instance,
    signer: fhevmSigner,
    contractAddress: fheCounter?.address,
    userAddress,
  });

  const canUpdateCounter = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isProcessing),
    [hasContract, instance, hasSigner, isProcessing],
  );

  const getEncryptionMethodFor = (functionName: "increment" | "decrement") => {
    const functionAbi = fheCounter?.abi.find(item => item.type === "function" && item.name === functionName);
    if (!functionAbi) return { method: undefined as string | undefined, error: `Function ABI not found for ${functionName}` } as const;
    if (!functionAbi.inputs || functionAbi.inputs.length === 0)
      return { method: undefined as string | undefined, error: `No inputs found for ${functionName}` } as const;
    const firstInput = functionAbi.inputs[0]!;
    return { method: getEncryptionMethod(firstInput.internalType), error: undefined } as const;
  };

  const updateCounter = useCallback(
    async (value: number) => {
      if (isProcessing || !canUpdateCounter || value === 0) return;
      const op = value > 0 ? "increment" : "decrement";
      const valueAbs = Math.abs(value);
      setIsProcessing(true);
      setMessage(`Starting ${op}(${valueAbs})...`);
      
      try {
        const { method, error } = getEncryptionMethodFor(op);
        if (!method) return setMessage(error ?? "Encryption method not found");

        setMessage(`Encrypting with ${method}...`);
        
        const enc = await encryptData((builder: any) => {
          builder[method](valueAbs);
        });
        
        if (!enc) return setMessage("Encryption failed");

        const writeContract = getContract("write");
        if (!writeContract) return setMessage("Contract info or signer not available");

        const params = buildParamsFromAbi(enc, [...fheCounter!.abi] as any[], op);
        const tx = await (op === "increment" ? writeContract.increment(...params) : writeContract.decrement(...params));
        setMessage("Waiting for transaction...");
        await tx.wait();
        setMessage(`${op}(${valueAbs}) completed!`);
        refreshCountHandle();
      } catch (e) {
        setMessage(`${op} failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canUpdateCounter, encryptData, getContract, refreshCountHandle, fheCounter?.abi],
  );

  return {
    contractAddress: fheCounter?.address,
    canDecrypt,
    canGetCount,
    canUpdateCounter,
    updateCounter,
    decryptCountHandle,
    batchDecryptCountHandle, // Batch decrypt function
    refreshCountHandle,
    isDecrypted,
    message,
    clear: clearCount?.clear,
    handle: countHandle,
    isDecrypting: isDecrypting || isBatchDecrypting, // Combined decrypting state
    isRefreshing,
    isProcessing,
    fhevmStatus,
    instance,
    // Batch decrypt info
    batchRequestCount,
    batchResultCount,
    canBatchDecrypt,
    // Wagmi-specific values
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};
