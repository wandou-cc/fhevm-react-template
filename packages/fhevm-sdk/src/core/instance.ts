/**
 * Instance management - Create and manage FHEVM instances
 * High cohesion: All instance-related logic in one place
 */

import type { FhevmInstance } from "../fhevmTypes";
import type { FhevmClient } from "./client";
import type { InstanceStatus } from "../types";
import { FhevmInstanceError, FhevmAbortError } from "../errors";
import { createFhevmInstance } from "../internal/fhevm";

/**
 * Options for instance creation
 */
export interface CreateInstanceOptions {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Status change callback */
  onStatusChange?: (status: InstanceStatus) => void;
  /** Force recreate instance even if cached */
  force?: boolean;
}

/**
 * Create an FHEVM instance
 * 
 * @param client - FHEVM client
 * @param options - Creation options
 * @returns FHEVM instance
 * 
 * @example
 * ```ts
 * import { createFhevmClient, createInstance } from 'fhevm-sdk'
 * 
 * const client = createFhevmClient({ network: provider })
 * const instance = await createInstance(client)
 * ```
 */
export async function createInstance(
  client: FhevmClient,
  options: CreateInstanceOptions = {}
): Promise<FhevmInstance> {
  const { signal, onStatusChange, force = false } = options;

  // Return cached instance if available and not forcing
  if (!force && client.instance) {
    client.debug("Using cached FHEVM instance");
    return client.instance;
  }

  // Validate network before creating instance
  if (!client.config.network) {
    throw new FhevmInstanceError(
      "Network provider is required. Please provide a network when creating the client."
    );
  }

  client.debug("Creating new FHEVM instance");

  // Check if already aborted
  if (signal?.aborted) {
    throw new FhevmAbortError();
  }

  try {
    // Create instance using internal implementation
    const instance = await createFhevmInstance({
      provider: client.config.network,
      mockChains: client.config.mockChains,
      signal: signal ?? new AbortController().signal,
      onStatusChange: (status) => {
        client.debug(`Instance status: ${status}`);
        onStatusChange?.(status as InstanceStatus);
      },
    });

    // Cache instance on client
    client.setInstance(instance);

    client.debug("FHEVM instance created successfully");

    return instance;
  } catch (error: any) {
    // Check if it was aborted
    if (signal?.aborted || error?.name === "AbortError") {
      throw new FhevmAbortError();
    }

    // Wrap error in FhevmInstanceError
    throw new FhevmInstanceError(
      `Failed to create FHEVM instance: ${error?.message || "Unknown error"}`,
      error
    );
  }
}

/**
 * Get cached instance from client
 * 
 * @param client - FHEVM client
 * @returns FHEVM instance or undefined
 */
export function getInstance(client: FhevmClient): FhevmInstance | undefined {
  return client.instance;
}

/**
 * Clear cached instance from client
 * 
 * @param client - FHEVM client
 */
export function clearInstance(client: FhevmClient): void {
  client.clearInstance();
  client.debug("Instance cache cleared");
}

/**
 * Ensure instance exists, create if needed
 * 
 * @param client - FHEVM client
 * @param options - Creation options
 * @returns FHEVM instance
 * 
 * @example
 * ```ts
 * // Automatically creates instance if not cached
 * const instance = await ensureInstance(client)
 * ```
 */
export async function ensureInstance(
  client: FhevmClient,
  options: CreateInstanceOptions = {}
): Promise<FhevmInstance> {
  return client.instance ?? await createInstance(client, options);
}

