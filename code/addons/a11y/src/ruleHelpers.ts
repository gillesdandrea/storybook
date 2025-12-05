/**
 * Rule Helper Functions
 * 
 * These functions provide access to rule metadata for UI components.
 * They work with EnhancedResult objects from engine adapters.
 * 
 * The helpers support two modes:
 * 1. Legacy mode: Uses AccessibilityRuleMaps.ts directly (synchronous)
 * 2. Registry mode: Uses A11yRuleRegistry for richer metadata (requires initialization)
 */

import { combinedRulesMap } from './AccessibilityRuleMaps';
import type { A11yRuleMetadata } from './rules/types';
import type { EnhancedResult } from './types';

/**
 * Rule metadata cache for synchronous access
 * Populated by initializeRuleCache() from the registry
 */
let ruleMetadataCache: Map<string, A11yRuleMetadata> = new Map();

/**
 * Initialize the rule metadata cache from a registry
 * This should be called once when the registry is available
 * 
 * @param rules - Array of rule metadata from the registry
 */
export function initializeRuleCache(rules: A11yRuleMetadata[]): void {
  ruleMetadataCache = new Map(rules.map(rule => [rule.id, rule]));
  console.log(`[Storybook A11y] Rule cache initialized with ${rules.length} rules`);
}

/**
 * Clear the rule metadata cache
 */
export function clearRuleCache(): void {
  ruleMetadataCache.clear();
}

/**
 * Get rule metadata from cache or fallback to legacy maps
 * 
 * @param ruleId - The rule ID to look up
 * @returns Rule metadata or undefined
 */
function getRuleMetadata(ruleId: string): A11yRuleMetadata | undefined {
  return ruleMetadataCache.get(ruleId);
}

/**
 * Get the display title for a rule result
 *
 * Priority:
 * 1. Engine-specific title (Equal Access stores title here)
 * 2. Registry cache (if initialized)
 * 3. AccessibilityRuleMaps (legacy)
 * 4. Rule ID (fallback)
 */
export const getRuleTitle = (result: EnhancedResult): string => {
  console.log('[ruleHelpers getRuleTitle] Processing result:', {
    id: result.id,
    hasEngineSpecific: !!(result as any).engineSpecific,
    engineSpecificTitle: (result as any).engineSpecific?.title,
    description: result.description
  });

  // Check if result has engine-specific title (Equal Access stores it here)
  if ((result as any).engineSpecific?.title) {
    console.log('[ruleHelpers getRuleTitle] ✓ Using engineSpecific.title:', (result as any).engineSpecific.title);
    return (result as any).engineSpecific.title;
  }
  
  // Try registry cache
  const metadata = getRuleMetadata(result.id);
  if (metadata) {
    console.log('[ruleHelpers getRuleTitle] ✓ Using registry cache title:', metadata.title);
    return metadata.title;
  }
  
  // Fallback to legacy maps
  const legacyTitle = combinedRulesMap[result.id]?.title || result.id;
  console.log('[ruleHelpers getRuleTitle] ✓ Using legacy/fallback:', legacyTitle);
  return legacyTitle;
};

/**
 * Get a friendly summary/description for a rule result
 * 
 * Priority:
 * 1. Registry cache (if initialized)
 * 2. AccessibilityRuleMaps (legacy)
 * 3. Result description (fallback)
 */
export const getRuleSummary = (result: EnhancedResult): string | undefined => {
  // Try registry cache first
  const metadata = getRuleMetadata(result.id);
  if (metadata) {
    return metadata.description;
  }
  
  // Fallback to legacy maps
  return combinedRulesMap[result.id]?.friendlySummary || result.description;
};

/**
 * Get the help URL for a rule result
 * 
 * Priority:
 * 1. Registry cache (if initialized)
 * 2. Result helpUrl (fallback)
 */
export const getRuleHelpUrl = (result: EnhancedResult): string | undefined => {
  // Try registry cache first
  const metadata = getRuleMetadata(result.id);
  if (metadata) {
    return metadata.helpUrl;
  }
  
  // Fallback to result
  return result.helpUrl;
};

/**
 * Get the help text for a rule result
 * 
 * Priority:
 * 1. Registry cache (if initialized)
 * 2. Result help (fallback)
 */
export const getRuleHelp = (result: EnhancedResult): string | undefined => {
  // Try registry cache first
  const metadata = getRuleMetadata(result.id);
  if (metadata) {
    return metadata.help;
  }
  
  // Fallback to result
  return result.help;
};

/**
 * Get all available metadata for a rule result
 * Returns undefined if not in cache
 */
export const getRuleMetadataForResult = (result: EnhancedResult): A11yRuleMetadata | undefined => {
  return getRuleMetadata(result.id);
};

/**
 * Check if the rule cache is initialized
 */
export const isRuleCacheInitialized = (): boolean => {
  return ruleMetadataCache.size > 0;
};

// Legacy exports for backward compatibility
export const getTitleForAxeResult = getRuleTitle;
export const getFriendlySummaryForAxeResult = getRuleSummary;

