"use client";

import { useMemo } from "react";
import { createFhevmClient, type FhevmClient, type ClientConfig } from "@fhevm-sdk";

/**
 * Hook to create and memoize FHEVM client
 * 
 * @param config - Client configuration
 * @returns FHEVM client
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const client = useFhevmClient({
 *     network: window.ethereum,
 *     chainId: 8009
 *   })
 * }
 * ```
 */
export function useFhevmClient(config: ClientConfig): FhevmClient {
  return useMemo(() => {
    // Allow creating client with undefined network for SSR compatibility
    // Network will be validated when instance is created
    const safeConfig: ClientConfig = {
      ...config,
      network: config.network ?? undefined,
    };
    return createFhevmClient(safeConfig);
  }, [
    config.network,
    config.chainId,
    config.storage,
    config.debug,
    JSON.stringify(config.mockChains)
  ]);
}

