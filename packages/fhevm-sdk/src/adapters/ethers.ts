import type { Signer } from "../types";

/**
 * Ethers adapter for FHEVM SDK
 * Converts ethers JsonRpcSigner to FhevmSigner
 */

/**
 * Convert an ethers JsonRpcSigner to FhevmSigner
 * 
 * @param signer - Ethers JsonRpcSigner
 * @returns FhevmSigner interface
 * 
 * @example
 * ```ts
 * import { BrowserProvider } from 'ethers'
 * import { toFhevmSigner } from 'fhevm-sdk/adapters/ethers'
 * 
 * const provider = new BrowserProvider(window.ethereum)
 * const signer = await provider.getSigner()
 * const fhevmSigner = toFhevmSigner(signer)
 * ```
 */
export function toFhevmSigner(signer: any): Signer {
  return {
    async getAddress() {
      return await signer.getAddress();
    },
    async signTypedData(domain: any, types: any, message: any) {
      return await signer.signTypedData(domain, types, message);
    },
  };
}

/**
 * Convert an EIP-1193 provider to a provider string or object
 * 
 * @param provider - EIP-1193 provider or RPC URL
 * @returns Provider suitable for FHEVM
 */
export function toFhevmProvider(provider: any): any {
  return provider;
}

