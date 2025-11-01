/**
 * Testing utilities for FHEVM SDK
 * Provides mocks and test helpers
 */

import type { 
  Storage, 
  Signer, 
  NetworkProvider, 
  ClientConfig,
  DecryptRequest,
  DecryptedResults,
  EncryptResult,
  EncryptedInputBuilder
} from "./types";
import type { FhevmInstance } from "./fhevmTypes";
import { FhevmClient } from "./core/client";

/**
 * Mock storage implementation
 */
export class MockStorage implements Storage {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Clear all items (test helper)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get all items (test helper)
   */
  getAll(): Record<string, string> {
    return Object.fromEntries(this.store.entries());
  }
}

/**
 * Mock signer implementation
 */
export class MockSigner implements Signer {
  constructor(private address: string = '0x1234567890123456789012345678901234567890') {}

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signTypedData(domain: any, types: any, message: any): Promise<string> {
    // Return mock signature
    return '0x' + 'ab'.repeat(65);
  }
}

/**
 * Mock network provider implementation
 */
export class MockNetworkProvider {
  private responses = new Map<string, any>();

  async request(args: { method: string; params?: any[] }): Promise<any> {
    const response = this.responses.get(args.method);
    
    if (response instanceof Error) {
      throw response;
    }
    
    if (response !== undefined) {
      return typeof response === 'function' ? response(args.params) : response;
    }

    // Default responses
    switch (args.method) {
      case 'eth_chainId':
        return '0x1f49'; // 8009
      case 'eth_accounts':
        return ['0x1234567890123456789012345678901234567890'];
      case 'eth_requestAccounts':
        return ['0x1234567890123456789012345678901234567890'];
      default:
        throw new Error(`Unhandled method: ${args.method}`);
    }
  }

  /**
   * Set mock response for a method
   */
  mockResponse(method: string, response: any): this {
    this.responses.set(method, response);
    return this;
  }

  /**
   * Set mock error for a method
   */
  mockError(method: string, error: Error): this {
    this.responses.set(method, error);
    return this;
  }

  /**
   * Clear all mocks
   */
  clearMocks(): void {
    this.responses.clear();
  }
}

/**
 * Mock encrypted input builder
 */
export class MockEncryptedInputBuilder implements EncryptedInputBuilder {
  private values: Array<{ type: string; value: any }> = [];

  addBool(value: boolean): this {
    this.values.push({ type: 'bool', value });
    return this;
  }

  add8(value: number | bigint): this {
    this.values.push({ type: 'uint8', value });
    return this;
  }

  add16(value: number | bigint): this {
    this.values.push({ type: 'uint16', value });
    return this;
  }

  add32(value: number | bigint): this {
    this.values.push({ type: 'uint32', value });
    return this;
  }

  add64(value: number | bigint): this {
    this.values.push({ type: 'uint64', value });
    return this;
  }

  add128(value: bigint): this {
    this.values.push({ type: 'uint128', value });
    return this;
  }

  add256(value: bigint): this {
    this.values.push({ type: 'uint256', value });
    return this;
  }

  addAddress(value: string): this {
    this.values.push({ type: 'address', value });
    return this;
  }

  async encrypt(): Promise<EncryptResult> {
    // Generate mock encrypted data
    const handles = this.values.map(() => 
      new Uint8Array(32).fill(Math.floor(Math.random() * 256))
    );

    const inputProof = new Uint8Array(64).fill(0);

    return { handles, inputProof };
  }

  /**
   * Get added values (test helper)
   */
  getValues(): Array<{ type: string; value: any }> {
    return this.values;
  }
}

/**
 * Mock FHEVM instance
 */
export class MockFhevmInstance {
  createEncryptedInput(
    contractAddress: string,
    userAddress: string
  ): any {
    return new MockEncryptedInputBuilder();
  }

  async userDecrypt(
    requests: any[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number | string,
    durationDays: number | string
  ): Promise<DecryptedResults> {
    // Return mock decrypted values
    const results: DecryptedResults = {};
    
    requests.forEach((req: any, index: number) => {
      const handle = typeof req === 'string' ? req : req.handle;
      results[handle] = BigInt(index + 1);
    });

    return results;
  }

  async publicDecrypt(
    requests: any[]
  ): Promise<DecryptedResults> {
    const results: DecryptedResults = {};
    
    requests.forEach((req: any, index: number) => {
      const handle = typeof req === 'string' ? req : req.handle;
      results[handle] = BigInt(index + 1);
    });

    return results;
  }
}

/**
 * Create a mock FHEVM client for testing
 */
export function createMockClient(overrides?: Partial<ClientConfig>): FhevmClient {
  const config: ClientConfig = {
    network: new MockNetworkProvider(),
    chainId: 8009,
    storage: new MockStorage(),
    debug: false,
    ...overrides,
  };

  const client = new FhevmClient(config);
  
  // Inject mock instance
  client.setInstance(new MockFhevmInstance() as any);

  return client;
}

/**
 * Wait helper for tests
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Batch wait helper
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Test spy for tracking function calls
 */
export class Spy<T extends (...args: any[]) => any = (...args: any[]) => any> {
  private calls: Array<{ args: Parameters<T>; result?: ReturnType<T>; error?: Error }> = [];

  /**
   * Create a spy function
   */
  create(implementation?: T): T {
    const spy = ((...args: Parameters<T>) => {
      try {
        const result = implementation ? implementation(...args) : undefined;
        this.calls.push({ args, result });
        return result;
      } catch (error) {
        this.calls.push({ args, error: error as Error });
        throw error;
      }
    }) as T;

    return spy;
  }

  /**
   * Get call count
   */
  get callCount(): number {
    return this.calls.length;
  }

  /**
   * Get all calls
   */
  getCalls(): Array<{ args: Parameters<T>; result?: ReturnType<T>; error?: Error }> {
    return this.calls;
  }

  /**
   * Get call at index
   */
  getCall(index: number): { args: Parameters<T>; result?: ReturnType<T>; error?: Error } | undefined {
    return this.calls[index];
  }

  /**
   * Check if called with specific args
   */
  calledWith(...args: Parameters<T>): boolean {
    return this.calls.some(call => 
      JSON.stringify(call.args) === JSON.stringify(args)
    );
  }

  /**
   * Reset spy
   */
  reset(): void {
    this.calls = [];
  }
}

/**
 * Create a spy
 */
export function createSpy<T extends (...args: any[]) => any = (...args: any[]) => any>(
  implementation?: T
): { fn: T; spy: Spy<T> } {
  const spy = new Spy<T>();
  const fn = spy.create(implementation);
  return { fn, spy };
}

/**
 * Assert helper
 */
export const assert = {
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected} but got ${actual}`);
    }
  },

  deepEqual(actual: any, expected: any, message?: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
      );
    }
  },

  throws(fn: () => any, errorMessage?: string): void {
    let thrown = false;
    try {
      fn();
    } catch (error) {
      thrown = true;
      if (errorMessage && !(error as Error).message.includes(errorMessage)) {
        throw new Error(
          `Expected error message to include "${errorMessage}" but got "${(error as Error).message}"`
        );
      }
    }
    if (!thrown) {
      throw new Error('Expected function to throw but it did not');
    }
  },

  async rejects(
    fn: () => Promise<any>,
    errorMessage?: string
  ): Promise<void> {
    let thrown = false;
    try {
      await fn();
    } catch (error) {
      thrown = true;
      if (errorMessage && !(error as Error).message.includes(errorMessage)) {
        throw new Error(
          `Expected error message to include "${errorMessage}" but got "${(error as Error).message}"`
        );
      }
    }
    if (!thrown) {
      throw new Error('Expected function to reject but it did not');
    }
  },
};

/**
 * Test suite helper
 */
export function describe(name: string, fn: () => void): void {
  console.log(`\n${name}`);
  fn();
}

/**
 * Test case helper
 */
export async function it(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(error as Error).message}`);
    throw error;
  }
}

