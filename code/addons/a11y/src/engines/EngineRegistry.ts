/** Storybook A11y Addon - Engine Registry with Lazy Loading */
import type { A11yEngineType, EngineFactory, IA11yEngine } from './types';

/**
 * Singleton registry for managing accessibility engines with lazy loading
 * 
 * Uses factory pattern to defer engine loading until actually needed:
 * - Factories are registered (lightweight functions)
 * - Engines are instantiated only when requested
 * - Engine libraries are loaded only when engine initializes
 * 
 * This ensures optimal bundle size and performance by loading only
 * the engines that are actually configured and used.
 */
export class EngineRegistry {
  /** Map of registered engine factories (lightweight) */
  private static factories = new Map<A11yEngineType, EngineFactory>();
  
  /** Map of instantiated engine instances (created on-demand) */
  private static instances = new Map<A11yEngineType, IA11yEngine>();
  
  /** Whether the registry has been initialized */
  private static initialized = false;

  /**
   * Initialize the registry with built-in engine factories
   * 
   * This only registers factory functions (lightweight), not actual engine instances.
   * Engines are instantiated lazily when first requested via getOrInitialize().
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Register axe-core factory with dynamic import
    this.registerFactory('axe-core', async () => {
      const { AxeCoreAdapter } = await import('./axe-core/AxeCoreAdapter');
      return new AxeCoreAdapter();
    });

    // Register equal-access factory with dynamic import
    this.registerFactory('equal-access', async () => {
      const { EqualAccessAdapter } = await import('./equal-access/EqualAccessAdapter');
      return new EqualAccessAdapter();
    });

    this.initialized = true;
  }

  /**
   * Register an engine factory
   * 
   * @param type - Engine type identifier
   * @param factory - Factory function that creates the engine instance
   */
  static registerFactory(type: A11yEngineType, factory: EngineFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Register an already-instantiated engine (for backward compatibility)
   * 
   * @param engine - Engine instance to register
   * @deprecated Use registerFactory() for lazy loading benefits
   */
  static register(engine: IA11yEngine): void {
    this.instances.set(engine.type, engine);
  }

  /**
   * Unregister an accessibility engine
   * 
   * @param type - Engine type to unregister
   */
  static unregister(type: A11yEngineType): void {
    const engine = this.instances.get(type);
    if (engine) {
      engine.cleanup().catch((err) => {
        console.warn(`Error cleaning up engine ${type}:`, err);
      });
      this.instances.delete(type);
    }
    this.factories.delete(type);
  }

  /**
   * Get an engine instance by type (if already instantiated)
   * 
   * @param type - Engine type to retrieve
   * @returns Engine instance or undefined if not instantiated yet
   */
  static get(type: A11yEngineType): IA11yEngine | undefined {
    return this.instances.get(type);
  }

  /**
   * Get all instantiated engine instances
   * 
   * @returns Array of all instantiated engine instances
   */
  static getAll(): IA11yEngine[] {
    return Array.from(this.instances.values());
  }

  /**
   * Check if an engine is registered (factory or instance)
   * 
   * @param type - Engine type to check
   * @returns True if the engine factory is registered or instance exists
   */
  static has(type: A11yEngineType): boolean {
    return this.factories.has(type) || this.instances.has(type);
  }

  /**
   * Get or initialize an engine with lazy loading
   * 
   * This is the main entry point for getting engines. It:
   * 1. Ensures registry is initialized (registers factories)
   * 2. Checks if engine instance already exists (cache hit)
   * 3. If not, uses factory to create instance (lazy instantiation)
   * 4. Initializes the engine (loads engine library)
   * 5. Caches the instance for future use
   * 
   * @param type - Engine type to get/initialize
   * @returns Promise resolving to initialized engine instance
   * @throws Error if engine is not found or initialization fails
   */
  static async getOrInitialize(type: A11yEngineType): Promise<IA11yEngine> {
    // Ensure registry is initialized (registers factories)
    await this.initialize();

    // Check if instance already exists (cache hit)
    let engine = this.instances.get(type);
    
    if (engine) {
      // Instance exists, ensure it's initialized
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

    // Instance doesn't exist, create it from factory (lazy instantiation)
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(
        `Engine '${type}' not found in registry. Available engines: ${Array.from(
          this.factories.keys()
        ).join(', ')}`
      );
    }

    try {
      // Create engine instance using factory (loads adapter class)
      engine = await factory();
      
      // Cache the instance
      this.instances.set(type, engine);
      
      // Initialize the engine (loads engine library)
      await engine.initialize();
      
      return engine;
    } catch (error) {
      throw new Error(
        `Failed to create or initialize engine '${type}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Cleanup all instantiated engines
   * 
   * Useful for testing or when shutting down
   */
  static async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.instances.values()).map((engine) =>
      engine.cleanup().catch((err) => {
        console.warn(`Error cleaning up engine ${engine.type}:`, err);
      })
    );

    await Promise.all(cleanupPromises);
    this.instances.clear();
    this.factories.clear();
    this.initialized = false;
  }

  /**
   * Get registry statistics
   * 
   * Useful for debugging and monitoring
   */
  static getStats(): {
    totalFactories: number;
    totalInstances: number;
    readyEngines: number;
    factories: A11yEngineType[];
    instances: Array<{ type: A11yEngineType; ready: boolean; version: string }>;
  } {
    const instances = Array.from(this.instances.values());
    return {
      totalFactories: this.factories.size,
      totalInstances: this.instances.size,
      readyEngines: instances.filter((e) => e.isReady()).length,
      factories: Array.from(this.factories.keys()),
      instances: instances.map((e) => ({
        type: e.type,
        ready: e.isReady(),
        version: e.version,
      })),
    };
  }
}

// Made with Bob
