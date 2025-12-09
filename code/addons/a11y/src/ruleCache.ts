/**
 * Rule Cache Initialization
 *
 * This module handles updating the rule metadata cache for the manager (UI) side
 * with live metadata from the preview side when accessibility checks run.
 */

import type { A11yRuleMetadata } from './rules/types';
import { initializeRuleCache } from './ruleHelpers';

/**
 * Update the rule cache with live metadata from the preview side
 * This populates the cache with complete rule information from the active engine
 */
export function updateRuleCache(rules: A11yRuleMetadata[]): void {
  initializeRuleCache(rules);
  console.log(`[Storybook A11y] Updated rule cache with ${rules.length} rules from preview`);
}

