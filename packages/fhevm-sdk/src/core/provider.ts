/**
 * RPC Provider Management
 * Support for HTTP, WebSocket, and custom node providers
 * High cohesion: Provider creation and management
 */

import type { NetworkProvider } from "../types";
import { FhevmConfigError } from "../errors";

/**
 * Provider types supported by the SDK
 */
export type ProviderType = "http" | "websocket" | "custom" | "eip-1193";

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Provider type */
  type: ProviderType;
  /** Provider URL or connection string */
  url?: string;
  /** Custom provider instance (for EIP-1193 or custom providers) */
  provider?: NetworkProvider;
  /** Connection timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    maxRetries?: number;
    retryDelay?: number;
  };
}

/**
 * Provider info with type detection
 */
export interface ProviderInfo {
  type: ProviderType;
  url?: string;
  isConnected: boolean;
}

/**
 * Detect provider type from network configuration
 */
export function detectProviderType(network: NetworkProvider): ProviderType {
  if (typeof network === "string") {
    if (network.startsWith("ws://") || network.startsWith("wss://")) {
      return "websocket";
    }
    if (network.startsWith("http://") || network.startsWith("https://")) {
      return "http";
    }
    // Default to http for RPC URLs
    return "http";
  }
  
  // Object provider (EIP-1193 or custom)
  if (typeof network === "object" && network !== null) {
    if ("request" in network && typeof network.request === "function") {
      return "eip-1193";
    }
    return "custom";
  }
  
  throw new FhevmConfigError("Invalid network provider configuration");
}

/**
 * Create provider configuration from network
 */
export function createProviderConfig(
  network: NetworkProvider,
  options?: {
    timeout?: number;
    retry?: ProviderConfig["retry"];
  }
): ProviderConfig {
  const type = detectProviderType(network);
  
  if (type === "http" || type === "websocket") {
    if (typeof network !== "string") {
      throw new FhevmConfigError(`Expected string URL for ${type} provider`);
    }
    return {
      type,
      url: network,
      timeout: options?.timeout ?? 30000,
      retry: options?.retry,
    };
  }
  
  // EIP-1193 or custom provider
  return {
    type,
    provider: network,
    timeout: options?.timeout ?? 30000,
    retry: options?.retry,
  };
}

/**
 * Get provider info
 */
export function getProviderInfo(network: NetworkProvider): ProviderInfo {
  const type = detectProviderType(network);
  const url = typeof network === "string" ? network : undefined;
  
  // For EIP-1193 providers, check if they have connection methods
  let isConnected = true;
  if (typeof network === "object" && network !== null) {
    // Try to detect connection state if available
    isConnected = "isConnected" in network 
      ? (network as any).isConnected ?? true
      : true;
  }
  
  return {
    type,
    url,
    isConnected,
  };
}

/**
 * Validate provider URL
 */
export function validateProviderUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const validProtocols = ["http:", "https:", "ws:", "wss:"];
    return validProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Create HTTP provider URL with fallback
 */
export function createHttpProvider(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Create WebSocket provider URL with fallback
 */
export function createWebSocketProvider(url: string): string {
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    // Determine protocol based on URL
    if (url.startsWith("https://")) {
      return url.replace("https://", "wss://");
    }
    if (url.startsWith("http://")) {
      return url.replace("http://", "ws://");
    }
    return `wss://${url}`;
  }
  return url;
}

/**
 * Provider manager class
 * Manages provider lifecycle and connection state
 */
export class ProviderManager {
  private _config: ProviderConfig;
  private _network: NetworkProvider;
  private _isConnected: boolean = false;

  constructor(network: NetworkProvider, config?: Partial<ProviderConfig>) {
    this._network = network;
    this._config = createProviderConfig(network, {
      timeout: config?.timeout,
      retry: config?.retry,
    });
  }

  /**
   * Get provider configuration
   */
  get config(): ProviderConfig {
    return this._config;
  }

  /**
   * Get network provider
   */
  get network(): NetworkProvider {
    return this._network;
  }

  /**
   * Get provider type
   */
  get type(): ProviderType {
    return this._config.type;
  }

  /**
   * Get provider URL (if applicable)
   */
  get url(): string | undefined {
    return this._config.url;
  }

  /**
   * Check if provider is connected
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Connect to provider (for WebSocket providers)
   */
  async connect(): Promise<void> {
    if (this._config.type === "websocket") {
      // WebSocket connection would be handled by the underlying provider
      this._isConnected = true;
    } else {
      this._isConnected = true;
    }
  }

  /**
   * Disconnect from provider (for WebSocket providers)
   */
  async disconnect(): Promise<void> {
    this._isConnected = false;
  }

  /**
   * Get provider info
   */
  getInfo(): ProviderInfo {
    return {
      type: this._config.type,
      url: this._config.url,
      isConnected: this._isConnected,
    };
  }
}

