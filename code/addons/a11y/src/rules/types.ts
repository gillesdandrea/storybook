/** 
 * Storybook A11y Addon - Universal Rule Types
 * Engine-agnostic accessibility rule interfaces
 */

import type { A11yEngineType, A11ySeverity } from '../engines/types';

/**
 * Universal accessibility rule metadata that works across all engines
 * Represents a single accessibility rule with all its metadata
 */
export interface A11yRuleMetadata {
  /** Unique rule identifier (e.g., "color-contrast", "WCAG20_Input_ExplicitLabel") */
  readonly id: string;
  
  /** Engine that provides this rule */
  readonly engine: A11yEngineType;
  
  /** Short, human-readable title for the rule */
  readonly title: string;
  
  /** Detailed description of what the rule checks */
  readonly description: string;
  
  /** Help text explaining how to fix violations */
  readonly help: string;
  
  /** URL to detailed documentation (optional) */
  readonly helpUrl?: string;
  
  /** Categorization tags for filtering and grouping */
  readonly tags: readonly string[];
  
  /** Primary category for this rule */
  readonly category: A11yRuleCategory;
  
  /** Default severity level for this rule */
  readonly defaultSeverity: A11ySeverity;
  
  /** WCAG success criteria this rule relates to (optional) */
  readonly wcagCriteria?: readonly string[];
  
  /** Whether this rule is enabled by default */
  readonly enabledByDefault: boolean;
  
  /** Engine-specific metadata preserved for advanced use cases */
  readonly engineSpecific?: Record<string, unknown>;
}

/**
 * Rule categories that work across engines
 */
export enum A11yRuleCategory {
  COLOR_CONTRAST = 'color-contrast',
  KEYBOARD_NAVIGATION = 'keyboard-navigation',
  ARIA = 'aria',
  FORMS = 'forms',
  IMAGES_MEDIA = 'images-media',
  STRUCTURE = 'structure',
  LINKS_NAVIGATION = 'links-navigation',
  TABLES = 'tables',
  LANGUAGE = 'language',
  BEST_PRACTICES = 'best-practices',
  EXPERIMENTAL = 'experimental',
}

/**
 * Interface for engine-specific rule metadata providers
 * Each accessibility engine implements this to provide its rule information
 */
export interface IA11yRuleProvider {
  /** Engine type this provider supports */
  readonly engineType: A11yEngineType;
  
  /**
   * Get all available rules for this engine
   * @returns Promise resolving to array of rule metadata
   */
  getAllRules(): Promise<A11yRuleMetadata[]>;
  
  /**
   * Get metadata for a specific rule
   * @param ruleId - Rule identifier
   * @returns Rule metadata or undefined if not found
   */
  getRule(ruleId: string): Promise<A11yRuleMetadata | undefined>;
  
  /**
   * Get rules by category
   * @param category - Rule category to filter by
   * @returns Promise resolving to array of matching rules
   */
  getRulesByCategory(category: A11yRuleCategory): Promise<A11yRuleMetadata[]>;
  
  /**
   * Get rules by tags
   * @param tags - Tags to filter by
   * @returns Promise resolving to array of matching rules
   */
  getRulesByTags(tags: string[]): Promise<A11yRuleMetadata[]>;
  
  /**
   * Search rules by text
   * @param query - Search query
   * @returns Promise resolving to array of matching rules
   */
  searchRules(query: string): Promise<A11yRuleMetadata[]>;
}

/**
 * Rule search and filter options
 */
export interface A11yRuleSearchOptions {
  engines?: A11yEngineType[];
  categories?: A11yRuleCategory[];
  tags?: string[];
  severities?: A11ySeverity[];
  wcagCriteria?: string[];
  enabledOnly?: boolean;
}

