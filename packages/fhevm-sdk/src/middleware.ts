/**
 * Middleware system for FHEVM SDK
 * Allows intercepting and modifying operations
 */

import type { FhevmClient } from "./core/client";
import type { EncryptResult, DecryptedResults } from "./types";

/**
 * Middleware context types
 */
export interface EncryptContext {
  type: 'encrypt';
  client: FhevmClient;
  contractAddress: string;
  userAddress: string;
  timestamp: number;
}

export interface DecryptContext {
  type: 'decrypt';
  client: FhevmClient;
  requestCount: number;
  timestamp: number;
}

export type MiddlewareContext = EncryptContext | DecryptContext;

/**
 * Middleware function type
 */
export type Middleware<TContext extends MiddlewareContext = MiddlewareContext> = (
  context: TContext,
  next: () => Promise<any>
) => Promise<any>;

/**
 * Middleware chain executor
 */
export class MiddlewareChain<TContext extends MiddlewareContext = MiddlewareContext> {
  private middlewares: Middleware<TContext>[] = [];

  /**
   * Add middleware to the chain
   */
  use(middleware: Middleware<TContext>): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Execute middleware chain
   */
  async execute(
    context: TContext,
    finalHandler: () => Promise<any>
  ): Promise<any> {
    let index = 0;

    const next = async (): Promise<any> => {
      if (index >= this.middlewares.length) {
        return finalHandler();
      }

      const middleware = this.middlewares[index++];
      return middleware(context, next);
    };

    return next();
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares = [];
  }

  /**
   * Get middleware count
   */
  get length(): number {
    return this.middlewares.length;
  }
}

/**
 * Built-in middleware: Retry with exponential backoff
 */
export function retryMiddleware(options: {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: Error) => boolean;
} = {}): Middleware {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = (error: Error) => {
      // Retry on network errors
      return error.message.includes('network') || 
             error.message.includes('timeout') ||
             error.message.includes('fetch');
    }
  } = options;

  return async (context, next) => {
    let lastError: Error | undefined;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await next();
      } catch (error) {
        lastError = error as Error;

        // Don't retry if it's the last attempt or error is not retryable
        if (attempt === maxRetries || !shouldRetry(lastError)) {
          throw error;
        }

        // Wait before retrying
        context.client.debug(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff
        delay = Math.min(delay * backoffFactor, maxDelay);
      }
    }

    throw lastError;
  };
}

/**
 * Built-in middleware: Request deduplication
 */
export function dedupeMiddleware(): Middleware {
  const pendingRequests = new Map<string, Promise<any>>();

  return async (context, next) => {
    // Generate cache key based on context
    const key = generateCacheKey(context);

    // Check if request is already pending
    if (pendingRequests.has(key)) {
      context.client.debug(`Dedupe: Reusing pending request for ${key}`);
      return pendingRequests.get(key);
    }

    // Execute request and cache promise
    const promise = next().finally(() => {
      pendingRequests.delete(key);
    });

    pendingRequests.set(key, promise);
    return promise;
  };
}

/**
 * Built-in middleware: Performance monitoring
 */
export function performanceMiddleware(options: {
  onMetric?: (metric: PerformanceMetric) => void;
  threshold?: number; // Log warning if operation takes longer than threshold (ms)
} = {}): Middleware {
  const { onMetric, threshold = 5000 } = options;

  return async (context, next) => {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize;

    try {
      const result = await next();
      const duration = performance.now() - startTime;
      const endMemory = (performance as any).memory?.usedJSHeapSize;

      const metric: PerformanceMetric = {
        type: context.type,
        duration,
        memoryDelta: endMemory && startMemory ? endMemory - startMemory : undefined,
        timestamp: context.timestamp,
        success: true
      };

      if (duration > threshold) {
        context.client.debug(
          `⚠️ Slow operation: ${context.type} took ${duration.toFixed(2)}ms`
        );
      }

      onMetric?.(metric);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      const metric: PerformanceMetric = {
        type: context.type,
        duration,
        timestamp: context.timestamp,
        success: false,
        error: error as Error
      };

      onMetric?.(metric);
      throw error;
    }
  };
}

/**
 * Built-in middleware: Rate limiting
 */
export function rateLimitMiddleware(options: {
  maxRequests: number;
  windowMs: number;
} = {
  maxRequests: 10,
  windowMs: 1000
}): Middleware {
  const { maxRequests, windowMs } = options;
  const requests: number[] = [];

  return async (context, next) => {
    const now = Date.now();

    // Remove old requests outside the window
    while (requests.length > 0 && requests[0] < now - windowMs) {
      requests.shift();
    }

    // Check rate limit
    if (requests.length >= maxRequests) {
      const oldestRequest = requests[0];
      const waitTime = oldestRequest + windowMs - now;
      
      context.client.debug(
        `Rate limit reached. Waiting ${waitTime}ms...`
      );

      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Try again
      return rateLimitMiddleware(options)(context, next);
    }

    // Add current request
    requests.push(now);

    return next();
  };
}

/**
 * Built-in middleware: Logging
 */
export function loggingMiddleware(options: {
  logRequest?: boolean;
  logResponse?: boolean;
  logError?: boolean;
} = {
  logRequest: true,
  logResponse: true,
  logError: true
}): Middleware {
  return async (context, next) => {
    if (options.logRequest) {
      context.client.debug(`→ ${context.type} started`, context);
    }

    const startTime = Date.now();

    try {
      const result = await next();
      
      if (options.logResponse) {
        const duration = Date.now() - startTime;
        context.client.debug(
          `← ${context.type} completed in ${duration}ms`
        );
      }

      return result;
    } catch (error) {
      if (options.logError) {
        const duration = Date.now() - startTime;
        context.client.debug(
          `✗ ${context.type} failed after ${duration}ms:`,
          error
        );
      }
      throw error;
    }
  };
}

/**
 * Performance metric type
 */
export interface PerformanceMetric {
  type: string;
  duration: number;
  memoryDelta?: number;
  timestamp: number;
  success: boolean;
  error?: Error;
}

/**
 * Generate cache key from context
 */
function generateCacheKey(context: MiddlewareContext): string {
  if (context.type === 'encrypt') {
    return `encrypt:${context.contractAddress}:${context.userAddress}`;
  } else {
    // decrypt context
    return `decrypt:${context.requestCount}:${context.timestamp}`;
  }
}

