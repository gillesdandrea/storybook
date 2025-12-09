import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EngineRegistry } from './EngineRegistry';
import { A11yEngineType } from './types';

describe('EngineRegistry - Lazy Loading', () => {
  beforeEach(async () => {
    // Clean up before each test
    await EngineRegistry.cleanupAll();
  });

  describe('Factory Registration', () => {
    it('should initialize with registered factories but no instances', async () => {
      await EngineRegistry.initialize();
      
      const stats = EngineRegistry.getStats();
      
      // Should have factories registered
      expect(stats.totalFactories).toBe(2);
      expect(stats.factories).toContain('axe-core');
      expect(stats.factories).toContain('equal-access');
      
      // Should have no instances yet (lazy loading)
      expect(stats.totalInstances).toBe(0);
      expect(stats.readyEngines).toBe(0);
    });

    it('should check if engine is registered via factory', async () => {
      await EngineRegistry.initialize();
      
      expect(EngineRegistry.has(A11yEngineType.AXE_CORE)).toBe(true);
      expect(EngineRegistry.has(A11yEngineType.EQUAL_ACCESS)).toBe(true);
    });
  });

  describe('Lazy Instantiation', () => {
    it('should not instantiate engines until requested', async () => {
      await EngineRegistry.initialize();
      
      // No instances should exist yet
      expect(EngineRegistry.get(A11yEngineType.AXE_CORE)).toBeUndefined();
      expect(EngineRegistry.get(A11yEngineType.EQUAL_ACCESS)).toBeUndefined();
    });

    it('should instantiate only the requested engine', async () => {
      await EngineRegistry.initialize();
      
      // Request axe-core
      const axeEngine = await EngineRegistry.getOrInitialize(A11yEngineType.AXE_CORE);
      
      expect(axeEngine).toBeDefined();
      expect(axeEngine.type).toBe(A11yEngineType.AXE_CORE);
      expect(axeEngine.isReady()).toBe(true);
      
      const stats = EngineRegistry.getStats();
      
      // Should have only one instance (axe-core)
      expect(stats.totalInstances).toBe(1);
      expect(stats.instances[0].type).toBe(A11yEngineType.AXE_CORE);
      expect(stats.instances[0].ready).toBe(true);
      
      // equal-access should not be instantiated
      expect(EngineRegistry.get(A11yEngineType.EQUAL_ACCESS)).toBeUndefined();
    });

    it('should cache engine instances', async () => {
      await EngineRegistry.initialize();
      
      const engine1 = await EngineRegistry.getOrInitialize(A11yEngineType.AXE_CORE);
      const engine2 = await EngineRegistry.getOrInitialize(A11yEngineType.AXE_CORE);
      
      // Should return the same instance
      expect(engine1).toBe(engine2);
      
      const stats = EngineRegistry.getStats();
      expect(stats.totalInstances).toBe(1);
    });

    it('should instantiate multiple engines independently', async () => {
      await EngineRegistry.initialize();
      
      const axeEngine = await EngineRegistry.getOrInitialize(A11yEngineType.AXE_CORE);
      const eaEngine = await EngineRegistry.getOrInitialize(A11yEngineType.EQUAL_ACCESS);
      
      expect(axeEngine.type).toBe(A11yEngineType.AXE_CORE);
      expect(eaEngine.type).toBe(A11yEngineType.EQUAL_ACCESS);
      
      const stats = EngineRegistry.getStats();
      expect(stats.totalInstances).toBe(2);
      expect(stats.readyEngines).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown engine type', async () => {
      await EngineRegistry.initialize();
      
      await expect(
        EngineRegistry.getOrInitialize('unknown' as A11yEngineType)
      ).rejects.toThrow("Engine 'unknown' not found in registry");
    });

    it('should provide helpful error message with available engines', async () => {
      await EngineRegistry.initialize();
      
      try {
        await EngineRegistry.getOrInitialize('unknown' as A11yEngineType);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Available engines: axe-core, equal-access');
      }
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all instances and factories', async () => {
      await EngineRegistry.initialize();
      await EngineRegistry.getOrInitialize(A11yEngineType.AXE_CORE);
      
      let stats = EngineRegistry.getStats();
      expect(stats.totalFactories).toBe(2);
      expect(stats.totalInstances).toBe(1);
      
      await EngineRegistry.cleanupAll();
      
      stats = EngineRegistry.getStats();
      expect(stats.totalFactories).toBe(0);
      expect(stats.totalInstances).toBe(0);
    });

    it('should allow re-initialization after cleanup', async () => {
      await EngineRegistry.initialize();
      await EngineRegistry.getOrInitialize(A11yEngineType.AXE_CORE);
      await EngineRegistry.cleanupAll();
      
      // Should be able to initialize again
      await EngineRegistry.initialize();
      const engine = await EngineRegistry.getOrInitialize(A11yEngineType.AXE_CORE);
      
      expect(engine).toBeDefined();
      expect(engine.type).toBe(A11yEngineType.AXE_CORE);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      await EngineRegistry.initialize();
      
      let stats = EngineRegistry.getStats();
      expect(stats.totalFactories).toBe(2);
      expect(stats.totalInstances).toBe(0);
      expect(stats.readyEngines).toBe(0);
      
      await EngineRegistry.getOrInitialize(A11yEngineType.AXE_CORE);
      
      stats = EngineRegistry.getStats();
      expect(stats.totalFactories).toBe(2);
      expect(stats.totalInstances).toBe(1);
      expect(stats.readyEngines).toBe(1);
      expect(stats.instances[0].type).toBe(A11yEngineType.AXE_CORE);
      expect(stats.instances[0].ready).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should support direct engine registration', async () => {
      const mockEngine = {
        type: 'axe-core' as A11yEngineType,
        version: '1.0.0',
        initialize: vi.fn().mockResolvedValue(undefined),
        isReady: vi.fn().mockReturnValue(true),
        run: vi.fn(),
        getRules: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };
      
      EngineRegistry.register(mockEngine);
      
      const engine = EngineRegistry.get(A11yEngineType.AXE_CORE);
      expect(engine).toBe(mockEngine);
    });
  });
});

// Made with Bob
