/******************************************************************************
 * Storybook A11y Addon - Parameters
 * Configuration parameters for accessibility testing
 *****************************************************************************/

import type { A11yEngineType, A11yEngineConfig } from './engines/types';

/**
 * Configuration parameters for the a11y addon
 */
export interface A11yParameters {
  /**
   * Disable accessibility testing entirely
   * @default false
   */
  disable?: boolean;

  /**
   * Test behavior mode
   * - 'off': Don't run tests
   * - 'todo': Run tests but only show warnings
   * - 'error': Run tests and fail on violations
   * @default 'todo'
   */
  test?: 'off' | 'todo' | 'error';

  /**
   * Accessibility engine to use
   * @default 'axe-core'
   */
  engine?: A11yEngineType;

  /**
   * Configuration for the selected engine
   */
  config?: A11yEngineConfig;

  /**
   * Context for accessibility testing
   * Specifies which parts of the DOM to test
   */
  context?: 
    | string 
    | string[] 
    | Node 
    | Node[] 
    | {
        include?: string | string[] | Node | Node[];
        exclude?: string | string[] | Node | Node[];
      };

  /**
   * @deprecated Use config.engineOptions instead
   * Legacy axe-core options for backward compatibility
   */
  options?: Record<string, unknown>;

  /**
   * @deprecated This parameter is no longer supported
   * Use context.include instead
   */
  element?: never;
}

