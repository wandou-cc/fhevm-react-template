/**
 * RPC Provider Adapter
 * Provides HTTP and WebSocket RPC provider implementations
 * Framework-agnostic RPC calls
 */

import type { NetworkProvider } from "../types";
import { FhevmConfigError } from "../errors";

/**
 * HTTP RPC Provider
 * Implements EIP-1193 interface for HTTP RPC endpoints
 */
export class HttpRpcProvider {
  private url: string;
  private timeout: number;
  private idCounter: number = 0;

  constructor(url: string, timeout: number = 30000) {
    this.url = url;
    this.timeout = timeout;
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    const id = ++this.idCounter;
    const payload = {
      jsonrpc: "2.0",
      id,
      method: args.method,
      params: args.params || [],
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "RPC error");
      }

      return data.result;
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error(`RPC request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }
}

/**
 * WebSocket RPC Provider (Basic implementation)
 * Note: Full WebSocket implementation would require managing connection lifecycle
 * This is a simplified version that can be extended
 */
export class WebSocketRpcProvider {
  private url: string;
  private ws?: WebSocket;
  private pendingRequests: Map<number, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
  private idCounter: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(url: string) {
    this.url = url;
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.url);
        
        ws.onopen = () => {
          this.ws = ws;
          this.reconnectAttempts = 0;
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.id && this.pendingRequests.has(data.id)) {
              const { resolve } = this.pendingRequests.get(data.id)!;
              this.pendingRequests.delete(data.id);
              if (data.error) {
                reject(new Error(data.error.message || "RPC error"));
              } else {
                resolve(data.result);
              }
            }
          } catch (error) {
            // Ignore malformed messages
          }
        };

        ws.onerror = (error) => {
          reject(error);
        };

        ws.onclose = () => {
          this.ws = undefined;
          // Attempt to reconnect if needed
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket connection failed");
    }

    const id = ++this.idCounter;
    const payload = {
      jsonrpc: "2.0",
      id,
      method: args.method,
      params: args.params || [],
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(payload));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("RPC request timeout"));
        }
      }, 30000);
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.pendingRequests.clear();
  }
}

/**
 * Create RPC provider from URL
 * Automatically detects HTTP vs WebSocket and creates appropriate provider
 * 
 * @param url - RPC URL (HTTP or WebSocket)
 * @param options - Provider options
 * @returns EIP-1193 compatible provider
 * 
 * @example
 * ```ts
 * // HTTP RPC
 * const httpProvider = createRpcProvider("https://eth.llamarpc.com");
 * 
 * // WebSocket RPC
 * const wsProvider = createRpcProvider("wss://eth.llamarpc.com");
 * ```
 */
export function createRpcProvider(
  url: string,
  options?: {
    timeout?: number;
  }
): NetworkProvider {
  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    return new WebSocketRpcProvider(url);
  }
  
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return new HttpRpcProvider(url, options?.timeout);
  }

  // Default to HTTP
  return new HttpRpcProvider(`https://${url}`, options?.timeout);
}

/**
 * Convert network provider to RPC provider if needed
 * 
 * @param network - Network provider (string URL or EIP-1193 provider)
 * @param options - Provider options
 * @returns EIP-1193 compatible provider
 */
export function toRpcProvider(
  network: NetworkProvider,
  options?: {
    timeout?: number;
  }
): NetworkProvider {
  // If it's already an EIP-1193 provider, return as-is
  if (typeof network === "object" && network !== null && "request" in network) {
    return network;
  }

  // If it's a string URL, create RPC provider
  if (typeof network === "string") {
    return createRpcProvider(network, options);
  }

  throw new FhevmConfigError("Invalid network provider type");
}

