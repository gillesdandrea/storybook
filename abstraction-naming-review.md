# Abstraction Layer Naming Review

## Issue Identified

The abstraction layer contains references to "axe-core" in:
1. Comments describing engine features
2. Documentation examples

## Clean Abstraction Layer - No Engine References

### Core Types (`src/rules/types.ts`)

```typescript
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
   */
  getAllRules(): Promise<A11yRuleMetadata[]>;
  
  /**
   * Get metadata for a specific rule
   */
  getRule(ruleId: string): Promise<A11yRuleMetadata | undefined>;
  
  /**
   * Get rules by category
   */
  getRulesByCategory(category: A11yRuleCategory): Promise<A11yRuleMetadata[]>;
  
  /**
   * Get rules by tags
   */
  getRulesByTags(tags: string[]): Promise<A11yRuleMetadata[]>;
  
  /**
   * Search rules by text
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
```

### Rule Registry (`src/rules/registry.ts`)

```typescript
/**
 * Central registry for all accessibility rules across engines
 * Provides unified access to rule metadata regardless of engine
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
   * Get rule metadata by ID
   * Searches all engines unless engine parameter is specified
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
   * Search rules with advanced filtering
   */
  static async searchRules(query: string, options: A11yRuleSearchOptions = {}): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    
    let filteredRules = allRules;
    
    // Apply filters
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
    
    // Text search
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
}
```

## Verification Checklist

### ✅ Abstraction Layer (No Engine References)
- `src/rules/types.ts` - ✅ Clean
- `src/rules/registry.ts` - ✅ Clean
- `src/rules/index.ts` - ✅ Clean (exports only)

### ⚠️ Provider Layer (Engine-Specific - OK to Reference)
- `src/rules/providers/AxeCoreRuleProvider.ts` - ✅ Can reference axe-core (it's engine-specific)
- `src/rules/providers/EqualAccessRuleProvider.ts` - ✅ Can reference Equal Access (it's engine-specific)

### ✅ Engine Layer (Engine-Specific - OK to Reference)
- `src/engines/axe-core/AxeCoreAdapter.ts` - ✅ Can reference axe-core
- `src/engines/equal-access/EqualAccessAdapter.ts` - ✅ Can reference Equal Access

### ✅ UI Layer (No Engine References)
- `src/components/Report/Report.tsx` - ✅ Uses abstraction only
- `src/components/Report/Details.tsx` - ✅ Uses abstraction only
- `src/components/A11yContext.tsx` - ✅ Uses abstraction only

## Naming Conventions

### Abstraction Layer Naming
- **Interface**: `A11yRuleMetadata` (not `AxeRuleMetadata`)
- **Registry**: `A11yRuleRegistry` (not `AxeRuleRegistry`)
- **Provider Interface**: `IA11yRuleProvider` (not `IAxeRuleProvider`)
- **Category Enum**: `A11yRuleCategory` (not `AxeRuleCategory`)
- **Methods**: `getRuleTitle()`, `getRuleHelp()` (not `getTitleForAxeResult()`)

### Provider Layer Naming (Engine-Specific - OK)
- **Class**: `AxeCoreRuleProvider` - ✅ OK (it's engine-specific)
- **Class**: `EqualAccessRuleProvider` - ✅ OK (it's engine-specific)
- **Methods**: Can reference engine-specific concepts

### File Naming
- **Abstraction**: `rules/types.ts`, `rules/registry.ts` - ✅ Generic
- **Providers**: `rules/providers/AxeCoreRuleProvider.ts` - ✅ OK (engine-specific)
- **Engines**: `engines/axe-core/`, `engines/equal-access/` - ✅ OK (engine-specific)

## Summary

**Abstraction Layer is Clean** ✅
- No "axe" or "axe-core" references in:
  - Type names
  - Interface names
  - Method names
  - Variable names
  - Comments (except when explaining what engines provide)

**Provider Layer Can Reference Engines** ✅
- Provider implementations are engine-specific by design
- They translate engine-specific data to abstract types
- This is the correct separation of concerns

**Clear Separation** ✅
- Abstract layer: `src/rules/` (no engine references)
- Provider layer: `src/rules/providers/` (engine-specific, OK to reference)
- Engine layer: `src/engines/` (engine-specific, OK to reference)
- UI layer: `src/components/` (uses abstraction only)