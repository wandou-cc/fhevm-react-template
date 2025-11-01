/**
 * Plugin system for FHEVM SDK
 * Allows extending SDK functionality
 */

import type { FhevmClient } from "./core/client";
import type { FhevmEventEmitter } from "./events";
import type { Middleware, MiddlewareChain } from "./middleware";

/**
 * Plugin interface
 */
export interface FhevmPlugin {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version?: string;
  /** Initialize plugin */
  install(context: PluginContext): void | Promise<void>;
  /** Cleanup plugin */
  uninstall?(context: PluginContext): void | Promise<void>;
}

/**
 * Plugin context
 */
export interface PluginContext {
  /** Client instance */
  client: FhevmClient;
  /** Event emitter */
  events: FhevmEventEmitter;
  /** Middleware chains */
  middleware: {
    encrypt: MiddlewareChain;
    decrypt: MiddlewareChain;
  };
  /** Plugin configuration */
  config?: any;
}

/**
 * Plugin manager
 */
export class PluginManager {
  private plugins = new Map<string, FhevmPlugin>();
  private installedPlugins = new Set<string>();

  constructor(private context: PluginContext) {}

  /**
   * Register and install a plugin
   */
  async use(plugin: FhevmPlugin, config?: any): Promise<void> {
    if (this.installedPlugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already installed`);
    }

    this.plugins.set(plugin.name, plugin);

    const pluginContext: PluginContext = {
      ...this.context,
      config,
    };

    await plugin.install(pluginContext);
    this.installedPlugins.add(plugin.name);

    this.context.client.debug(`Plugin "${plugin.name}" installed`);
  }

  /**
   * Uninstall a plugin
   */
  async unuse(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" not found`);
    }

    if (!this.installedPlugins.has(pluginName)) {
      throw new Error(`Plugin "${pluginName}" is not installed`);
    }

    if (plugin.uninstall) {
      await plugin.uninstall(this.context);
    }

    this.installedPlugins.delete(pluginName);
    this.context.client.debug(`Plugin "${pluginName}" uninstalled`);
  }

  /**
   * Check if plugin is installed
   */
  has(pluginName: string): boolean {
    return this.installedPlugins.has(pluginName);
  }

  /**
   * Get installed plugin names
   */
  getInstalledPlugins(): string[] {
    return Array.from(this.installedPlugins);
  }

  /**
   * Get plugin by name
   */
  getPlugin(pluginName: string): FhevmPlugin | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * Uninstall all plugins
   */
  async clear(): Promise<void> {
    const pluginNames = Array.from(this.installedPlugins);

    for (const name of pluginNames) {
      await this.unuse(name);
    }
  }
}

/**
 * Helper to create a plugin
 */
export function createPlugin(plugin: FhevmPlugin): FhevmPlugin {
  return plugin;
}

// ============================================
// Built-in Plugins
// ============================================

/**
 * Analytics plugin
 */
export const analyticsPlugin = createPlugin({
  name: 'analytics',
  version: '1.0.0',
  install(context) {
    const { events, config } = context;
    const { onEvent } = config || {};

    if (!onEvent) {
      console.warn('Analytics plugin requires onEvent callback');
      return;
    }

    // Track all operations
    events.on('encrypt:success', (data) => {
      onEvent('encrypt', {
        contractAddress: data.contractAddress,
        duration: data.duration,
        timestamp: data.timestamp,
      });
    });

    events.on('decrypt:success', (data) => {
      onEvent('decrypt', {
        requestCount: Object.keys(data.results).length,
        duration: data.duration,
        timestamp: data.timestamp,
      });
    });

    events.on('error', (data) => {
      onEvent('error', {
        error: data.error.message,
        context: data.context,
        timestamp: data.timestamp,
      });
    });
  },
});

/**
 * Performance monitoring plugin
 */
export const performancePlugin = createPlugin({
  name: 'performance',
  version: '1.0.0',
  install(context) {
    const { events, client } = context;
    const metrics: any[] = [];

    // Collect performance metrics
    events.on('encrypt:success', (data) => {
      metrics.push({
        type: 'encrypt',
        duration: data.duration,
        timestamp: data.timestamp,
      });
    });

    events.on('decrypt:success', (data) => {
      metrics.push({
        type: 'decrypt',
        duration: data.duration,
        timestamp: data.timestamp,
      });
    });

    // Log summary every 10 operations
    const logSummary = () => {
      if (metrics.length >= 10) {
        const avg = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
        const max = Math.max(...metrics.map(m => m.duration));
        const min = Math.min(...metrics.map(m => m.duration));

        client.debug(`Performance Summary: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
        metrics.length = 0; // Clear
      }
    };

    events.on('encrypt:success', logSummary);
    events.on('decrypt:success', logSummary);
  },
});

/**
 * Error recovery plugin
 */
export const errorRecoveryPlugin = createPlugin({
  name: 'error-recovery',
  version: '1.0.0',
  install(context) {
    const { events, client, config } = context;
    const { onError, autoRecover = true } = config || {};

    events.on('error', async (data) => {
      client.debug(`Error occurred: ${data.error.message}`);

      if (onError) {
        const shouldRecover = await onError(data.error, data.context);

        if (autoRecover && shouldRecover !== false) {
          client.debug('Attempting auto-recovery...');
          // Auto-recovery logic here
        }
      }
    });

    // Monitor network errors
    events.on('network:error', async (data) => {
      client.debug(`Network error: ${data.error.message}`);
      
      if (autoRecover) {
        client.debug('Attempting to reconnect...');
        // Reconnection logic here
      }
    });
  },
});

/**
 * Cache warming plugin
 */
export const cacheWarmingPlugin = createPlugin({
  name: 'cache-warming',
  version: '1.0.0',
  async install(context) {
    const { client, config } = context;
    const { addresses = [] } = config || {};

    client.debug('Warming up cache...');

    // Pre-fetch public keys or other frequently used data
    // This is application-specific
    for (const address of addresses) {
      client.debug(`Pre-fetching data for ${address}`);
      // Pre-fetch logic here
    }

    client.debug('Cache warming complete');
  },
});

/**
 * Development tools plugin
 */
export const devToolsPlugin = createPlugin({
  name: 'dev-tools',
  version: '1.0.0',
  install(context) {
    const { events, client } = context;

    // Expose debug tools on window (browser only)
    if (typeof window !== 'undefined') {
      (window as any).__FHEVM_SDK_DEBUG__ = {
        client,
        events,
        middleware: context.middleware,
        clearCache: () => {
          if (client.instance) {
            client.clearInstance();
            client.debug('Cache cleared');
          }
        },
        getMetrics: () => {
          // Return collected metrics
          return {
            eventListeners: events.eventNames().map(name => ({
              name,
              count: events.listenerCount(name),
            })),
          };
        },
      };

      client.debug('Dev tools available at window.__FHEVM_SDK_DEBUG__');
    }

    // Log all events in debug mode
    if (client.isDebug()) {
      const allEvents: (keyof import('./events').FhevmEventMap)[] = [
        'instance:creating',
        'instance:created',
        'instance:error',
        'encrypt:start',
        'encrypt:success',
        'encrypt:error',
        'decrypt:start',
        'decrypt:success',
        'decrypt:error',
      ];

      allEvents.forEach((eventName) => {
        events.on(eventName, (data) => {
          client.debug(`[Event] ${eventName}`, data);
        });
      });
    }
  },
});

