# A11y Rule Abstraction Layer - Implementation Summary

## Overview

This document summarizes the implementation of a unified rule abstraction layer for the Storybook A11y addon. The abstraction provides a common interface for accessing accessibility rules from different engines (axe-core, IBM Equal Access) without sacrificing any engine-specific features.

## Design Principles

1. **No Rule Mapping**: Each engine maintains its own rule set with native IDs
2. **Common Abstraction**: Unified interface captures all features from both engines
3. **Engine-Agnostic Naming**: No engine-specific terminology in the abstraction layer
4. **Feature Preservation**: All engine-specific features accessible via `engineSpecific` property
5. **Easy Mocking**: Simple interface for testing and development

## Architecture

### Core Components

```
code/addons/a11y/src/rules/
├── types.ts                    # Core abstraction types
├── registry.ts                 # Central rule registry
├── index.ts                    # Public API exports
└── providers/
    ├── AxeCoreRuleProvider.ts      # Axe-core implementation
    └── EqualAccessRuleProvider.ts  # Equal Access implementation
```

### Type System

#### A11yRuleMetadata

The core abstraction interface that represents a rule from any engine:

```typescript
interface A11yRuleMetadata {
  // Core identification
  id: string; // Native rule ID from engine
  engine: A11yEngineType; // Which engine this rule comes from

  // Display information
  title: string; // Human-readable title
  description: string; // Short description
  help: string; // Detailed help text
  helpUrl: string; // Link to documentation

  // Categorization
  tags: string[]; // Searchable tags
  category: A11yRuleCategory; // Standardized category

  // Configuration
  defaultSeverity: A11ySeverity; // Default severity level
  wcagCriteria: string[]; // WCAG success criteria
  enabledByDefault: boolean; // Whether rule runs by default

  // Engine-specific data
  engineSpecific: Record<string, any>; // Preserve all native features
}
```

#### A11yRuleCategory

Standardized categories that map to both engines:

- `aria` - ARIA attributes and roles
- `color-contrast` - Color and contrast issues
- `forms` - Form controls and labels
- `images-media` - Images, video, audio
- `keyboard-navigation` - Keyboard accessibility
- `links-navigation` - Links and navigation
- `structure` - Document structure
- `tables` - Table accessibility
- `text-alternatives` - Alternative text
- `best-practices` - General best practices

### Provider Pattern

Each engine implements the `IA11yRuleProvider` interface:

```typescript
interface IA11yRuleProvider {
  readonly engineType: A11yEngineType;

  getAllRules(): Promise<A11yRuleMetadata[]>;
  getRule(ruleId: string): Promise<A11yRuleMetadata | undefined>;
  getRulesByCategory(category: A11yRuleCategory): Promise<A11yRuleMetadata[]>;
  getRulesByTags(tags: string[]): Promise<A11yRuleMetadata[]>;
  searchRules(query: string): Promise<A11yRuleMetadata[]>;
}
```

### Registry Pattern

The `A11yRuleRegistry` provides centralized access to rules from all engines:

```typescript
class A11yRuleRegistry {
  registerProvider(provider: IA11yRuleProvider): void;
  getAllRules(): Promise<A11yRuleMetadata[]>;
  getRule(ruleId: string, engine?: A11yEngineType): Promise<A11yRuleMetadata | undefined>;
  getRuleTitle(ruleId: string, engine?: A11yEngineType): Promise<string>;
  getRuleHelp(ruleId: string, engine?: A11yEngineType): Promise<string>;
  searchRules(query: string, engine?: A11yEngineType): Promise<A11yRuleMetadata[]>;
}
```

## Engine Integration

### Axe-Core Provider

**Features Preserved:**

- All axe-core rule metadata (tags, impact, help, helpUrl)
- Enhanced metadata from `AccessibilityRuleMaps.ts`
- WCAG criteria mapping
- Category classification

**Implementation Details:**

- Uses `axe.getRules()` for base rule data
- Enhances with `combinedRulesMap` for additional metadata
- Maps axe-core tags to standardized categories
- Preserves original axe rule object in `engineSpecific.axeRule`

### Equal Access Provider

**Features Preserved:**

- IBM Equal Access rule metadata (messages, policy, category)
- Localized messages (en-US)
- Help URL generation with issue context
- WCAG version extraction from rule IDs

**Implementation Details:**

- Uses `engine.getRulesIds()` and `engine.getRule()`
- Generates human-readable titles from rule IDs
- Maps Equal Access categories to standardized categories
- Preserves original Equal Access rule in `engineSpecific.equalAccessRule`

## Usage Examples

### Basic Usage

```typescript
import { A11yRuleRegistry, AxeCoreRuleProvider } from '@storybook/addon-a11y/rules';

// Create registry
const registry = new A11yRuleRegistry();

// Register providers
const axeProvider = new AxeCoreRuleProvider(axeInstance);
registry.registerProvider(axeProvider);

// Get all rules
const allRules = await registry.getAllRules();

// Get specific rule
const rule = await registry.getRule('color-contrast');

// Search rules
const colorRules = await registry.searchRules('color');
```

### Engine Adapter Integration

```typescript
// In AxeCoreAdapter
class AxeCoreAdapter implements IA11yEngine {
  private ruleProvider: AxeCoreRuleProvider | null = null;

  async initialize(): Promise<void> {
    // ... load axe-core ...
    this.ruleProvider = new AxeCoreRuleProvider(this.axe);
  }

  getRuleProvider(): AxeCoreRuleProvider | null {
    return this.ruleProvider;
  }
}
```

### UI Component Usage

```typescript
// Get rule metadata for display
const rule = await registry.getRule(issue.ruleId, issue.engine);

// Display in UI
<div>
  <h3>{rule.title}</h3>
  <p>{rule.description}</p>
  <a href={rule.helpUrl}>Learn more</a>
  <div>Tags: {rule.tags.join(', ')}</div>
</div>;
```

## Migration Path

### Phase 1: Core Abstraction (✅ Complete)

- [x] Define `A11yRuleMetadata` interface
- [x] Create `A11yRuleRegistry` class
- [x] Implement `AxeCoreRuleProvider`
- [x] Implement `EqualAccessRuleProvider`
- [x] Integrate providers with engine adapters

### Phase 2: UI Integration (Pending)

- [ ] Update `Report.tsx` to use registry
- [ ] Update `Details.tsx` to use registry
- [ ] Update `A11yContext.tsx` to use registry
- [ ] Remove `axeRuleMappingHelper.ts`

### Phase 3: Testing (Pending)

- [ ] Unit tests for providers
- [ ] Unit tests for registry
- [ ] Integration tests with engines
- [ ] UI component tests

## Benefits

### For Developers

- **Type Safety**: Full TypeScript support with no `any` types in public API
- **Consistency**: Same interface for all engines
- **Discoverability**: Easy to find and use rules
- **Extensibility**: Simple to add new engines

### For Users

- **Better UX**: Consistent rule information display
- **Rich Metadata**: Access to all rule details
- **Search**: Find rules by name, description, tags
- **Documentation**: Direct links to help resources

### For Maintainers

- **Clean Architecture**: Clear separation of concerns
- **No Mapping Overhead**: Each engine maintains its own rules
- **Feature Preservation**: No loss of engine-specific capabilities
- **Easy Testing**: Mockable interfaces

## Engine-Specific Features

### Axe-Core Specific

Accessible via `engineSpecific.axeRule`:

- `impact`: critical | serious | moderate | minor
- `actIds`: ACT rule IDs
- `metadata`: Additional axe metadata

### Equal Access Specific

Accessible via `engineSpecific.equalAccessRule`:

- `policy`: VIOLATION | RECOMMENDATION | INFORMATION
- `category`: Original Equal Access category
- `reasonId`: Specific reason identifier
- `msgArgs`: Message template arguments

## Future Enhancements

1. **Rule Configuration UI**: Visual interface for enabling/disabling rules
2. **Custom Rules**: Support for user-defined rules
3. **Rule Profiles**: Predefined rule sets (WCAG 2.1 AA, Section 508, etc.)
4. **Rule Analytics**: Track which rules find the most issues
5. **Multi-Engine Comparison**: Compare rule coverage across engines

## Conclusion

The rule abstraction layer provides a clean, type-safe, and extensible foundation for working with accessibility rules from multiple engines. It preserves all engine-specific features while providing a consistent interface for common operations, making it easy to build rich UI experiences and maintain the codebase.
