/**
 * Validation utilities
 * Centralized validation logic for better error messages
 */

import { FhevmConfigError } from "../errors";
import type { ClientConfig, DecryptRequest } from "../types";

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate client configuration
 */
export function validateClientConfig(config: ClientConfig): void {
  // Allow empty network for SSR scenarios (will be validated later when instance is created)
  if (config.network === null) {
    throw new FhevmConfigError("Network provider cannot be null");
  }

  // Only validate if network is provided
  if (config.network !== undefined && config.network !== null) {
    if (typeof config.network !== "string" && typeof config.network !== "object") {
      throw new FhevmConfigError(
        "Network must be a string (RPC URL) or EIP-1193 provider"
      );
    }
  }

  if (config.chainId !== undefined && typeof config.chainId !== "number") {
    throw new FhevmConfigError("Chain ID must be a number");
  }

  if (config.mockChains !== undefined && typeof config.mockChains !== "object") {
    throw new FhevmConfigError("Mock chains must be an object");
  }
}

/**
 * Validate decryption requests
 */
export function validateDecryptRequests(requests: DecryptRequest[]): void {
  if (!Array.isArray(requests)) {
    throw new FhevmConfigError("Requests must be an array");
  }

  if (requests.length === 0) {
    throw new FhevmConfigError("At least one request is required");
  }

  requests.forEach((req, index) => {
    if (!req.handle) {
      throw new FhevmConfigError(`Request ${index}: handle is required`);
    }

    if (!req.contractAddress) {
      throw new FhevmConfigError(`Request ${index}: contractAddress is required`);
    }

    if (!isValidAddress(req.contractAddress)) {
      throw new FhevmConfigError(
        `Request ${index}: invalid contract address ${req.contractAddress}`
      );
    }
  });
}

/**
 * Validate contract address
 */
export function validateContractAddress(address: string): void {
  if (!address) {
    throw new FhevmConfigError("Contract address is required");
  }

  if (!isValidAddress(address)) {
    throw new FhevmConfigError(`Invalid contract address: ${address}`);
  }
}

/**
 * Validate user address
 */
export function validateUserAddress(address: string): void {
  if (!address) {
    throw new FhevmConfigError("User address is required");
  }

  if (!isValidAddress(address)) {
    throw new FhevmConfigError(`Invalid user address: ${address}`);
  }
}

