/**
 * FHE WebWorker
 * Offloads heavy FHE encryption/decryption operations to WebWorker
 * Prevents blocking the main thread
 */

/**
 * FHE Worker message types
 */
export type FheWorkerMessageType =
  | "init"
  | "init-response"
  | "encrypt"
  | "encrypt-response"
  | "decrypt"
  | "decrypt-response"
  | "error"
  | "ready";

/**
 * FHE Worker message payload
 */
export interface FheWorkerMessage {
  type: FheWorkerMessageType;
  id?: string;
  payload?: any;
  error?: string;
}

/**
 * FHE Worker configuration
 */
export interface FheWorkerConfig {
  /** WASM module path or URL */
  wasmPath?: string;
  /** Worker script path (optional, defaults to inline worker) */
  workerPath?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Worker options */
  workerOptions?: WorkerOptions;
}

/**
 * FHE Worker result
 */
export interface FheWorkerResult<T = any> {
  id: string;
  result: T;
  error?: string;
}

/**
 * Detect if running in Node.js environment
 */
function isNodeEnvironment(): boolean {
  return (
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null
  );
}

/**
 * FHE Worker class
 * Manages WebWorker for FHE operations (browser) or Worker Threads (Node.js)
 * Automatically detects environment and uses appropriate implementation
 * 
 * @example
 * ```ts
 * // Browser
 * const worker = new FheWorker({
 *   wasmPath: '/wasm/fhe.wasm',
 *   debug: true
 * });
 * 
 * // Node.js
 * const worker = new FheWorker({
 *   workerPath: './fhe-worker.node.js',
 *   debug: true
 * });
 * 
 * await worker.init();
 * const ciphertext = await worker.encrypt(value);
 * ```
 */
export class FheWorker {
  private worker: Worker | any = null;
  private isNode: boolean;
  private wasmPath?: string;
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
    this.isNode = isNodeEnvironment();
    this.wasmPath = config.wasmPath;
    this.debug = config.debug ?? false;
    
    if (this.isNode) {
      // Node.js: Use worker_threads
      this.createNodeWorker(config);
    } else {
      // Browser: Use WebWorker
      this.createBrowserWorker(config);
    }

    this.setupMessageHandler();
  }

  /**
   * Create Node.js worker
   */
  private createNodeWorker(config: FheWorkerConfig): void {
    try {
      const { Worker } = require("worker_threads");
      const path = require("path");
      
      const workerPath = config.workerPath || path.join(__dirname, "fhe-worker.node.js");
      
      this.worker = new Worker(workerPath, {
        workerData: {
          wasmPath: config.wasmPath,
          debug: this.debug,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to create Node.js worker: ${error.message}. Make sure worker_threads is available.`);
    }
  }

  /**
   * Create browser worker
   */
  private createBrowserWorker(config: FheWorkerConfig): void {
    // Create worker from inline script or external path
    if (config.workerPath) {
      this.worker = new Worker(config.workerPath, config.workerOptions);
    } else {
      // Create inline worker
      const workerScript = this.createWorkerScript();
      const blob = new Blob([workerScript], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl, config.workerOptions);
    }
  }

  /**
   * Initialize the worker
   * Loads WASM module if provided
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

      if (this.isNode) {
        // Node.js: Use 'message' event
        const messageHandler = (message: FheWorkerMessage) => {
          if (message.type === "ready") {
            clearTimeout(timeout);
            this.worker?.removeListener("message", messageHandler);
            this.isInitialized = true;
            resolve();
          } else if (message.type === "error" && message.payload?.init) {
            clearTimeout(timeout);
            this.worker?.removeListener("message", messageHandler);
            reject(new Error(message.error || "Worker initialization failed"));
          }
        };

        this.worker?.on("message", messageHandler);
      } else {
        // Browser: Use addEventListener
        const messageHandler = (event: MessageEvent) => {
          const message = event.data as FheWorkerMessage;
          
          if (message.type === "ready") {
            clearTimeout(timeout);
            this.worker?.removeEventListener("message", messageHandler);
            this.isInitialized = true;
            resolve();
          } else if (message.type === "error" && message.payload?.init) {
            clearTimeout(timeout);
            this.worker?.removeEventListener("message", messageHandler);
            reject(new Error(message.error || "Worker initialization failed"));
          }
        };

        this.worker?.addEventListener("message", messageHandler);
      }

      // Send init message
      this.sendMessage({
        type: "init",
        payload: {
          wasmPath: this.wasmPath,
          debug: this.debug,
        },
      });
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

    // Convert string to Uint8Array if needed
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
  terminate(): Promise<number> | void {
    if (this.worker) {
      const result = this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initPromise = null;
      
      // Reject all pending requests
      this.pendingRequests.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error("Worker terminated"));
      });
      this.pendingRequests.clear();
      
      // Node.js worker.terminate() returns a Promise
      return result;
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

    // Both WebWorker and Node.js Worker use postMessage
    this.worker.postMessage(message);

    if (this.debug) {
      console.log("[FheWorker] Sent:", message.type, message.id);
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
      }, 60000); // 60 second timeout

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.sendMessage(message);
    });
  }

  /**
   * Setup message handler
   */
  private setupMessageHandler(): void {
    if (!this.worker) {
      return;
    }

    if (this.isNode) {
      // Node.js: Use 'message' event
      this.worker.on("message", (message: FheWorkerMessage) => {
        this.handleMessage(message);
      });

      this.worker.on("error", (errorEvent: Error) => {
        const error = new Error(errorEvent.message || "Worker error");
        console.error("[FheWorker] Worker error:", errorEvent);
        
        this.pendingRequests.forEach(({ reject, timeout }) => {
          clearTimeout(timeout);
          reject(error);
        });
        this.pendingRequests.clear();
      });

      this.worker.on("exit", (code: number) => {
        if (code !== 0) {
          console.error(`[FheWorker] Worker stopped with exit code ${code}`);
        }
      });
    } else {
      // Browser: Use addEventListener
      this.worker.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as FheWorkerMessage;
        this.handleMessage(message);
      });

      this.worker.addEventListener("error", (errorEvent: ErrorEvent) => {
        const error = new Error(errorEvent.message || "Worker error");
        console.error("[FheWorker] Worker error:", errorEvent);
        
        this.pendingRequests.forEach(({ reject, timeout }) => {
          clearTimeout(timeout);
          reject(error);
        });
        this.pendingRequests.clear();
      });
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: FheWorkerMessage): void {

    if (this.debug) {
      console.log("[FheWorker] Received:", message.type, message.id);
    }

    // Handle responses
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
  }

  /**
   * Create inline worker script
   */
  private createWorkerScript(): string {
    return `
// FHE Worker Script
let wasmModule = null;
let isInitialized = false;

// Helper: Send message to main thread
function post(type, payload, id, error) {
  self.postMessage({ type, payload, id, error });
}

// Helper: Log debug message
function debug(...args) {
  console.log('[FHE Worker]', ...args);
}

// Load WASM module
async function loadWASM(wasmPath) {
  if (!wasmPath) {
    // No WASM path provided, use native JS implementation
    return null;
  }

  try {
    // Use fetch to load WASM file
    const response = await fetch(wasmPath);
    if (!response.ok) {
      throw new Error(\`Failed to fetch WASM: \${response.status} \${response.statusText}\`);
    }
    
    const wasmBytes = await response.arrayBuffer();
    
    // Initialize WASM module
    // Note: This is a placeholder - actual WASM initialization depends on your WASM module structure
    // For example, if using wasm-bindgen:
    // const wasmModule = await WebAssembly.instantiate(wasmBytes, imports);
    // return wasmModule.instance.exports;
    
    // For now, return null and use fallback
    console.warn('WASM module loaded but initialization not implemented. Using fallback.');
    return null;
  } catch (error) {
    console.error('Failed to load WASM module:', error);
    // Don't throw - fall back to JS implementation
    console.warn('Falling back to JavaScript implementation');
    return null;
  }
}

// Initialize worker
async function init(payload) {
  try {
    const { wasmPath, debug: enableDebug } = payload;
    
    if (enableDebug) {
      globalThis.debug = debug;
    }

    if (wasmPath) {
      try {
        wasmModule = await loadWASM(wasmPath);
        if (wasmModule && enableDebug) {
          debug('WASM module loaded and initialized');
        } else if (enableDebug) {
          debug('WASM module not available, using JavaScript fallback');
        }
      } catch (error) {
        if (enableDebug) {
          debug('WASM loading failed, using JavaScript fallback:', error.message);
        }
        wasmModule = null; // Fallback to JS
      }
    } else {
      if (enableDebug) debug('No WASM path provided, using JavaScript implementation');
    }

    isInitialized = true;
    post('ready', null, null, null);
  } catch (error) {
    post('error', { init: true }, null, error.message || 'Initialization failed');
  }
}

// Encrypt value
async function encrypt(payload, id) {
  try {
    const { value, type = 'uint64', contractAddress, userAddress } = payload;
    
    // Simulate encryption (replace with actual WASM call)
    // In production, this would call wasmModule.encrypt(...)
    let encrypted;
    
    if (wasmModule && wasmModule.encrypt) {
      encrypted = wasmModule.encrypt(value, { type, contractAddress, userAddress });
    } else {
      // Fallback: simulate encryption (for development/testing)
      encrypted = new Uint8Array(32);
      const valueBytes = typeof value === 'bigint' 
        ? this.bigintToBytes(value)
        : typeof value === 'number'
        ? this.numberToBytes(value)
        : new Uint8Array([value ? 1 : 0]);
      
      encrypted.set(valueBytes, 0);
    }

    post('encrypt-response', Array.from(encrypted), id, null);
  } catch (error) {
    post('error', null, id, error.message);
  }
}

// Decrypt ciphertext
async function decrypt(payload, id) {
  try {
    const { ciphertext, contractAddress, userAddress } = payload;
    const data = new Uint8Array(ciphertext);
    
    // Simulate decryption (replace with actual WASM call)
    // In production, this would call wasmModule.decrypt(...)
    let decrypted;
    
    if (wasmModule && wasmModule.decrypt) {
      decrypted = wasmModule.decrypt(data, { contractAddress, userAddress });
    } else {
      // Fallback: simulate decryption (for development/testing)
      // This is just a placeholder - real FHE decryption requires keys
      decrypted = BigInt(0);
    }

    post('decrypt-response', decrypted, id, null);
  } catch (error) {
    post('error', null, id, error.message);
  }
}

// Message handler
self.addEventListener('message', async (event) => {
  const { type, payload, id } = event.data;

  switch (type) {
    case 'init':
      await init(payload);
      break;
    case 'encrypt':
      await encrypt(payload, id);
      break;
    case 'decrypt':
      await decrypt(payload, id);
      break;
    default:
      post('error', null, id, \`Unknown message type: \${type}\`);
  }
});

// Helper functions for fallback implementation
function bigintToBytes(value) {
  const bytes = new Uint8Array(32);
  let v = value;
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(v & 0xFFn);
    v >>= 8n;
  }
  return bytes;
}

function numberToBytes(value) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, BigInt(value), true);
  return bytes;
}
`;
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

