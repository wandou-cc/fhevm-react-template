/**
 * TypeScript utility types for FHEVM SDK
 * Advanced type utilities and helpers
 */

import type { FhevmClient } from "./core/client";
import type { FhevmInstance } from "./fhevmTypes";

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties required recursively
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Pick properties that extend a certain type
 */
export type PickByType<T, U> = {
  [P in keyof T as T[P] extends U ? P : never]: T[P];
};

/**
 * Omit properties that extend a certain type
 */
export type OmitByType<T, U> = {
  [P in keyof T as T[P] extends U ? never : P]: T[P];
};

/**
 * Make specific keys required
 */
export type RequireKeys<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

/**
 * Make specific keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

/**
 * Extract promise type
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Extract array element type
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * Async function type
 */
export type AsyncFunction<Args extends any[] = any[], Result = any> = (
  ...args: Args
) => Promise<Result>;

/**
 * Function or value
 */
export type MaybeFunction<T, Args extends any[] = []> = T | ((...args: Args) => T);

/**
 * Awaitable type (can be value or promise)
 */
export type Awaitable<T> = T | Promise<T>;

/**
 * Nullable type
 */
export type Nullable<T> = T | null | undefined;

/**
 * Non-nullable type helper
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

/**
 * Readonly deep
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Mutable (remove readonly)
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Pretty print type (expand type aliases)
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Union to intersection
 */
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Tuple to union
 */
export type TupleToUnion<T extends readonly any[]> = T[number];

/**
 * Type guard helper
 */
export type TypeGuard<T> = (value: unknown) => value is T;

/**
 * Extract function return type
 */
export type ReturnTypeAsync<T extends AsyncFunction> = UnwrapPromise<ReturnType<T>>;

/**
 * Extract function parameters
 */
export type ParametersAsync<T extends AsyncFunction> = Parameters<T>;

// ============================================
// FHEVM-specific utility types
// ============================================

/**
 * Encrypted type marker
 */
export type Encrypted<T> = T & { __encrypted: true };

/**
 * Decrypted type marker
 */
export type Decrypted<T> = T & { __decrypted: true };

/**
 * FHEVM type names
 */
export type FhevmTypeName = 
  | 'bool'
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'uint64'
  | 'uint128'
  | 'uint256'
  | 'address';

/**
 * Map FHEVM type names to TypeScript types
 */
export type FhevmTypeMap = {
  bool: boolean;
  uint8: number;
  uint16: number;
  uint32: number;
  uint64: bigint;
  uint128: bigint;
  uint256: bigint;
  address: string;
};

/**
 * Get TypeScript type from FHEVM type name
 */
export type FhevmToTS<T extends FhevmTypeName> = FhevmTypeMap[T];

/**
 * Encrypt input builder methods
 */
export type EncryptBuilderMethod<T extends FhevmTypeName> = T extends 'bool'
  ? 'addBool'
  : T extends 'uint8'
  ? 'add8'
  : T extends 'uint16'
  ? 'add16'
  : T extends 'uint32'
  ? 'add32'
  : T extends 'uint64'
  ? 'add64'
  : T extends 'uint128'
  ? 'add128'
  : T extends 'uint256'
  ? 'add256'
  : T extends 'address'
  ? 'addAddress'
  : never;

/**
 * Contract method with encrypted params
 */
export interface EncryptedContractMethod<
  Params extends readonly FhevmTypeName[] = readonly FhevmTypeName[],
  ReturnType = any
> {
  (...args: { [K in keyof Params]: Encrypted<FhevmToTS<Params[K]>> }): Promise<ReturnType>;
}

/**
 * Typed decrypt request
 */
export interface TypedDecryptRequest<T extends FhevmTypeName = FhevmTypeName> {
  handle: string;
  contractAddress: string;
  type: T;
}

/**
 * Typed decrypt result
 */
export type TypedDecryptResult<T extends FhevmTypeName> = FhevmToTS<T>;

/**
 * Operation result wrapper
 */
export interface OperationResult<T, E = Error> {
  data?: T;
  error?: E;
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Create success result
 */
export function success<T>(data: T): OperationResult<T> {
  return {
    data,
    isSuccess: true,
    isError: false,
  };
}

/**
 * Create error result
 */
export function failure<E = Error>(error: E): OperationResult<never, E> {
  return {
    error,
    isSuccess: false,
    isError: true,
  };
}

/**
 * Client with instance required
 */
export type ClientWithInstance = FhevmClient & {
  instance: FhevmInstance;
};

/**
 * Check if client has instance
 */
export function hasInstance(client: FhevmClient): client is ClientWithInstance {
  return client.instance !== undefined;
}

/**
 * Extract event data type
 */
export type EventData<
  EventMap,
  EventName extends keyof EventMap
> = EventMap[EventName];

/**
 * Extract middleware context type
 */
export type MiddlewareContextType<T> = T extends { type: infer U } ? U : never;

/**
 * Type-safe plugin config
 */
export type PluginConfig<T = any> = T extends { config: infer C } ? C : any;

/**
 * Infer return type from operation
 */
export type InferOperationResult<T> = T extends (...args: any[]) => Promise<infer R>
  ? R
  : T extends Promise<infer R>
  ? R
  : T;

// ============================================
// Branded types for type safety
// ============================================

declare const __brand: unique symbol;

/**
 * Brand a type for nominal typing
 */
export type Brand<T, TBrand extends string> = T & {
  [__brand]: TBrand;
};

/**
 * Ethereum address (branded string)
 */
export type Address = Brand<string, 'Address'>;

/**
 * Hex string (branded string)
 */
export type HexString = Brand<string, 'HexString'>;

/**
 * Encrypted handle (branded string)
 */
export type EncryptedHandle = Brand<string, 'EncryptedHandle'>;

/**
 * Chain ID (branded number)
 */
export type ChainId = Brand<number, 'ChainId'>;

/**
 * Create branded address
 */
export function createAddress(address: string): Address {
  // Validation would go here
  return address as Address;
}

/**
 * Create branded hex string
 */
export function createHexString(hex: string): HexString {
  // Validation would go here
  return hex as HexString;
}

/**
 * Create branded encrypted handle
 */
export function createEncryptedHandle(handle: string): EncryptedHandle {
  return handle as EncryptedHandle;
}

/**
 * Create branded chain ID
 */
export function createChainId(chainId: number): ChainId {
  return chainId as ChainId;
}

