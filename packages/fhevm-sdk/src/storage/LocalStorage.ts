import type { GenericStringStorage } from "./GenericStringStorage";

/**
 * LocalStorage adapter for FHEVM SDK
 * Uses browser's localStorage for persistent storage
 * 
 * @example
 * ```ts
 * import { LocalStorageAdapter } from 'fhevm-sdk/storage'
 * 
 * const storage = new LocalStorageAdapter('fhevm')
 * ```
 */
export class LocalStorageAdapter implements GenericStringStorage {
  private prefix: string;

  constructor(prefix: string = "fhevm") {
    this.prefix = prefix;
    
    if (typeof window === "undefined" || !window.localStorage) {
      console.warn("LocalStorage is not available in this environment");
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  getItem(key: string): string | null {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    
    try {
      return window.localStorage.getItem(this.getKey(key));
    } catch (error) {
      console.error("LocalStorage getItem error:", error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    
    try {
      window.localStorage.setItem(this.getKey(key), value);
    } catch (error) {
      console.error("LocalStorage setItem error:", error);
    }
  }

  removeItem(key: string): void {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    
    try {
      window.localStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.error("LocalStorage removeItem error:", error);
    }
  }

  clear(): void {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    
    try {
      const keys = Object.keys(window.localStorage);
      keys.forEach((key) => {
        if (key.startsWith(`${this.prefix}:`)) {
          window.localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("LocalStorage clear error:", error);
    }
  }
}

