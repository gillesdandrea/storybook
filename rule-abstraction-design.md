# Accessibility Rule Abstraction Design

## Problem Statement

The current accessibility addon has engine-specific rule handling that lacks proper abstraction:

1. `axeRuleMappingHelper.ts` directly references axe-core types
2. `AccessibilityRuleMaps.ts` contains only axe-core rule mappings
3. No unified interface for rules across different engines
4. Components are tightly coupled to axe-core rule structure

## Analysis of Engine Rule Features

### Axe-Core Rule Structure
```typescript
// From axe-core Result interface
{
  id: string;           // Rule identifier
  description: string;  // Human-readable description
  help: string;         // Help text
  helpUrl: string;      // Documentation URL
  impact: string;       // critical|serious|moderate|minor
  tags: string[];       // Categorization tags
  nodes: NodeResult[];  // Affected DOM nodes
}
```

### Equal Access Rule Structure
```typescript
// From IBM Equal Access issue
{
  ruleId: string;       // Rule identifier
  message: string;      // Localized message
  reasonId: string;     // Specific reason identifier
  category: string;     // Single category
  value: [policy, confidence]; // [VIOLATION|RECOMMENDATION|INFORMATION, PASS|FAIL|POTENTIAL|MANUAL]
  snippet: string;      // HTML snippet
  path: { xpath: string, dom: string }; // Element path
}
```

## Proposed Unified Rule Abstraction

### Core Rule Interface

```typescript
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
  /** Color and contrast issues */
  COLOR_CONTRAST = 'color-contrast',
  
  /** Keyboard navigation and focus */
  KEYBOARD_NAVIGATION = 'keyboard-navigation',
  
  /** ARIA attributes and roles */
  ARIA = 'aria',
  
  /** Form labels and controls */
  FORMS = 'forms',
  
  /** Images and media */
  IMAGES_MEDIA = 'images-media',
  
  /** Headings and document structure */
  STRUCTURE = 'structure',
  
  /** Links and navigation */
  LINKS_NAVIGATION = 'links-navigation',
  
  /** Tables */
  TABLES = 'tables',
  
  /** Language and internationalization */
  LANGUAGE = 'language',
  
  /** Best practices */
  BEST_PRACTICES = 'best-practices',
  
  /** Experimental or deprecated rules */
  EXPERIMENTAL = 'experimental',
}
```

### Rule Provider Interface

```typescript
/**
 * Interface for engine-specific rule metadata providers
 * Each engine implements this to provide its rule information
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
```

### Unified Rule Registry

```typescript
/**
 * Central registry for all accessibility rules across engines
 * Provides unified access to rule metadata regardless of engine
 */
export class A11yRuleRegistry {
  private static providers = new Map<A11yEngineType, IA11yRuleProvider>();
  private static ruleCache = new Map<string, A11yRuleMetadata>();
  private static initialized = false;
  
  /**
   * Register a rule provider for an engine
   */
  static registerProvider(provider: IA11yRuleProvider): void;
  
  /**
   * Get all rules from all engines
   */
  static async getAllRules(): Promise<A11yRuleMetadata[]>;
  
  /**
   * Get rule metadata by ID (searches all engines)
   */
  static async getRule(ruleId: string): Promise<A11yRuleMetadata | undefined>;
  
  /**
   * Get rules by engine
   */
  static async getRulesByEngine(engine: A11yEngineType): Promise<A11yRuleMetadata[]>;
  
  /**
   * Get rules by category (across all engines)
   */
  static async getRulesByCategory(category: A11yRuleCategory): Promise<A11yRuleMetadata[]>;
  
  /**
   * Search rules across all engines
   */
  static async searchRules(query: string): Promise<A11yRuleMetadata[]>;
  
  /**
   * Get user-friendly title for a rule
   */
  static async getRuleTitle(ruleId: string, engine?: A11yEngineType): Promise<string>;
  
  /**
   * Get user-friendly help text for a rule
   */
  static async getRuleHelp(ruleId: string, engine?: A11yEngineType): Promise<string>;
}
```

## Engine-Specific Implementations

### Axe-Core Rule Provider

```typescript
export class AxeCoreRuleProvider implements IA11yRuleProvider {
  readonly engineType = A11yEngineType.AXE_CORE;
  
  async getAllRules(): Promise<A11yRuleMetadata[]> {
    // Get rules from axe-core engine
    const axeRules = await this.getAxeRules();
    
    // Convert to unified format using existing rule mappings
    return axeRules.map(rule => this.convertAxeRule(rule));
  }
  
  private convertAxeRule(axeRule: any): A11yRuleMetadata {
    // Use existing combinedRulesMap for enhanced metadata
    const mapping = combinedRulesMap[axeRule.ruleId];
    
    return {
      id: axeRule.ruleId,
      engine: A11yEngineType.AXE_CORE,
      title: mapping?.title || axeRule.ruleId,
      description: mapping?.axeSummary || axeRule.description,
      help: mapping?.friendlySummary || axeRule.help,
      helpUrl: axeRule.helpUrl,
      tags: axeRule.tags || [],
      category: this.mapAxeTagsToCategory(axeRule.tags),
      defaultSeverity: this.mapAxeImpactToSeverity(axeRule.impact),
      wcagCriteria: this.extractWcagCriteria(axeRule.tags),
      enabledByDefault: true,
      engineSpecific: {
        impact: axeRule.impact,
        axeRule: axeRule
      }
    };
  }
  
  private mapAxeTagsToCategory(tags: string[]): A11yRuleCategory {
    // Map axe-core tags to unified categories
    if (tags.includes('color')) return A11yRuleCategory.COLOR_CONTRAST;
    if (tags.includes('keyboard')) return A11yRuleCategory.KEYBOARD_NAVIGATION;
    if (tags.includes('aria')) return A11yRuleCategory.ARIA;
    // ... more mappings
    return A11yRuleCategory.BEST_PRACTICES;
  }
}
```

### Equal Access Rule Provider

```typescript
export class EqualAccessRuleProvider implements IA11yRuleProvider {
  readonly engineType = A11yEngineType.EQUAL_ACCESS;
  
  async getAllRules(): Promise<A11yRuleMetadata[]> {
    // Get rules from Equal Access engine
    const eaRules = await this.getEqualAccessRules();
    
    return eaRules.map(rule => this.convertEqualAccessRule(rule));
  }
  
  private convertEqualAccessRule(eaRule: any): A11yRuleMetadata {
    return {
      id: eaRule.ruleId,
      engine: A11yEngineType.EQUAL_ACCESS,
      title: this.generateTitle(eaRule.ruleId),
      description: eaRule.messages?.['en-US']?.group || eaRule.ruleId,
      help: eaRule.messages?.['en-US']?.0 || `Rule ${eaRule.ruleId} guidance`,
      helpUrl: this.generateHelpUrl(eaRule.ruleId),
      tags: eaRule.category ? [eaRule.category] : [],
      category: this.mapEqualAccessCategory(eaRule.category),
      defaultSeverity: this.mapEqualAccessPolicy(eaRule.policy),
      wcagCriteria: this.extractWcagFromRuleId(eaRule.ruleId),
      enabledByDefault: true,
      engineSpecific: {
        category: eaRule.category,
        policy: eaRule.policy,
        equalAccessRule: eaRule
      }
    };
  }
  
  private mapEqualAccessCategory(category: string): A11yRuleCategory {
    // Map Equal Access categories to unified categories
    switch (category?.toLowerCase()) {
      case 'aria': return A11yRuleCategory.ARIA;
      case 'forms': return A11yRuleCategory.FORMS;
      case 'images': return A11yRuleCategory.IMAGES_MEDIA;
      // ... more mappings
      default: return A11yRuleCategory.BEST_PRACTICES;
    }
  }
}
```

## Migration Strategy

### Phase 1: Create New Abstraction Layer
1. Create `src/rules/` directory with new interfaces
2. Implement rule providers for both engines
3. Create unified rule registry
4. Maintain backward compatibility

### Phase 2: Update Components
1. Update components to use `A11yRuleRegistry` instead of direct axe mappings
2. Replace `axeRuleMappingHelper.ts` usage with registry calls
3. Update UI to show engine-agnostic rule information

### Phase 3: Cleanup
1. Mark old files as deprecated
2. Remove `axeRuleMappingHelper.ts`
3. Refactor `AccessibilityRuleMaps.ts` to be part of AxeCoreRuleProvider

## Benefits of This Abstraction

### 1. Engine Agnostic
- Components work with any accessibility engine
- Easy to add new engines in the future
- Consistent rule metadata across engines

### 2. Feature Complete
- Captures all features from both axe-core and Equal Access
- No loss of functionality during migration
- Engine-specific data preserved for advanced use cases

### 3. Enhanced User Experience
- Unified rule categorization and search
- Consistent help text and documentation links
- Better rule discovery and filtering

### 4. Maintainable
- Clear separation of concerns
- Engine-specific logic isolated in providers
- Easy to test and mock

### 5. Extensible
- Easy to add new rule metadata fields
- Support for custom rule providers
- Plugin architecture for third-party engines

## File Structure

```
src/
├── rules/
│   ├── types.ts                    # Core rule interfaces
│   ├── registry.ts                 # A11yRuleRegistry implementation
│   ├── providers/
│   │   ├── AxeCoreRuleProvider.ts  # Axe-core rule provider
│   │   └── EqualAccessRuleProvider.ts # Equal Access rule provider
│   └── index.ts                    # Public exports
├── engines/
│   ├── axe-core/
│   │   └── AxeCoreAdapter.ts       # Updated to use rule registry
│   └── equal-access/
│       └── EqualAccessAdapter.ts   # Updated to use rule registry
└── components/
    └── ...                         # Updated to use A11yRuleRegistry
```

## Usage Examples

### Getting Rule Information
```typescript
// Get user-friendly title for any rule from any engine
const title = await A11yRuleRegistry.getRuleTitle('color-contrast');

// Get help text for a rule
const help = await A11yRuleRegistry.getRuleHelp('WCAG20_Input_ExplicitLabel');

// Search rules across all engines
const colorRules = await A11yRuleRegistry.searchRules('color');

// Get rules by category
const ariaRules = await A11yRuleRegistry.getRulesByCategory(A11yRuleCategory.ARIA);
```

### Component Integration
```typescript
// In Report component
const ruleMetadata = await A11yRuleRegistry.getRule(issue.ruleId);
const title = ruleMetadata?.title || issue.ruleId;
const help = ruleMetadata?.help || issue.help;
const helpUrl = ruleMetadata?.helpUrl || issue.helpUrl;
```

This abstraction provides a clean, extensible foundation that works with both engines while preserving all their unique features and capabilities.