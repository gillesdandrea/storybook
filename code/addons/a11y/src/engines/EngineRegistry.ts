/******************************************************************************
 * Storybook A11y Addon - Engine Registry
 * Manages lifecycle and access to accessibility engines
 *****************************************************************************/

import type { IA11yEngine, A11yEngineType } from './types';
import { AxeCoreAdapter } from './axe-core/AxeCoreAdapter';

/**
 * Singleton registry for managing accessibility engines
 * Handles engine registration, initialization, and lifecycle
 */
export class EngineRegistry {
  private static engines = new Map<A11yEngineType, IA11yEngine>();
  private static initialized = false;

  /**
   * Initialize the registry with built-in engines
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register built-in engines
    this.register(new AxeCoreAdapter());
    
    // Note: EqualAccessAdapter will be registered in Phase 2
    // this.register(new EqualAccessAdapter());

    this.initialized = true;
  }

  /**
   * Register an accessibility engine
   * @param engine - Engine instance to register
   */
  static register(engine: IA11yEngine): void {
    this.engines.set(engine.type, engine);
  }

  /**
   * Unregister an accessibility engine
   * @param type - Engine type to unregister
   */
  static unregister(type: A11yEngineType): void {
    const engine = this.engines.get(type);
    if (engine) {
      engine.cleanup().catch(err => {
        console.warn(`Error cleaning up engine ${type}:`, err);
      });
      this.engines.delete(type);
    }
  }

  /**
   * Get an engine by type
   * @param type - Engine type to retrieve
   * @returns Engine instance or undefined if not found
   */
  static get(type: A11yEngineType): IA11yEngine | undefined {
    return this.engines.get(type);
  }

  /**
   * Get all registered engines
   * @returns Array of all registered engine instances
   */
  static getAll(): IA11yEngine[] {
    return Array.from(this.engines.values());
  }

  /**
   * Check if an engine is registered
   * @param type - Engine type to check
   * @returns true if the engine is registered
   */
  static has(type: A11yEngineType): boolean {
    return this.engines.has(type);
  }

  /**
   * Get or initialize an engine
   * Ensures the engine is ready to use
   * @param type - Engine type to get/initialize
   * @returns Promise resolving to initialized engine instance
   * @throws Error if engine is not found or initialization fails
   */
  static async getOrInitialize(type: A11yEngineType): Promise<IA11yEngine> {
    // Ensure registry is initialized
    await this.initialize();
    
    const engine = this.get(type);
    if (!engine) {
      throw new Error(
        `Engine '${type}' not found in registry. Available engines: ${
          Array.from(this.engines.keys()).join(', ')
        }`
      );
    }

    // Initialize engine if not ready
    if (!engine.isReady()) {
      try {
        await engine.initialize();
      } catch (error) {
        throw new Error(
          `Failed to initialize engine '${type}': ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return engine;
  }

  /**
   * Cleanup all registered engines
   * Useful for testing or when shutting down
   */
  static async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.engines.values()).map(engine =>
      engine.cleanup().catch(err => {
        console.warn(`Error cleaning up engine ${engine.type}:`, err);
      })
    );
    
    await Promise.all(cleanupPromises);
    this.engines.clear();
    this.initialized = false;
  }

  /**
   * Get registry statistics
   * Useful for debugging and monitoring
   */
  static getStats(): {
    totalEngines: number;
    readyEngines: number;
    engines: Array<{ type: A11yEngineType; ready: boolean; version: string }>;
  } {
    const engines = Array.from(this.engines.values());
    return {
      totalEngines: engines.length,
      readyEngines: engines.filter(e => e.isReady()).length,
      engines: engines.map(e => ({
        type: e.type,
        ready: e.isReady(),
        version: e.version,
      })),
    };
  }
}

// Made with Bob
