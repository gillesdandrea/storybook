/**
 * Rule Cache Initialization
 * 
 * This module handles initialization of the rule metadata cache for the manager (UI) side.
 * Since the manager doesn't have direct access to engine adapters, we initialize the cache
 * with axe-core rules using the existing AccessibilityRuleMaps data.
 */

import { combinedRulesMap } from './AccessibilityRuleMaps';
import type { A11yEngineType, A11ySeverity } from './engines/types';
import type { A11yRuleMetadata, A11yRuleCategory } from './rules/types';
import { initializeRuleCache } from './ruleHelpers';

/**
 * Map axe-core tags to standardized categories
 */
function mapAxeTagsToCategory(tags: string[]): A11yRuleCategory {
  // Check for specific category indicators in tags
  if (tags.some(t => t.includes('aria'))) return 'aria' as A11yRuleCategory;
  if (tags.some(t => t.includes('color'))) return 'color-contrast' as A11yRuleCategory;
  if (tags.some(t => t.includes('forms') || t.includes('label'))) return 'forms' as A11yRuleCategory;
  if (tags.some(t => t.includes('image') || t.includes('img'))) return 'images-media' as A11yRuleCategory;
  if (tags.some(t => t.includes('keyboard'))) return 'keyboard-navigation' as A11yRuleCategory;
  if (tags.some(t => t.includes('link') || t.includes('navigation'))) return 'links-navigation' as A11yRuleCategory;
  if (tags.some(t => t.includes('structure') || t.includes('heading') || t.includes('landmark'))) return 'structure' as A11yRuleCategory;
  if (tags.some(t => t.includes('table'))) return 'tables' as A11yRuleCategory;
  if (tags.some(t => t.includes('text-alternative') || t.includes('alt'))) return 'text-alternatives' as A11yRuleCategory;
  
  return 'best-practices' as A11yRuleCategory;
}

/**
 * Map axe-core impact to severity
 */
function mapImpactToSeverity(impact?: string): 'violation' | 'warning' | 'recommendation' | 'information' {
  switch (impact) {
    case 'critical':
    case 'serious':
      return 'violation';
    case 'moderate':
      return 'warning';
    case 'minor':
      return 'recommendation';
    default:
      return 'information';
  }
}

/**
 * Extract WCAG criteria from tags
 */
function extractWcagCriteria(tags: string[]): string[] {
  return tags
    .filter(tag => tag.startsWith('wcag'))
    .map(tag => {
      // Convert wcag2aa, wcag21aa, wcag143 to readable format
      const match = tag.match(/wcag(\d)(\d+)/);
      if (match) {
        const [, major, minor] = match;
        return `WCAG ${major}.${minor.split('').join('.')}`;
      }
      return tag.toUpperCase();
    });
}

/**
 * Initialize the rule cache with axe-core rules from AccessibilityRuleMaps
 * This provides immediate access to rule metadata on the manager side
 */
export function initializeAxeCoreRuleCache(): void {
  const rules: A11yRuleMetadata[] = Object.entries(combinedRulesMap).map(([ruleId, ruleData]) => ({
    id: ruleId,
    engine: 'axe-core' as A11yEngineType,
    title: ruleData.title || ruleId,
    description: ruleData.friendlySummary || ruleData.title || ruleId,
    help: ruleData.friendlySummary || ruleData.title || `Rule ${ruleId} guidance`,
    helpUrl: `https://dequeuniversity.com/rules/axe/4.2/${ruleId}`,
    tags: [], // Tags not available in AccessibilityRuleMaps
    category: 'best-practices' as A11yRuleCategory, // Default category
    defaultSeverity: 'information' as A11ySeverity,
    wcagCriteria: [],
    enabledByDefault: true,
    engineSpecific: {
      axeSummary: ruleData.axeSummary,
      friendlySummary: ruleData.friendlySummary,
    },
  }));

  initializeRuleCache(rules);
  console.log(`[Storybook A11y] Initialized rule cache with ${rules.length} axe-core rules`);
}

/**
 * Update the rule cache with live metadata from the preview side
 * This enhances the cache with complete rule information from the active engine
 */
export function updateRuleCache(rules: A11yRuleMetadata[]): void {
  initializeRuleCache(rules);
  console.log(`[Storybook A11y] Updated rule cache with ${rules.length} rules from preview`);
}

/**
 * Check if we should initialize the cache
 * Only initialize once per session
 */
let cacheInitialized = false;

export function ensureRuleCacheInitialized(): void {
  if (!cacheInitialized) {
    initializeAxeCoreRuleCache();
    cacheInitialized = true;
  }
}

// Made with Bob
