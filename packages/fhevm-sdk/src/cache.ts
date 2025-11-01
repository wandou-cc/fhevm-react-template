/**
 * Advanced caching system for FHEVM SDK
 * Supports TTL, LRU, and various cache strategies
 */

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Maximum number of entries (LRU eviction) */
  maxSize?: number;
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Enable automatic cleanup of expired entries */
  autoCleanup?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
}

/**
 * Advanced cache with TTL and LRU support
 */
export class AdvancedCache<K = string, V = any> {
  private cache = new Map<K, CacheEntry<V>>();
  private options: Required<CacheOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize ?? 100,
      ttl: options.ttl ?? 0, // 0 = no expiration
      autoCleanup: options.autoCleanup ?? true,
      cleanupInterval: options.cleanupInterval ?? 60000, // 1 minute
    };

    if (this.options.autoCleanup) {
      this.startCleanup();
    }
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V, ttl?: number): void {
    const now = Date.now();
    const effectiveTtl = ttl ?? this.options.ttl;

    const entry: CacheEntry<V> = {
      value,
      timestamp: now,
      expiresAt: effectiveTtl > 0 ? now + effectiveTtl : undefined,
      accessCount: 0,
      lastAccessed: now,
    };

    // LRU eviction if cache is full
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.value;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values
   */
  values(): V[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const now = Date.now();

    const expired = entries.filter(
      e => e.expiresAt && now > e.expiresAt
    ).length;

    const totalAccesses = entries.reduce(
      (sum, e) => sum + e.accessCount,
      0
    );

    const avgAccesses = entries.length > 0 
      ? totalAccesses / entries.length 
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      expired,
      totalAccesses,
      avgAccesses,
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: K | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Start automatic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);

    // Don't prevent Node.js from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Dispose cache (cleanup resources)
   */
  dispose(): void {
    this.stopCleanup();
    this.clear();
  }
}

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  expired: number;
  totalAccesses: number;
  avgAccesses: number;
}

/**
 * Cache with async get/set (for storage adapters)
 */
export class AsyncCache<K = string, V = any> extends AdvancedCache<K, V> {
  /**
   * Get value asynchronously
   */
  async getAsync(key: K): Promise<V | undefined> {
    return this.get(key);
  }

  /**
   * Set value asynchronously
   */
  async setAsync(key: K, value: V, ttl?: number): Promise<void> {
    this.set(key, value, ttl);
  }

  /**
   * Get or compute value
   */
  async getOrSet(
    key: K,
    factory: () => Promise<V>,
    ttl?: number
  ): Promise<V> {
    const cached = this.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }
}

/**
 * Multi-level cache (memory + persistent)
 */
export class MultiLevelCache<K = string, V = any> {
  constructor(
    private l1: AdvancedCache<K, V>, // Memory cache
    private l2?: AdvancedCache<K, V> // Persistent cache
  ) {}

  /**
   * Get value from cache (checks L1 then L2)
   */
  async get(key: K): Promise<V | undefined> {
    // Try L1 first
    const l1Value = this.l1.get(key);
    if (l1Value !== undefined) {
      return l1Value;
    }

    // Try L2
    if (this.l2) {
      const l2Value = this.l2.get(key);
      if (l2Value !== undefined) {
        // Promote to L1
        this.l1.set(key, l2Value);
        return l2Value;
      }
    }

    return undefined;
  }

  /**
   * Set value in both caches
   */
  async set(key: K, value: V, ttl?: number): Promise<void> {
    this.l1.set(key, value, ttl);
    if (this.l2) {
      this.l2.set(key, value, ttl);
    }
  }

  /**
   * Delete from both caches
   */
  async delete(key: K): Promise<void> {
    this.l1.delete(key);
    if (this.l2) {
      this.l2.delete(key);
    }
  }

  /**
   * Clear both caches
   */
  async clear(): Promise<void> {
    this.l1.clear();
    if (this.l2) {
      this.l2.clear();
    }
  }
}

