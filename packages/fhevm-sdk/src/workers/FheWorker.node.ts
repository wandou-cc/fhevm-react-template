/**
 * FHE Worker for Node.js
 * Uses worker_threads for Node.js environment
 */

import { Worker } from "worker_threads";
import type { EventEmitter } from "events";
import type { FheWorkerConfig, FheWorkerMessage, FheWorkerMessageType } from "./FheWorker";

/**
 * FHE Worker for Node.js
 * Manages Worker Threads for FHE operations in Node.js
 * 
 * @example
 * ```ts
 * const worker = new FheWorkerNode({
 *   workerPath: './fhe-worker.js',
 *   debug: true
 * });
 * 
 * await worker.init();
 * const ciphertext = await worker.encrypt(value);
 * ```
 */
export class FheWorkerNode {
  private worker: Worker | null = null;
  private workerPath?: string;
  private debug: boolean;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private requestIdCounter: number = 0;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: FheWorkerConfig = {}) {
    this.workerPath = config.workerPath || this.getDefaultWorkerPath();
    this.debug = config.debug ?? false;
    
    if (!this.workerPath) {
      throw new Error("Worker path is required for Node.js environment");
    }
  }

  /**
   * Get default worker path
   */
  private getDefaultWorkerPath(): string {
    // Try to resolve from package root
    try {
      const path = require("path");
      const workerPath = path.join(__dirname, "../workers/fhe-worker.node.js");
      return workerPath;
    } catch {
      return "./fhe-worker.node.js";
    }
  }

  /**
   * Initialize the worker
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Worker initialization timeout"));
      }, 30000);

        const messageHandler = (message: any) => {
        if (message.type === "ready") {
          clearTimeout(timeout);
          this.worker?.removeListener("message", messageHandler);
          this.isInitialized = true;
          // Setup normal operation handlers after init
          this.setupMessageHandler();
          resolve();
        } else if (message.type === "error" && message.payload?.init) {
          clearTimeout(timeout);
          this.worker?.removeListener("message", messageHandler);
          reject(new Error(message.error || "Worker initialization failed"));
        }
      };

      try {
        const path = require("path");
        const workerPath = this.workerPath || path.join(__dirname, "fhe-worker.node.js");
        
        this.worker = new Worker(workerPath, {
          workerData: {
            wasmPath: undefined, // Can be passed if needed
            debug: this.debug,
          },
        });

        // Setup initial message handler for ready message
        this.worker.on("message", messageHandler);
        this.worker.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        // Setup normal operation handlers (will handle requests after init)
        // Note: We don't call setupMessageHandler here to avoid duplicate handlers
        // The message handler for ready will be removed after init completes

        // Send init message
        this.sendMessage({
          type: "init",
          payload: {
            debug: this.debug,
          },
        });
      } catch (error: any) {
        clearTimeout(timeout);
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * Encrypt a value
   */
  async encrypt(value: number | bigint | boolean, params?: {
    type?: "uint8" | "uint16" | "uint32" | "uint64" | "uint128" | "uint256" | "bool";
    contractAddress?: string;
    userAddress?: string;
  }): Promise<Uint8Array> {
    await this.ensureInitialized();

    return this.sendRequest({
      type: "encrypt",
      payload: {
        value,
        ...params,
      },
    });
  }

  /**
   * Decrypt a ciphertext
   */
  async decrypt(ciphertext: Uint8Array | string, params?: {
    contractAddress?: string;
    userAddress?: string;
  }): Promise<number | bigint | boolean> {
    await this.ensureInitialized();

    const data = typeof ciphertext === "string"
      ? this.hexToUint8Array(ciphertext)
      : ciphertext;

    return this.sendRequest({
      type: "decrypt",
      payload: {
        ciphertext: Array.from(data),
        ...params,
      },
    });
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initPromise = null;
      
      this.pendingRequests.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error("Worker terminated"));
      });
      this.pendingRequests.clear();
    }
  }

  /**
   * Check if worker is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Ensure worker is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  /**
   * Send message to worker
   */
  private sendMessage(message: FheWorkerMessage): void {
    if (!this.worker) {
      throw new Error("Worker not initialized");
    }

    this.worker.postMessage(message);

    if (this.debug) {
      console.log("[FheWorker Node] Sent:", message.type, message.id);
    }
  }

  /**
   * Send request and wait for response
   */
  private async sendRequest<T = any>(message: FheWorkerMessage): Promise<T> {
    const id = `req_${++this.requestIdCounter}_${Date.now()}`;
    message.id = id;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error("Worker request timeout"));
      }, 60000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.sendMessage(message);
    });
  }

  /**
   * Setup message handler (called after init completes)
   */
  private setupMessageHandler(): void {
    if (!this.worker) {
      return;
    }

    // Set up handler for normal operation (not init messages)
    // Only handle messages that have a request ID
    this.worker.on("message", (message: FheWorkerMessage) => {
      // Skip init messages
      if (message.type === "ready" || (message.type === "error" && message.payload?.init)) {
        return;
      }

      if (this.debug) {
        console.log("[FheWorker Node] Received:", message.type, message.id);
      }

      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject, timeout } = this.pendingRequests.get(message.id)!;
        clearTimeout(timeout);
        this.pendingRequests.delete(message.id);

        if (message.type.endsWith("-response")) {
          resolve(message.payload);
        } else if (message.type === "error") {
          reject(new Error(message.error || "Worker error"));
        } else {
          resolve(message.payload);
        }
      }
    });

    this.worker.on("error", (error) => {
      console.error("[FheWorker Node] Worker error:", error);
      
      this.pendingRequests.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(error);
      });
      this.pendingRequests.clear();
    });

    this.worker.on("exit", (code) => {
      if (code !== 0) {
        console.error(`[FheWorker Node] Worker stopped with exit code ${code}`);
      }
    });
  }

  /**
   * Convert hex string to Uint8Array
   */
  private hexToUint8Array(hex: string): Uint8Array {
    if (hex.startsWith("0x")) {
      hex = hex.slice(2);
    }
    
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}

