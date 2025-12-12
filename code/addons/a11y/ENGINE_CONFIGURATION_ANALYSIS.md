# A11y Addon Engine Configuration Analysis

## Executive Summary

This document provides a comprehensive analysis of configuration capabilities for both **axe-core** and **IBM Equal Access** engines in the Storybook A11y addon, comparing their configuration parameters, identifying gaps, and providing recommendations for enhanced support.

**Status Update**: ✅ **Critical Fix Implemented** - The `policies` parameter mapping issue has been resolved. The `policies` parameter now correctly maps to `engineOptions.guidelines` for IBM Equal Access engine.

## Current Configuration in preview.tsx

### Axe-core Configuration (Commented Out)
```typescript
a11y: {
  engine: 'axe-core',
  config: {
    rules: [
      { id: 'color-contrast', enabled: true },
      { id: 'landmark-one-main', enabled: true }
    ],
  },
}
```

### IBM Equal Access Configuration (Active)
```typescript
a11y: {
  engine: 'equal-access',
  config: {
    policies: ['IBM_Accessibility'],
    // Other available policies: 'WCAG_2_1', 'WCAG_2_0'
    rules: [
      { id: 'aria_content_in_landmark', enabled: true }
    ]
  },
}
```

---

## Axe-core Configuration Capabilities

### 1. Core Configuration Options

#### **runOnly** - Selective Rule Execution
```typescript
{
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']
  }
}
// OR
{
  runOnly: {
    type: 'rule',
    values: ['color-contrast', 'image-alt', 'label']
  }
}
// OR simple array
{
  runOnly: ['ruleId1', 'ruleId2']
}
```

#### **rules** - Individual Rule Configuration
```typescript
{
  rules: {
    'color-contrast': { 
      enabled: false 
    },
    'valid-lang': { 
      enabled: true 
    },
    'meta-viewport': {
      enabled: true,
      options: {
        scaleMinimum: 3
      }
    }
  }
}
```

#### **resultTypes** - Filter Result Categories
```typescript
{
  resultTypes: ['violations', 'incomplete', 'passes', 'inapplicable']
}
```

#### **xpath** - Enable XPath Selectors
```typescript
{
  xpath: true  // Adds XPath selectors to results
}
```

#### **absolutePaths** - Use Absolute Paths
```typescript
{
  absolutePaths: true  // Use absolute paths instead of relative
}
```

#### **iframes** - Include iframes in Testing
```typescript
{
  iframes: true  // Test content within iframes
}
```

#### **preload** - Asset Preloading
```typescript
{
  preload: true  // Boolean for default preloading
}
// OR
{
  preload: { 
    assets: ['cssom'],  // Specific assets to preload
    timeout: 50000      // Timeout in milliseconds
  }
}
```

#### **performanceTimer** - Performance Metrics
```typescript
{
  performanceTimer: true  // Enable timing data collection
}
```

#### **reporter** - Custom Reporters
```typescript
{
  reporter: 'v2'  // Use v2 reporter format
}
// OR
{
  reporter: 'no-passes'  // Exclude passes from results
}
```

### 2. Global Configuration (via axe.configure())

#### **branding** - Custom Branding
```typescript
axe.configure({
  branding: 'my-app'
})
```

#### **locale** - Internationalization
```typescript
axe.configure({
  locale: {
    lang: 'de',
    rules: {
      accesskeys: {
        help: 'Der Wert des accesskey-Attributes muss einzigartig sein.'
      }
    },
    checks: {
      abstractrole: {
        fail: 'Abstrakte ARIA-Rollen dürfen nicht direkt verwendet werden.'
      }
    }
  }
})
```

#### **noHtml** - Disable HTML Output
```typescript
axe.configure({
  noHtml: true  // Exclude HTML snippets from results
})
```

#### **allowedOrigins** - Cross-origin Configuration
```typescript
axe.configure({
  allowedOrigins: ['<same_origin>', 'https://trusted-domain.com']
})
```

#### **disableOtherRules** - Exclusive Rule Sets
```typescript
axe.configure({
  rules: [
    { id: 'color-contrast', enabled: true },
    { id: 'label', enabled: true }
  ],
  disableOtherRules: true  // Disable all rules except specified
})
```

#### **checks** - Custom Check Definitions
```typescript
axe.configure({
  checks: [
    {
      id: 'custom-color-contrast',
      evaluate: function(node, options) {
        const bgColor = window.getComputedStyle(node).backgroundColor;
        const color = window.getComputedStyle(node).color;
        return checkContrast(bgColor, color) >= options.ratio;
      },
      options: { ratio: 4.5 }
    }
  ]
})
```

#### **rules** - Custom Rule Definitions
```typescript
axe.configure({
  rules: [
    {
      id: 'custom-rule',
      selector: '.custom-component',
      enabled: true,
      tags: ['best-practice'],
      any: ['custom-color-contrast'],
      metadata: {
        description: 'Custom component must meet accessibility standards',
        help: 'Ensure custom components are accessible'
      }
    }
  ]
})
```

### 3. Rule-Specific Options

#### **has-lang / valid-lang** - Language Attribute Configuration
```typescript
{
  rules: {
    'has-lang': {
      enabled: true,
      options: {
        attributes: ['lang', 'xml:lang', 'hreflang']
      }
    },
    'valid-lang': {
      enabled: true,
      options: {
        attributes: ['lang', 'xml:lang'],
        value: ['en', 'es', 'fr']  // Valid language codes
      }
    }
  }
}
```

#### **meta-viewport / meta-viewport-large** - Viewport Configuration
```typescript
{
  rules: {
    'meta-viewport-large': {
      enabled: true,
      options: {
        scaleMinimum: 3,
        lowerBound: 1
      }
    },
    'meta-viewport': {
      enabled: true,
      options: {
        scaleMinimum: 3
      }
    }
  }
}
```

---

## IBM Equal Access Configuration Capabilities

### 1. Core Configuration Options

#### **policies** (Guidelines) - Ruleset Selection
```typescript
{
  policies: ['IBM_Accessibility']  // Default
}
// OR
{
  policies: ['WCAG_2_1']  // WCAG 2.1 compliance
}
// OR
{
  policies: ['WCAG_2_0']  // WCAG 2.0 compliance
}
// OR multiple policies
{
  policies: ['IBM_Accessibility', 'WCAG_2_1']
}
```

**Available Policies:**
- `IBM_Accessibility` - IBM's comprehensive accessibility guidelines
- `WCAG_2_1` - W3C WCAG 2.1 Level A & AA
- `WCAG_2_0` - W3C WCAG 2.0 Level A & AA

#### **reportLevels** - Result Filtering by Severity
```typescript
{
  reportLevels: ['violation', 'potentialviolation']  // Default
}
// OR include recommendations
{
  reportLevels: ['violation', 'potentialviolation', 'recommendation']
}
// OR include all levels
{
  reportLevels: ['violation', 'potentialviolation', 'recommendation', 'potentialrecommendation', 'manual']
}
```

**Available Report Levels:**
- `violation` - Definite accessibility violations (included by default)
- `potentialviolation` - Potential violations requiring review (included by default)
- `recommendation` - Best practice recommendations
- `potentialrecommendation` - Potential recommendations
- `manual` - Issues requiring manual verification

**Default:** `['violation', 'potentialviolation']`

#### **rules** - Individual Rule Configuration
```typescript
{
  rules: [
    { id: 'aria_content_in_landmark', enabled: true },
    { id: 'skip_main_exists', enabled: false }
  ]
}
```

### 2. Implementation Details from Codebase

Based on `EqualAccessAdapter.ts`, the current implementation:

```typescript
// From prepareGuidelineIds() method
private prepareGuidelineIds(config: A11yEngineConfig): string[] | undefined {
  // Check if engine-specific options specify guidelines
  if (config.engineOptions?.guidelines) {
    const guidelines = config.engineOptions.guidelines;
    return Array.isArray(guidelines)
      ? (guidelines as string[])
      : [String(guidelines)];
  }
  
  // Default to IBM_Accessibility guideline
  return ['IBM_Accessibility'];
}
```

**Current Usage Pattern:**
```typescript
a11y: {
  engine: 'equal-access',
  config: {
    engineOptions: {
      guidelines: ['IBM_Accessibility', 'WCAG_2_1']  // Via engineOptions
    },
    rules: {
      'aria_content_in_landmark': { enabled: true }
    }
  }
}
```

### 3. IBM Equal Access Engine Features

From the implementation analysis:

- **Version**: 4.0.9 (accessibility-checker-engine)
- **Global Object**: `window.ace.Checker`
- **Report Format**: Comprehensive with policy/confidence levels
- **Rule Metadata**: Includes NLS (Natural Language Support) for internationalization
- **Help URLs**: Hosted on unpkg CDN with fragment-based issue details

**Issue Classification:**
- **Policy Levels**: `VIOLATION`, `RECOMMENDATION`, `INFORMATION`
- **Confidence Levels**: `PASS`, `FAIL`, `POTENTIAL`, `MANUAL`

---

## Configuration Comparison Matrix

| Feature | Axe-core | IBM Equal Access | Current Support |
|---------|----------|------------------|-----------------|
| **Rule Enable/Disable** | ✅ Yes | ✅ Yes | ✅ Both |
| **Rule-Specific Options** | ✅ Yes | ❌ Limited | ⚠️ Axe only |
| **Tag-Based Filtering** | ✅ Yes | ❌ No | ⚠️ Axe only |
| **Policy/Guideline Selection** | ⚠️ Via tags | ✅ Yes | ✅ Equal Access |
| **Custom Rules** | ✅ Yes | ❌ No | ⚠️ Axe only |
| **Custom Checks** | ✅ Yes | ❌ No | ⚠️ Axe only |
| **XPath Selectors** | ✅ Yes | ❌ No | ⚠️ Axe only |
| **Iframe Testing** | ✅ Yes | ✅ Yes | ✅ Both |
| **Result Filtering** | ✅ Yes | ⚠️ Post-process | ⚠️ Axe only |
| **Performance Timing** | ✅ Yes | ✅ Yes | ✅ Both |
| **Internationalization** | ✅ Yes | ✅ Yes | ✅ Both |
| **Custom Reporters** | ✅ Yes | ❌ No | ⚠️ Axe only |
| **Asset Preloading** | ✅ Yes | ❌ No | ⚠️ Axe only |
| **Absolute Paths** | ✅ Yes | ❌ No | ⚠️ Axe only |
| **HTML Output Control** | ✅ Yes | ❌ No | ⚠️ Axe only |
| **Cross-origin Config** | ✅ Yes | ❌ No | ⚠️ Axe only |

---

## Identified Gaps & Recommendations

### 1. **Critical: Unified Policy/Guideline Configuration**

**Gap**: The `policies` parameter in preview.tsx is not properly mapped to `engineOptions.guidelines`.

**Current Issue:**
```typescript
// This doesn't work as expected:
a11y: {
  engine: 'equal-access',
  config: {
    policies: ['IBM_Accessibility'],  // ❌ Not recognized
  }
}
```

**Recommendation**: Add a configuration normalizer that maps `policies` to `engineOptions.guidelines`:

```typescript
// Proposed implementation in a11yRunner.ts or config normalizer
function normalizeEqualAccessConfig(config: A11yEngineConfig): A11yEngineConfig {
  if (config.policies) {
    return {
      ...config,
      engineOptions: {
        ...config.engineOptions,
        guidelines: config.policies
      }
    };
  }
  return config;
}
```

### 2. **High Priority: Enhanced Equal Access Configuration Interface**

**Recommendation**: Extend the configuration type to support Equal Access-specific options:

```typescript
// Proposed type extension
export interface A11yEngineConfig {
  enabled?: boolean;
  rules?: {
    [ruleId: string]: {
      enabled: boolean;
      options?: Record<string, unknown>;
    };
  };
  engineOptions?: Record<string, unknown>;
  
  // Equal Access specific (new)
  policies?: string[];  // Alias for engineOptions.guidelines
  
  // Axe-core specific (new)
  runOnly?: {
    type: 'tag' | 'rule';
    values: string[];
  } | string[];
  resultTypes?: Array<'violations' | 'incomplete' | 'passes' | 'inapplicable'>;
  xpath?: boolean;
  absolutePaths?: boolean;
  iframes?: boolean;
  preload?: boolean | { assets: string[]; timeout: number };
  performanceTimer?: boolean;
  reporter?: string;
}
```

### 3. **Medium Priority: Rule Options Support for Equal Access**

**Gap**: IBM Equal Access doesn't support per-rule options like axe-core does.

**Recommendation**: Document this limitation clearly and provide workarounds:

```typescript
// For Equal Access, rule options are not supported
// Use policy selection instead:
a11y: {
  engine: 'equal-access',
  config: {
    policies: ['WCAG_2_1'],  // Use stricter policy
    rules: {
      'specific-rule': { enabled: false }  // Can only enable/disable
    }
  }
}
```

### 4. **Medium Priority: Result Filtering Enhancement**

**Gap**: Equal Access doesn't have built-in result type filtering like axe-core's `resultTypes`.

**Recommendation**: Implement post-processing filter in the adapter:

```typescript
// In EqualAccessAdapter.convertResults()
private convertResults(
  report: EqualAccessReport,
  executionTime: number,
  rulesConfig?: RulesConfig,
  resultTypes?: string[]  // New parameter
): A11yReport {
  const normalized = this.normalizeReport(report, executionTime, rulesConfig);
  
  // Apply result type filtering if specified
  if (resultTypes) {
    return {
      ...normalized,
      violations: resultTypes.includes('violations') ? normalized.violations : [],
      warnings: resultTypes.includes('warnings') ? normalized.warnings : [],
      passes: resultTypes.includes('passes') ? normalized.passes : [],
      incomplete: resultTypes.includes('incomplete') ? normalized.incomplete : [],
    };
  }
  
  return normalized;
}
```

### 5. **Low Priority: XPath Support for Equal Access**

**Gap**: Equal Access doesn't provide XPath selectors in results.

**Recommendation**: Generate XPath selectors in the adapter when needed:

```typescript
// Add to EqualAccessAdapter
private generateXPath(element: Element): string {
  // Implementation to generate XPath from element
  // This would be called in convertNode() method
}
```

### 6. **Documentation: Configuration Examples**

**Recommendation**: Create comprehensive examples showing equivalent configurations:

```typescript
// Example 1: WCAG 2.1 AA Compliance
// Axe-core approach:
a11y: {
  engine: 'axe-core',
  config: {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21aa']
    }
  }
}

// Equal Access approach:
a11y: {
  engine: 'equal-access',
  config: {
    policies: ['WCAG_2_1']
  }
}

// Example 2: Disable Specific Rules
// Both engines:
a11y: {
  engine: 'axe-core', // or 'equal-access'
  config: {
    rules: {
      'color-contrast': { enabled: false },
      'skip-link': { enabled: false }
    }
  }
}

// Example 3: Performance-focused Configuration
// Axe-core only:
a11y: {
  engine: 'axe-core',
  config: {
    performanceTimer: true,
    resultTypes: ['violations'],  // Only violations
    preload: false  // Skip preloading for speed
  }
}
```

---

## Implementation Priorities

### Phase 1: Critical (Immediate) ✅ COMPLETED
1. ✅ **Fix `policies` parameter mapping** - Added normalizer in `a11yRunner.ts` (lines 179-192) to map `policies` to `engineOptions.guidelines`
2. ✅ **Update type definitions** - Extended `A11yEngineConfig` interface in `types.ts` with `policies` parameter
3. ✅ **Update documentation** - Updated `CONFIGURATION.md` and `preview.tsx` with correct usage examples
4. ✅ **Add tests** - Created `a11yRunner.policies.test.ts` to verify the mapping works correctly

**Implementation Details:**
- The normalizer checks if `policies` exists in the config for Equal Access engine
- It converts single string to array format for consistency
- It only sets `engineOptions.guidelines` if not already explicitly set (preserves user overrides)
- The fix is backward compatible - existing configurations continue to work

### Phase 2: High Priority (Short-term)
1. **Add result type filtering** - Implement post-processing filter for Equal Access
2. **Enhance configuration validation** - Add validation for engine-specific options
3. **Create migration guide** - Help users migrate between engines

### Phase 3: Medium Priority (Medium-term)
1. **Add XPath generation** - Generate XPath selectors for Equal Access results
2. **Implement configuration presets** - Provide common configuration templates
3. **Add configuration UI** - Visual configuration builder in Storybook UI

### Phase 4: Low Priority (Long-term)
1. **Custom rule support** - Explore custom rule capabilities for Equal Access
2. **Advanced filtering** - Implement sophisticated result filtering
3. **Performance optimization** - Optimize configuration processing

---

## Backward Compatibility Considerations

### Maintaining Compatibility

1. **Preserve existing configurations**: All current configurations must continue to work
2. **Graceful degradation**: Unsupported options should be ignored with warnings
3. **Clear migration path**: Provide tools/docs for migrating configurations

### Breaking Changes to Avoid

- ❌ Changing the structure of `rules` configuration
- ❌ Removing support for array-based rule configuration
- ❌ Changing default behavior without opt-in

### Safe Additions

- ✅ Adding new optional configuration parameters
- ✅ Adding configuration aliases (e.g., `policies` → `engineOptions.guidelines`)
- ✅ Adding post-processing filters
- ✅ Adding validation and warnings

---

## Conclusion

### Summary of Findings

1. **Axe-core** offers more granular configuration options, including custom rules, checks, and advanced filtering
2. **IBM Equal Access** provides policy-based configuration with strong WCAG compliance focus
3. **Current implementation** supports basic configuration for both engines but lacks unified interface
4. **Key gap**: The `policies` parameter needs proper mapping to work correctly

### Recommended Actions

1. **Immediate**: Fix the `policies` parameter mapping issue
2. **Short-term**: Enhance type definitions and documentation
3. **Medium-term**: Add result filtering and XPath support for Equal Access
4. **Long-term**: Create unified configuration interface with engine-specific extensions

### Configuration Best Practices

1. **Use `policies` for Equal Access** guideline selection
2. **Use `runOnly` for axe-core** tag-based filtering
3. **Use `rules` object format** for both engines (not array)
4. **Document engine-specific options** clearly in your configuration
5. **Test configurations** with both engines when possible

---

## Appendix: Configuration Schema

### Complete Configuration Schema (Proposed)

```typescript
interface A11yConfiguration {
  // Engine selection
  engine: 'axe-core' | 'equal-access';
  
  // Common configuration
  config: {
    // Rule configuration (both engines)
    rules?: {
      [ruleId: string]: {
        enabled: boolean;
        options?: Record<string, unknown>;  // Axe-core only
      };
    };
    
    // Equal Access specific
    policies?: string[];  // ['IBM_Accessibility', 'WCAG_2_1', 'WCAG_2_0']
    
    // Axe-core specific
    runOnly?: {
      type: 'tag' | 'rule';
      values: string[];
    } | string[];
    resultTypes?: Array<'violations' | 'incomplete' | 'passes' | 'inapplicable'>;
    xpath?: boolean;
    absolutePaths?: boolean;
    iframes?: boolean;
    preload?: boolean | { assets: string[]; timeout: number };
    performanceTimer?: boolean;
    reporter?: string;
    
    // Advanced (both engines via engineOptions)
    engineOptions?: {
      // Equal Access
      guidelines?: string[];  // Same as policies
      
      // Axe-core
      branding?: string;
      locale?: Record<string, unknown>;
      noHtml?: boolean;
      allowedOrigins?: string[];
      disableOtherRules?: boolean;
      checks?: Array<Record<string, unknown>>;
      customRules?: Array<Record<string, unknown>>;
    };
  };
}
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-12  
**Author**: Storybook A11y Addon Analysis