# Rule Abstraction Implementation Plan

## Overview

This document provides a step-by-step implementation plan for the accessibility rule abstraction that eliminates engine-specific dependencies while preserving all features from both axe-core and Equal Access engines.

**Note**: This plan removes backward compatibility layers. The only backward compatibility maintained is the ability to read old axe-core configuration formats.

## Implementation Steps

### Step 1: Create Core Rule Types

**File: `src/rules/types.ts`**

```typescript
/** 
 * Storybook A11y Addon - Universal Rule Types
 * Engine-agnostic accessibility rule interfaces
 */

import type { A11yEngineType, A11ySeverity } from '../engines/types';

/**
 * Universal accessibility rule metadata that works across all engines
 * Captures the superset of features from axe-core and Equal Access
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
 */
export interface IA11yRuleProvider {
  readonly engineType: A11yEngineType;
  
  getAllRules(): Promise<A11yRuleMetadata[]>;
  getRule(ruleId: string): Promise<A11yRuleMetadata | undefined>;
  getRulesByCategory(category: A11yRuleCategory): Promise<A11yRuleMetadata[]>;
  getRulesByTags(tags: string[]): Promise<A11yRuleMetadata[]>;
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
```

### Step 2: Create Unified Rule Registry

**File: `src/rules/registry.ts`**

```typescript
/**
 * Central registry for all accessibility rules across engines
 */
import type { A11yEngineType } from '../engines/types';
import type { 
  A11yRuleMetadata, 
  IA11yRuleProvider, 
  A11yRuleCategory,
  A11yRuleSearchOptions 
} from './types';

export class A11yRuleRegistry {
  private static providers = new Map<A11yEngineType, IA11yRuleProvider>();
  private static ruleCache = new Map<string, A11yRuleMetadata>();
  private static initialized = false;
  
  /**
   * Register a rule provider for an engine
   */
  static registerProvider(provider: IA11yRuleProvider): void {
    this.providers.set(provider.engineType, provider);
    this.ruleCache.clear();
  }
  
  /**
   * Initialize registry with default providers
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }
  
  /**
   * Get all rules from all engines
   */
  static async getAllRules(): Promise<A11yRuleMetadata[]> {
    await this.initialize();
    
    const allRules: A11yRuleMetadata[] = [];
    
    for (const provider of this.providers.values()) {
      try {
        const rules = await provider.getAllRules();
        allRules.push(...rules);
      } catch (error) {
        console.warn(`Failed to get rules from ${provider.engineType}:`, error);
      }
    }
    
    return allRules;
  }
  
  /**
   * Get rule metadata by ID (searches all engines)
   */
  static async getRule(ruleId: string, engine?: A11yEngineType): Promise<A11yRuleMetadata | undefined> {
    const cacheKey = engine ? `${engine}:${ruleId}` : ruleId;
    
    if (this.ruleCache.has(cacheKey)) {
      return this.ruleCache.get(cacheKey);
    }
    
    await this.initialize();
    
    if (engine) {
      const provider = this.providers.get(engine);
      if (provider) {
        const rule = await provider.getRule(ruleId);
        if (rule) {
          this.ruleCache.set(cacheKey, rule);
          return rule;
        }
      }
      return undefined;
    }
    
    for (const provider of this.providers.values()) {
      try {
        const rule = await provider.getRule(ruleId);
        if (rule) {
          this.ruleCache.set(cacheKey, rule);
          return rule;
        }
      } catch (error) {
        console.warn(`Error searching for rule ${ruleId} in ${provider.engineType}:`, error);
      }
    }
    
    return undefined;
  }
  
  /**
   * Get rules by engine
   */
  static async getRulesByEngine(engine: A11yEngineType): Promise<A11yRuleMetadata[]> {
    await this.initialize();
    
    const provider = this.providers.get(engine);
    if (!provider) {
      return [];
    }
    
    try {
      return await provider.getAllRules();
    } catch (error) {
      console.warn(`Failed to get rules from ${engine}:`, error);
      return [];
    }
  }
  
  /**
   * Search rules with advanced filtering
   */
  static async searchRules(query: string, options: A11yRuleSearchOptions = {}): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    
    let filteredRules = allRules;
    
    if (options.engines?.length) {
      filteredRules = filteredRules.filter(rule => 
        options.engines!.includes(rule.engine)
      );
    }
    
    if (options.categories?.length) {
      filteredRules = filteredRules.filter(rule => 
        options.categories!.includes(rule.category)
      );
    }
    
    if (options.tags?.length) {
      filteredRules = filteredRules.filter(rule => 
        options.tags!.some(tag => rule.tags.includes(tag))
      );
    }
    
    if (options.severities?.length) {
      filteredRules = filteredRules.filter(rule => 
        options.severities!.includes(rule.defaultSeverity)
      );
    }
    
    if (options.wcagCriteria?.length) {
      filteredRules = filteredRules.filter(rule => 
        rule.wcagCriteria?.some(criteria => 
          options.wcagCriteria!.includes(criteria)
        )
      );
    }
    
    if (options.enabledOnly) {
      filteredRules = filteredRules.filter(rule => rule.enabledByDefault);
    }
    
    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      filteredRules = filteredRules.filter(rule => 
        rule.id.toLowerCase().includes(searchTerm) ||
        rule.title.toLowerCase().includes(searchTerm) ||
        rule.description.toLowerCase().includes(searchTerm) ||
        rule.help.toLowerCase().includes(searchTerm) ||
        rule.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }
    
    return filteredRules;
  }
  
  /**
   * Get user-friendly title for a rule
   */
  static async getRuleTitle(ruleId: string, engine?: A11yEngineType): Promise<string> {
    const rule = await this.getRule(ruleId, engine);
    return rule?.title || ruleId;
  }
  
  /**
   * Get user-friendly help text for a rule
   */
  static async getRuleHelp(ruleId: string, engine?: A11yEngineType): Promise<string> {
    const rule = await this.getRule(ruleId, engine);
    return rule?.help || rule?.description || `Rule ${ruleId}`;
  }
  
  /**
   * Get rules by category (across all engines)
   */
  static async getRulesByCategory(category: A11yRuleCategory): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    return allRules.filter(rule => rule.category === category);
  }
  
  /**
   * Clear all cached rules
   */
  static clearCache(): void {
    this.ruleCache.clear();
  }
  
  /**
   * Get registry statistics
   */
  static getStats(): {
    totalProviders: number;
    totalRules: number;
    rulesByEngine: Record<string, number>;
  } {
    const stats = {
      totalProviders: this.providers.size,
      totalRules: this.ruleCache.size,
      rulesByEngine: {} as Record<string, number>
    };
    
    for (const rule of this.ruleCache.values()) {
      const engine = rule.engine;
      stats.rulesByEngine[engine] = (stats.rulesByEngine[engine] || 0) + 1;
    }
    
    return stats;
  }
}
```

### Step 3: Create Axe-Core Rule Provider

**File: `src/rules/providers/AxeCoreRuleProvider.ts`**

```typescript
import type { A11yEngineType, A11ySeverity } from '../../engines/types';
import type { A11yRuleMetadata, IA11yRuleProvider, A11yRuleCategory } from '../types';
import { combinedRulesMap } from '../../AccessibilityRuleMaps';

export class AxeCoreRuleProvider implements IA11yRuleProvider {
  readonly engineType: A11yEngineType = 'axe-core' as A11yEngineType;
  
  private axeEngine: any = null;
  private rulesCache: A11yRuleMetadata[] | null = null;
  
  constructor(axeEngine?: any) {
    this.axeEngine = axeEngine;
  }
  
  setAxeEngine(axeEngine: any): void {
    this.axeEngine = axeEngine;
    this.rulesCache = null;
  }
  
  async getAllRules(): Promise<A11yRuleMetadata[]> {
    if (this.rulesCache) {
      return this.rulesCache;
    }
    
    if (!this.axeEngine) {
      console.warn('Axe engine not available for rule provider');
      return [];
    }
    
    try {
      const axeRules = this.axeEngine.getRules();
      this.rulesCache = axeRules.map((rule: any) => this.convertAxeRule(rule));
      return this.rulesCache;
    } catch (error) {
      console.warn('Failed to get axe-core rules:', error);
      return [];
    }
  }
  
  async getRule(ruleId: string): Promise<A11yRuleMetadata | undefined> {
    const allRules = await this.getAllRules();
    return allRules.find(rule => rule.id === ruleId);
  }
  
  async getRulesByCategory(category: A11yRuleCategory): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    return allRules.filter(rule => rule.category === category);
  }
  
  async getRulesByTags(tags: string[]): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    return allRules.filter(rule => 
      tags.some(tag => rule.tags.includes(tag))
    );
  }
  
  async searchRules(query: string): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    const searchTerm = query.toLowerCase();
    
    return allRules.filter(rule => 
      rule.id.toLowerCase().includes(searchTerm) ||
      rule.title.toLowerCase().includes(searchTerm) ||
      rule.description.toLowerCase().includes(searchTerm) ||
      rule.help.toLowerCase().includes(searchTerm)
    );
  }
  
  private convertAxeRule(axeRule: any): A11yRuleMetadata {
    const mapping = combinedRulesMap[axeRule.ruleId];
    
    return {
      id: axeRule.ruleId,
      engine: this.engineType,
      title: mapping?.title || axeRule.ruleId,
      description: mapping?.axeSummary || axeRule.description || axeRule.help,
      help: mapping?.friendlySummary || axeRule.help || axeRule.description,
      helpUrl: axeRule.helpUrl,
      tags: axeRule.tags || [],
      category: this.mapAxeTagsToCategory(axeRule.tags || []),
      defaultSeverity: this.mapAxeImpactToSeverity(axeRule.impact),
      wcagCriteria: this.extractWcagCriteria(axeRule.tags || []),
      enabledByDefault: true,
      engineSpecific: {
        impact: axeRule.impact,
        axeRule: axeRule
      }
    };
  }
  
  private mapAxeTagsToCategory(tags: string[]): A11yRuleCategory {
    if (tags.includes('color')) return A11yRuleCategory.COLOR_CONTRAST;
    if (tags.includes('keyboard')) return A11yRuleCategory.KEYBOARD_NAVIGATION;
    if (tags.includes('aria')) return A11yRuleCategory.ARIA;
    if (tags.includes('forms')) return A11yRuleCategory.FORMS;
    if (tags.includes('images')) return A11yRuleCategory.IMAGES_MEDIA;
    if (tags.includes('structure')) return A11yRuleCategory.STRUCTURE;
    if (tags.includes('links')) return A11yRuleCategory.LINKS_NAVIGATION;
    if (tags.includes('tables')) return A11yRuleCategory.TABLES;
    if (tags.includes('language')) return A11yRuleCategory.LANGUAGE;
    if (tags.includes('experimental')) return A11yRuleCategory.EXPERIMENTAL;
    
    return A11yRuleCategory.BEST_PRACTICES;
  }
  
  private mapAxeImpactToSeverity(impact?: string): A11ySeverity {
    switch (impact) {
      case 'critical':
      case 'serious':
        return 'violation' as A11ySeverity;
      case 'moderate':
        return 'warning' as A11ySeverity;
      case 'minor':
        return 'recommendation' as A11ySeverity;
      default:
        return 'information' as A11ySeverity;
    }
  }
  
  private extractWcagCriteria(tags: string[]): string[] {
    return tags.filter(tag => 
      tag.startsWith('wcag') || 
      tag.includes('wcag') ||
      tag.match(/\d+\.\d+\.\d+/)
    );
  }
}
```

### Step 4: Create Equal Access Rule Provider

**File: `src/rules/providers/EqualAccessRuleProvider.ts`**

```typescript
import type { A11yEngineType, A11ySeverity } from '../../engines/types';
import type { A11yRuleMetadata, IA11yRuleProvider, A11yRuleCategory } from '../types';

export class EqualAccessRuleProvider implements IA11yRuleProvider {
  readonly engineType: A11yEngineType = 'equal-access' as A11yEngineType;
  
  private eaEngine: any = null;
  private rulesCache: A11yRuleMetadata[] | null = null;
  
  constructor(eaEngine?: any) {
    this.eaEngine = eaEngine;
  }
  
  setEqualAccessEngine(eaEngine: any): void {
    this.eaEngine = eaEngine;
    this.rulesCache = null;
  }
  
  async getAllRules(): Promise<A11yRuleMetadata[]> {
    if (this.rulesCache) {
      return this.rulesCache;
    }
    
    if (!this.eaEngine) {
      console.warn('Equal Access engine not available for rule provider');
      return [];
    }
    
    try {
      const ruleIds = this.eaEngine.engine.getRulesIds();
      this.rulesCache = ruleIds.map((ruleId: string) => {
        const rule = this.eaEngine.engine.getRule(ruleId);
        return this.convertEqualAccessRule(ruleId, rule);
      });
      return this.rulesCache;
    } catch (error) {
      console.warn('Failed to get Equal Access rules:', error);
      return [];
    }
  }
  
  async getRule(ruleId: string): Promise<A11yRuleMetadata | undefined> {
    const allRules = await this.getAllRules();
    return allRules.find(rule => rule.id === ruleId);
  }
  
  async getRulesByCategory(category: A11yRuleCategory): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    return allRules.filter(rule => rule.category === category);
  }
  
  async getRulesByTags(tags: string[]): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    return allRules.filter(rule => 
      tags.some(tag => rule.tags.includes(tag))
    );
  }
  
  async searchRules(query: string): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    const searchTerm = query.toLowerCase();
    
    return allRules.filter(rule => 
      rule.id.toLowerCase().includes(searchTerm) ||
      rule.title.toLowerCase().includes(searchTerm) ||
      rule.description.toLowerCase().includes(searchTerm) ||
      rule.help.toLowerCase().includes(searchTerm)
    );
  }
  
  private convertEqualAccessRule(ruleId: string, eaRule: any): A11yRuleMetadata {
    const groupMessage = eaRule?.messages?.['en-US']?.group;
    const detailMessage = eaRule?.messages?.['en-US']?.[0];
    
    return {
      id: ruleId,
      engine: this.engineType,
      title: this.generateTitle(ruleId),
      description: groupMessage || detailMessage || ruleId,
      help: detailMessage || groupMessage || `Rule ${ruleId} guidance`,
      helpUrl: this.generateHelpUrl(ruleId),
      tags: eaRule?.category ? [eaRule.category] : [],
      category: this.mapEqualAccessCategory(eaRule?.category),
      defaultSeverity: this.mapEqualAccessPolicy(eaRule?.policy),
      wcagCriteria: this.extractWcagFromRuleId(ruleId),
      enabledByDefault: true,
      engineSpecific: {
        category: eaRule?.category,
        policy: eaRule?.policy,
        equalAccessRule: eaRule
      }
    };
  }
  
  private generateTitle(ruleId: string): string {
    return ruleId
      .replace(/^WCAG\d+_/, '')
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\s+/g, ' ');
  }
  
  private generateHelpUrl(ruleId: string): string {
    return `https://unpkg.com/accessibility-checker-engine@4.0.9/help/en-US/${ruleId}.html`;
  }
  
  private mapEqualAccessCategory(category?: string): A11yRuleCategory {
    if (!category) return A11yRuleCategory.BEST_PRACTICES;
    
    switch (category.toLowerCase()) {
      case 'aria': return A11yRuleCategory.ARIA;
      case 'forms': return A11yRuleCategory.FORMS;
      case 'images': return A11yRuleCategory.IMAGES_MEDIA;
      case 'structure': return A11yRuleCategory.STRUCTURE;
      case 'navigation': return A11yRuleCategory.LINKS_NAVIGATION;
      case 'tables': return A11yRuleCategory.TABLES;
      case 'keyboard': return A11yRuleCategory.KEYBOARD_NAVIGATION;
      case 'color': return A11yRuleCategory.COLOR_CONTRAST;
      default: return A11yRuleCategory.BEST_PRACTICES;
    }
  }
  
  private mapEqualAccessPolicy(policy?: string): A11ySeverity {
    switch (policy) {
      case 'VIOLATION': return 'violation' as A11ySeverity;
      case 'RECOMMENDATION': return 'warning' as A11ySeverity;
      case 'INFORMATION': return 'information' as A11ySeverity;
      default: return 'information' as A11ySeverity;
    }
  }
  
  private extractWcagFromRuleId(ruleId: string): string[] {
    const wcagMatch = ruleId.match(/WCAG(\d+)_/);
    if (wcagMatch) {
      const version = wcagMatch[1];
      return [`WCAG ${version.charAt(0)}.${version.slice(1)}`];
    }
    return [];
  }
}
```

### Step 5: Update Engine Adapters

**Update: `src/engines/axe-core/AxeCoreAdapter.ts`**

```typescript
// Add imports
import { A11yRuleRegistry } from '../../rules/registry';
import { AxeCoreRuleProvider } from '../../rules/providers/AxeCoreRuleProvider';

export class AxeCoreAdapter implements IA11yEngine {
  // ... existing code ...
  
  private ruleProvider: AxeCoreRuleProvider;
  
  constructor() {
    this.ruleProvider = new AxeCoreRuleProvider();
  }
  
  async initialize(): Promise<void> {
    // ... existing initialization code ...
    
    // Register rule provider after axe is loaded
    this.ruleProvider.setAxeEngine(this.axe);
    A11yRuleRegistry.registerProvider(this.ruleProvider);
  }
}
```

**Update: `src/engines/equal-access/EqualAccessAdapter.ts`**

```typescript
// Add imports
import { A11yRuleRegistry } from '../../rules/registry';
import { EqualAccessRuleProvider } from '../../rules/providers/EqualAccessRuleProvider';

export class EqualAccessAdapter implements IA11yEngine {
  // ... existing code ...
  
  private ruleProvider: EqualAccessRuleProvider;
  
  constructor() {
    this.ruleProvider = new EqualAccessRuleProvider();
  }
  
  async initialize(): Promise<void> {
    // ... existing initialization code ...
    
    // Register rule provider after checker is loaded
    this.ruleProvider.setEqualAccessEngine(this.checker);
    A11yRuleRegistry.registerProvider(this.ruleProvider);
  }
}
```

### Step 6: Update Components

**Update Report Components:**

```typescript
// Replace old imports
import { A11yRuleRegistry } from '../rules/registry';

// In component
const [ruleMetadata, setRuleMetadata] = useState<A11yRuleMetadata | null>(null);

useEffect(() => {
  A11yRuleRegistry.getRule(issue.ruleId, issue.engine)
    .then(setRuleMetadata);
}, [issue.ruleId, issue.engine]);

// Use metadata
const title = ruleMetadata?.title || issue.ruleId;
const help = ruleMetadata?.help || issue.help;
const helpUrl = ruleMetadata?.helpUrl || issue.helpUrl;
```

### Step 7: Configuration Compatibility Layer

**File: `src/config/compatibility.ts`**

```typescript
/**
 * Configuration compatibility layer
 * Handles reading old axe-core configuration formats
 */
import type { A11yEngineConfig } from '../engines/types';

/**
 * Convert legacy axe-core configuration to new format
 */
export function convertLegacyAxeConfig(legacyConfig: any): A11yEngineConfig {
  const config: A11yEngineConfig = {
    enabled: true,
    rules: {},
    engineOptions: {}
  };
  
  // Handle old axe-core options format
  if (legacyConfig.options) {
    config.engineOptions = legacyConfig.options;
  }
  
  // Handle old rules format
  if (legacyConfig.rules) {
    for (const [ruleId, ruleConfig] of Object.entries(legacyConfig.rules)) {
      config.rules![ruleId] = {
        enabled: (ruleConfig as any).enabled !== false,
        options: (ruleConfig as any)
      };
    }
  }
  
  return config;
}

/**
 * Detect if configuration is in legacy format
 */
export function isLegacyAxeConfig(config: any): boolean {
  return config && (
    config.options !== undefined ||
    (config.rules && !config.engineOptions)
  );
}
```

### Step 8: Create Public API

**File: `src/rules/index.ts`**

```typescript
// Export public API
export type { 
  A11yRuleMetadata, 
  IA11yRuleProvider, 
  A11yRuleSearchOptions 
} from './types';

export { A11yRuleCategory } from './types';
export { A11yRuleRegistry } from './registry';

// Export providers for advanced use cases
export { AxeCoreRuleProvider } from './providers/AxeCoreRuleProvider';
export { EqualAccessRuleProvider } from './providers/EqualAccessRuleProvider';
```

## Files to Remove

After implementation is complete and tested:

1. **`src/axeRuleMappingHelper.ts`** - Replaced by `A11yRuleRegistry`
2. Keep **`src/AccessibilityRuleMaps.ts`** - Used by `AxeCoreRuleProvider` for enhanced metadata

## Migration Timeline

### Phase 1: Foundation (Week 1)
- [ ] Create core types and interfaces
- [ ] Implement A11yRuleRegistry
- [ ] Create rule providers for both engines
- [ ] Add configuration compatibility layer

### Phase 2: Integration (Week 2)
- [ ] Update engine adapters to register providers
- [ ] Update all components to use new registry
- [ ] Remove old helper imports
- [ ] Add comprehensive tests

### Phase 3: Cleanup (Week 3)
- [ ] Remove `axeRuleMappingHelper.ts`
- [ ] Update documentation
- [ ] Optimize performance and caching
- [ ] Final testing and validation

## Benefits Achieved

1. **Clean Abstraction**: No engine-specific code in components
2. **Feature Complete**: All features from both engines preserved
3. **Configuration Compatible**: Old axe-core configs still work
4. **Type Safe**: Full TypeScript support
5. **Performance**: Intelligent caching
6. **Extensible**: Easy to add new engines

This implementation provides a clean abstraction that eliminates backward compatibility layers while maintaining the ability to read legacy axe-core configurations.