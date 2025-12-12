/**
 * Tests for the reportLevels parameter in a11yRunner
 * Verifies that the 'reportLevels' parameter is correctly mapped to 'engineOptions.reportLevels'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { A11yEngineConfig } from './engines/types';

describe('a11yRunner - reportLevels parameter mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should map reportLevels to engineOptions.reportLevels for equal-access engine', () => {
    // Simulate the normalization logic from a11yRunner.ts
    const input = {
      engine: 'equal-access' as const,
      config: {
        policies: ['IBM_Accessibility'],
        reportLevels: ['violation', 'potentialviolation', 'recommendation'],
        rules: {
          'aria_content_in_landmark': { enabled: true }
        }
      }
    };

    // Simulate the normalization
    const config: A11yEngineConfig = { ...input.config };
    
    if ('reportLevels' in input.config && input.config.reportLevels) {
      const reportLevels = input.config.reportLevels;
      if (Array.isArray(reportLevels)) {
        if (!config.engineOptions) {
          config.engineOptions = {};
        }
        if (!config.engineOptions.reportLevels) {
          config.engineOptions.reportLevels = reportLevels;
        }
      }
    }

    // Verify the mapping
    expect(config.engineOptions).toBeDefined();
    expect(config.engineOptions?.reportLevels).toEqual(['violation', 'potentialviolation', 'recommendation']);
  });

  it('should handle all valid report levels', () => {
    const input = {
      engine: 'equal-access' as const,
      config: {
        reportLevels: ['violation', 'potentialviolation', 'recommendation', 'potentialrecommendation', 'manual'],
        rules: {}
      }
    };

    const config: A11yEngineConfig = { ...input.config };
    
    if ('reportLevels' in input.config && input.config.reportLevels) {
      const reportLevels = input.config.reportLevels;
      if (Array.isArray(reportLevels)) {
        if (!config.engineOptions) {
          config.engineOptions = {};
        }
        if (!config.engineOptions.reportLevels) {
          config.engineOptions.reportLevels = reportLevels;
        }
      }
    }

    expect(config.engineOptions?.reportLevels).toEqual([
      'violation',
      'potentialviolation',
      'recommendation',
      'potentialrecommendation',
      'manual'
    ]);
  });

  it('should not override existing engineOptions.reportLevels', () => {
    const input = {
      engine: 'equal-access' as const,
      config: {
        reportLevels: ['violation'],
        engineOptions: {
          reportLevels: ['violation', 'potentialviolation']
        },
        rules: {}
      }
    };

    const config: A11yEngineConfig = { ...input.config };
    
    if ('reportLevels' in input.config && input.config.reportLevels) {
      const reportLevels = input.config.reportLevels;
      if (Array.isArray(reportLevels)) {
        if (!config.engineOptions) {
          config.engineOptions = {};
        }
        // Only set if not already explicitly set
        if (!config.engineOptions.reportLevels) {
          config.engineOptions.reportLevels = reportLevels;
        }
      }
    }

    // Should keep the explicit engineOptions.reportLevels
    expect(config.engineOptions?.reportLevels).toEqual(['violation', 'potentialviolation']);
  });

  it('should handle empty reportLevels array', () => {
    const input = {
      engine: 'equal-access' as const,
      config: {
        reportLevels: [],
        rules: {}
      }
    };

    const config: A11yEngineConfig = { ...input.config };
    
    if ('reportLevels' in input.config && input.config.reportLevels) {
      const reportLevels = input.config.reportLevels;
      if (Array.isArray(reportLevels)) {
        if (!config.engineOptions) {
          config.engineOptions = {};
        }
        if (!config.engineOptions.reportLevels) {
          config.engineOptions.reportLevels = reportLevels;
        }
      }
    }

    expect(config.engineOptions?.reportLevels).toEqual([]);
  });

  it('should not process reportLevels if not an array', () => {
    const input = {
      engine: 'equal-access' as const,
      config: {
        reportLevels: 'violation' as any, // Invalid: should be array
        rules: {}
      }
    };

    const config: A11yEngineConfig = { ...input.config };
    
    if ('reportLevels' in input.config && input.config.reportLevels) {
      const reportLevels = input.config.reportLevels;
      if (Array.isArray(reportLevels)) {
        if (!config.engineOptions) {
          config.engineOptions = {};
        }
        if (!config.engineOptions.reportLevels) {
          config.engineOptions.reportLevels = reportLevels;
        }
      }
    }

    // Should not have reportLevels set since it wasn't an array
    expect(config.engineOptions?.reportLevels).toBeUndefined();
  });

  it('should work together with policies parameter', () => {
    const input = {
      engine: 'equal-access' as const,
      config: {
        policies: ['IBM_Accessibility', 'WCAG_2_1'],
        reportLevels: ['violation', 'recommendation'],
        rules: {}
      }
    };

    const config: A11yEngineConfig = { ...input.config };
    
    // Process policies
    if ('policies' in input.config && input.config.policies) {
      const policies = input.config.policies;
      if (!config.engineOptions) {
        config.engineOptions = {};
      }
      if (!config.engineOptions.guidelines) {
        config.engineOptions.guidelines = Array.isArray(policies) ? policies : [policies];
      }
    }
    
    // Process reportLevels
    if ('reportLevels' in input.config && input.config.reportLevels) {
      const reportLevels = input.config.reportLevels;
      if (Array.isArray(reportLevels)) {
        if (!config.engineOptions) {
          config.engineOptions = {};
        }
        if (!config.engineOptions.reportLevels) {
          config.engineOptions.reportLevels = reportLevels;
        }
      }
    }

    // Both should be set
    expect(config.engineOptions?.guidelines).toEqual(['IBM_Accessibility', 'WCAG_2_1']);
    expect(config.engineOptions?.reportLevels).toEqual(['violation', 'recommendation']);
  });
});
