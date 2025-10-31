"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createInstance, type CreateInstanceOptions, type FhevmClient, type FhevmInstance } from "@fhevm-sdk";

/**
 * Hook to create and manage FHEVM instance
 * 
 * @param client - FHEVM client
 * @param options - Instance creation options
 * @returns Instance state and methods
 */
export function useFhevmInstance(
  client: FhevmClient | undefined,
  options?: Omit<CreateInstanceOptions, 'signal'> & {
    enabled?: boolean;
  }
) {
  const { enabled = true, ...createOptions } = options || {};
  
  const [instance, setInstance] = useState<FhevmInstance | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<Error | undefined>(undefined);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCreatingRef = useRef(false);

  const createInstanceAsync = useCallback(async () => {
    if (!client || !enabled || isCreatingRef.current) return;

    // Check if already cached
    if (client.instance) {
      setInstance(client.instance);
      setStatus("success");
      return;
    }

    isCreatingRef.current = true;
    setStatus("loading");
    setError(undefined);

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const newInstance = await createInstance(client, {
        ...createOptions,
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        setInstance(newInstance);
        setStatus("success");
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err as Error);
        setStatus("error");
      }
    } finally {
      isCreatingRef.current = false;
    }
  }, [client, enabled, createOptions]);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setInstance(undefined);
      setError(undefined);
      return;
    }

    createInstanceAsync();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [createInstanceAsync, enabled]);

  const refetch = useCallback(() => {
    if (client) {
      client.clearInstance();
    }
    setInstance(undefined);
    createInstanceAsync();
  }, [client, createInstanceAsync]);

  return {
    instance,
    status,
    error,
    refetch,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
  };
}

