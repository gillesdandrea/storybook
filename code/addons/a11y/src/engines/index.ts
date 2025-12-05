/** Storybook A11y Addon - Engine Exports Public API for accessibility engines */

// Core types
export type {
  IA11yEngine,
  A11yContext,
  A11yEngineConfig,
  A11yReport,
  A11yIssue,
  A11yIssueNode,
} from './types';

export { A11yEngineType, A11ySeverity, A11yConfidence } from './types';

// Engine Registry
export { EngineRegistry } from './EngineRegistry';

// Engine Adapters
export { AxeCoreAdapter } from './axe-core/AxeCoreAdapter';
export { EqualAccessAdapter } from './equal-access/EqualAccessAdapter';

