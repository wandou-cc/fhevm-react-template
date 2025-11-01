/**
 * Event system for FHEVM SDK
 * Provides lifecycle hooks and monitoring capabilities
 */

import type { FhevmInstance } from "./fhevmTypes";
import type { EncryptResult, DecryptRequest, DecryptedResults } from "./types";

/**
 * Event types
 */
export type FhevmEventMap = {
  // Instance events
  'instance:creating': { timestamp: number };
  'instance:created': { instance: FhevmInstance; timestamp: number; duration: number };
  'instance:error': { error: Error; timestamp: number };
  'instance:cached': { instance: FhevmInstance; timestamp: number };
  
  // Encryption events
  'encrypt:start': { contractAddress: string; userAddress: string; timestamp: number };
  'encrypt:success': { contractAddress: string; result: EncryptResult; timestamp: number; duration: number };
  'encrypt:error': { contractAddress: string; error: Error; timestamp: number };
  
  // Decryption events
  'decrypt:start': { requests: DecryptRequest[]; timestamp: number };
  'decrypt:success': { results: DecryptedResults; timestamp: number; duration: number };
  'decrypt:error': { error: Error; timestamp: number };
  
  // Network events
  'network:request': { method: string; params?: any; timestamp: number };
  'network:response': { method: string; result: any; timestamp: number; duration: number };
  'network:error': { method: string; error: Error; timestamp: number };
  
  // Cache events
  'cache:hit': { key: string; timestamp: number };
  'cache:miss': { key: string; timestamp: number };
  'cache:set': { key: string; timestamp: number };
  'cache:clear': { key?: string; timestamp: number };
  
  // General events
  'error': { error: Error; context?: any; timestamp: number };
  'debug': { message: string; data?: any; timestamp: number };
};

/**
 * Event listener type
 */
export type EventListener<T = any> = (data: T) => void | Promise<void>;

/**
 * Event emitter for FHEVM SDK
 */
export class FhevmEventEmitter {
  private listeners = new Map<keyof FhevmEventMap, Set<EventListener>>();

  /**
   * Add event listener
   */
  on<K extends keyof FhevmEventMap>(
    event: K,
    listener: EventListener<FhevmEventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const listeners = this.listeners.get(event)!;
    listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Add one-time event listener
   */
  once<K extends keyof FhevmEventMap>(
    event: K,
    listener: EventListener<FhevmEventMap[K]>
  ): () => void {
    const wrappedListener = (data: FhevmEventMap[K]) => {
      unsubscribe();
      listener(data);
    };
    
    const unsubscribe = this.on(event, wrappedListener);
    return unsubscribe;
  }

  /**
   * Remove event listener
   */
  off<K extends keyof FhevmEventMap>(
    event: K,
    listener: EventListener<FhevmEventMap[K]>
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit event
   */
  emit<K extends keyof FhevmEventMap>(
    event: K,
    data: FhevmEventMap[K]
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event?: keyof FhevmEventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: keyof FhevmEventMap): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): (keyof FhevmEventMap)[] {
    return Array.from(this.listeners.keys());
  }
}

/**
 * Global event emitter instance
 * Can be used across the SDK
 */
export const globalEmitter = new FhevmEventEmitter();

