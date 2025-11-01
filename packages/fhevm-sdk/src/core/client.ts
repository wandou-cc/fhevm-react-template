/**
 * FHEVM Client - Core client implementation
 * High cohesion, low coupling design
 */

import type { FhevmInstance } from "../fhevmTypes";
import type { ClientConfig, Storage } from "../types";
import { validateClientConfig } from "../utils/validation";
import { GenericStringInMemoryStorage } from "../storage/GenericStringStorage";
import { FhevmEventEmitter } from "../events";
import { MiddlewareChain } from "../middleware";
import { PluginManager } from "../plugin";
import type { FhevmPlugin } from "../plugin";

/**
 * FHEVM Client
 * Central configuration and state management
 */
export class FhevmClient {
  private _config: ClientConfig;
  private _storage: Storage;
  private _instance?: FhevmInstance;
  private _events: FhevmEventEmitter;
  private _middleware: {
    encrypt: MiddlewareChain;
    decrypt: MiddlewareChain;
  };
  private _plugins: PluginManager;

  constructor(config: ClientConfig) {
    // Validate configuration (allow undefined network for SSR)
    validateClientConfig(config);

    this._config = config;
    this._storage = config.storage ?? new GenericStringInMemoryStorage();
    this._events = new FhevmEventEmitter();
    this._middleware = {
      encrypt: new MiddlewareChain(),
      decrypt: new MiddlewareChain(),
    };
    this._plugins = new PluginManager({
      client: this,
      events: this._events,
      middleware: this._middleware,
    });
  }

  /**
   * Get client configuration
   */
  get config(): ClientConfig {
    return this._config;
  }

  /**
   * Get storage adapter
   */
  get storage(): Storage {
    return this._storage;
  }

  /**
   * Get cached instance (if any)
   */
  get instance(): FhevmInstance | undefined {
    return this._instance;
  }

  /**
   * Get event emitter
   */
  get events(): FhevmEventEmitter {
    return this._events;
  }

  /**
   * Get middleware chains
   */
  get middleware() {
    return this._middleware;
  }

  /**
   * Get plugin manager
   */
  get plugins(): PluginManager {
    return this._plugins;
  }

  /**
   * Set instance (used internally by createInstance)
   * @internal
   */
  setInstance(instance: FhevmInstance): void {
    this._instance = instance;
  }

  /**
   * Clear cached instance
   */
  clearInstance(): void {
    this._instance = undefined;
    this._events.emit('cache:clear', { timestamp: Date.now() });
  }

  /**
   * Check if debug mode is enabled
   */
  isDebug(): boolean {
    return this._config.debug === true;
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    if (this.isDebug()) {
      console.log(`[FHEVM SDK] ${message}`, ...args);
      this._events.emit('debug', { message, data: args, timestamp: Date.now() });
    }
  }

  /**
   * Use a plugin
   */
  async use(plugin: FhevmPlugin, config?: any): Promise<void> {
    await this._plugins.use(plugin, config);
  }
}

/**
 * Create an FHEVM client (Factory function)
 * 
 * @param config - Client configuration
 * @returns FHEVM client instance
 * 
 * @example
 * ```ts
 * import { createFhevmClient } from 'fhevm-sdk'
 * 
 * const client = createFhevmClient({
 *   network: 'https://devnet.zama.ai',
 *   chainId: 8009
 * })
 * ```
 */
export function createFhevmClient(config: ClientConfig): FhevmClient {
  return new FhevmClient(config);
}

