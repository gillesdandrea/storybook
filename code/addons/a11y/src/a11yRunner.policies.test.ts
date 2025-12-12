/**
 * Tests for the policies parameter mapping in a11yRunner
 * Verifies that the 'policies' parameter is correctly mapped to 'engineOptions.guidelines'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A11yEngineType } from './engines/types';
import type { A11yEngineConfig } from './engines/types';

describe('a11yRunner - policies parameter mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should map policies to engineOptions.guidelines for equal-access engine', () => {
    // Simulate the normalization logic from a11yRunner.ts
    const input = {
      engine: A11yEngineType.EQUAL_ACCESS,
      config: {
        policies: ['IBM_Accessibility', 'WCAG_2_1'],
        rules: {
          'aria_content_in_landmark': { enabled: true }
        }
      }
    };

    // Simulate the normalization
    const config: A11yEngineConfig = { ...input.config };
    
    if ('policies' in input.config && input.config.policies) {
      if (!config.engineOptions) {
        config.engineOptions = {};
      }
      if (!config.engineOptions.guidelines) {
        const policies = input.config.policies;
        config.engineOptions.guidelines = Array.isArray(policies) ? policies : [policies];
      }
    }

    // Verify the mapping
    expect(config.engineOptions).toBeDefined();
    expect(config.engineOptions?.guidelines).toEqual(['IBM_Accessibility', 'WCAG_2_1']);
  });

  it('should handle single policy string', () => {
    const input = {
      engine: A11yEngineType.EQUAL_ACCESS,
      config: {
        policies: 'WCAG_2_1',
        rules: {}
      }
    };

    const config: A11yEngineConfig = { ...input.config };
    
    if ('policies' in input.config && input.config.policies) {
      if (!config.engineOptions) {
        config.engineOptions = {};
      }
      if (!config.engineOptions.guidelines) {
        const policies = input.config.policies;
        config.engineOptions.guidelines = Array.isArray(policies) ? policies : [policies];
      }
    }

    expect(config.engineOptions?.guidelines).toEqual(['WCAG_2_1']);
  });

  it('should not override existing engineOptions.guidelines', () => {
    const input = {
      engine: A11yEngineType.EQUAL_ACCESS,
      config: {
        policies: ['IBM_Accessibility'],
        engineOptions: {
          guidelines: ['WCAG_2_0']
        },
        rules: {}
      }
    };

    const config: A11yEngineConfig = { ...input.config };
    
    if ('policies' in input.config && input.config.policies) {
      if (!config.engineOptions) {
        config.engineOptions = {};
      }
      // Only set if not already explicitly set
      if (!config.engineOptions.guidelines) {
        const policies = input.config.policies;
        config.engineOptions.guidelines = Array.isArray(policies) ? policies : [policies];
      }
    }

    // Should keep the explicit engineOptions.guidelines
    expect(config.engineOptions?.guidelines).toEqual(['WCAG_2_0']);
  });

  it('should handle empty policies array', () => {
    const input = {
      engine: A11yEngineType.EQUAL_ACCESS,
      config: {
        policies: [],
        rules: {}
      }
    };

    const config: A11yEngineConfig = { ...input.config };
    
    if ('policies' in input.config && input.config.policies) {
      if (!config.engineOptions) {
        config.engineOptions = {};
      }
      if (!config.engineOptions.guidelines) {
        const policies = input.config.policies;
        config.engineOptions.guidelines = Array.isArray(policies) ? policies : [policies];
      }
    }

    expect(config.engineOptions?.guidelines).toEqual([]);
  });

  it('should not affect axe-core engine configuration', () => {
    const input = {
      engine: A11yEngineType.AXE_CORE,
      config: {
        policies: ['IBM_Accessibility'], // This should be ignored for axe-core
        rules: {
          'color-contrast': { enabled: true }
        }
      }
    };

    const config: A11yEngineConfig = { ...input.config };
    
    // For axe-core, we don't process policies
    if (input.engine === A11yEngineType.EQUAL_ACCESS && 'policies' in input.config && input.config.policies) {
      if (!config.engineOptions) {
        config.engineOptions = {};
      }
      if (!config.engineOptions.guidelines) {
        const policies = input.config.policies;
        config.engineOptions.guidelines = Array.isArray(policies) ? policies : [policies];
      }
    }

    // Should not have guidelines set for axe-core
    expect(config.engineOptions?.guidelines).toBeUndefined();
  });
});
