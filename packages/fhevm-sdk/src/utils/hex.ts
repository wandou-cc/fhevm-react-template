/**
 * Hex conversion utilities
 */

/**
 * Convert Uint8Array to hex string
 */
export function uint8ArrayToHex(value: Uint8Array): `0x${string}` {
  const hex = Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}` as `0x${string}`;
}

/**
 * Convert string to hex string (if not already hex)
 */
export function stringToHex(value: string): `0x${string}` {
  if (value.startsWith("0x")) {
    return value as `0x${string}`;
  }
  return `0x${value}` as `0x${string}`;
}

/**
 * Convert Uint8Array or string to hex string
 */
export function toHex(value: Uint8Array | string): `0x${string}` {
  if (typeof value === "string") {
    return stringToHex(value);
  }
  return uint8ArrayToHex(value);
}

/**
 * Check if a string is valid hex
 */
export function isHex(value: string): boolean {
  return /^0x[a-fA-F0-9]*$/.test(value);
}

