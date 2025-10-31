/**
 * ABI utilities for contract interaction
 */

import type { EncryptResult, EncryptedInputBuilder } from "../types";
import { toHex } from "./hex";
import { FhevmConfigError } from "../errors";

/**
 * Map ABI internal type to encryption method name
 */
export function getEncryptionMethod(
  internalType: string
): keyof EncryptedInputBuilder {
  const methodMap: Record<string, keyof EncryptedInputBuilder> = {
    externalEbool: "addBool",
    externalEuint8: "add8",
    externalEuint16: "add16",
    externalEuint32: "add32",
    externalEuint64: "add64",
    externalEuint128: "add128",
    externalEuint256: "add256",
    externalEaddress: "addAddress",
  };

  const method = methodMap[internalType];
  if (!method) {
    console.warn(
      `Unknown internalType: ${internalType}, defaulting to add64`
    );
    return "add64";
  }

  return method;
}

/**
 * Build contract parameters from encryption result and ABI
 */
export function buildParamsFromAbi(
  encryptResult: EncryptResult,
  abi: any[],
  functionName: string
): any[] {
  // Find function in ABI
  const fn = abi.find(
    (item: any) => item.type === "function" && item.name === functionName
  );

  if (!fn) {
    throw new FhevmConfigError(
      `Function "${functionName}" not found in ABI`
    );
  }

  if (!fn.inputs || fn.inputs.length === 0) {
    throw new FhevmConfigError(
      `Function "${functionName}" has no inputs`
    );
  }

  // Build parameters based on input types
  return fn.inputs.map((input: any, index: number) => {
    // First param is usually the encrypted handle, rest is the proof
    const raw = index === 0 ? encryptResult.handles[0] : encryptResult.inputProof;

    switch (input.type) {
      case "bytes32":
      case "bytes":
        return toHex(raw);

      case "uint256":
        // For uint256, convert to bigint
        return BigInt(raw as any);

      case "address":
        return toHex(raw);

      case "string":
        return String(raw);

      case "bool":
        return Boolean(raw);

      default:
        // Default to hex for unknown types
        console.warn(
          `Unknown ABI param type "${input.type}" for input ${index}, converting to hex`
        );
        return toHex(raw);
    }
  });
}

/**
 * Extract function signature from ABI
 */
export function getFunctionSignature(
  abi: any[],
  functionName: string
): string {
  const fn = abi.find(
    (item: any) => item.type === "function" && item.name === functionName
  );

  if (!fn) {
    throw new FhevmConfigError(
      `Function "${functionName}" not found in ABI`
    );
  }

  const inputs = fn.inputs
    .map((input: any) => input.type)
    .join(",");

  return `${functionName}(${inputs})`;
}

