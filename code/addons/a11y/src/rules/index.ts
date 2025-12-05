/**
 * Public API for the A11y Rule Abstraction Layer
 * 
 * This module provides a unified interface for accessing accessibility rules
 * from different engines (axe-core, Equal Access, etc.) through a common abstraction.
 */

// Core types
export type {
  A11yRuleMetadata,
  A11yRuleCategory,
  IA11yRuleProvider,
} from './types';

// Registry
export { A11yRuleRegistry } from './registry';

// Providers
export { AxeCoreRuleProvider } from './providers/AxeCoreRuleProvider';
export { EqualAccessRuleProvider } from './providers/EqualAccessRuleProvider';

