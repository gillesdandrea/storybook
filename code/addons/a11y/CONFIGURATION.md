# A11y Addon Configuration Guide

## Rule Configuration

The a11y addon supports two configuration formats for rules:

### Object Format (Recommended)

```typescript
a11y: {
  engine: 'equal-access', // or 'axe-core'
  config: {
    rules: {
      'skip_main_exists': { enabled: false },
      'color-contrast': { enabled: true },
    }
  }
}
```

### Array Format (Legacy, Auto-converted)

```typescript
a11y: {
  engine: 'equal-access', // or 'axe-core'
  config: {
    rules: [
      { id: 'skip_main_exists', enabled: false },
      { id: 'color-contrast', enabled: true },
    ]
  }
}
```

Both formats are supported and will work identically. The array format is automatically converted to the object format internally.

## Engine-Specific Configuration

### Equal Access

The Equal Access engine supports policy-based configuration using the `policies` parameter and result filtering using the `reportLevels` parameter:

```typescript
a11y: {
  engine: 'equal-access',
  config: {
    // Specify which accessibility policies/guidelines to test against
    policies: ['IBM_Accessibility'], // or 'WCAG_2_1', 'WCAG_2_0'
    
    // Filter results by report level (optional)
    reportLevels: ['violation', 'potentialviolation'],
    
    rules: {
      'skip_main_exists': { enabled: false }
    }
  }
}
```

**Available Policies:**
- `'IBM_Accessibility'` - IBM's comprehensive accessibility guidelines (default)
- `'WCAG_2_1'` - W3C WCAG 2.1 Level A & AA
- `'WCAG_2_0'` - W3C WCAG 2.0 Level A & AA

You can also specify multiple policies:

```typescript
a11y: {
  engine: 'equal-access',
  config: {
    policies: ['IBM_Accessibility', 'WCAG_2_1'],
    rules: {
      'skip_main_exists': { enabled: false }
    }
  }
}
```

**Available Report Levels:**
- `'violation'` - Definite accessibility violations (included by default)
- `'potentialviolation'` - Potential violations that need review (included by default)
- `'recommendation'` - Best practice recommendations
- `'potentialrecommendation'` - Potential recommendations
- `'manual'` - Issues requiring manual verification

**Default:** `['violation', 'potentialviolation']`

Example with custom report levels:

```typescript
a11y: {
  engine: 'equal-access',
  config: {
    policies: ['IBM_Accessibility'],
    // Include all types of issues
    reportLevels: ['violation', 'potentialviolation', 'recommendation', 'potentialrecommendation', 'manual'],
    rules: {
      'skip_main_exists': { enabled: false }
    }
  }
}
```

**Note:** The `policies` and `reportLevels` parameters are automatically mapped to `engineOptions` internally. Both approaches work identically:

```typescript
// User-friendly approach (recommended)
config: {
  policies: ['IBM_Accessibility'],
  reportLevels: ['violation', 'potentialviolation']
}

// Direct approach (also works)
config: {
  engineOptions: {
    guidelines: ['IBM_Accessibility'],
    reportLevels: ['violation', 'potentialviolation']
  }
}
```

### Axe-core

```typescript
a11y: {
  engine: 'axe-core',
  config: {
    rules: [
      { id: 'color-contrast', enabled: false }
    ]
  }
}
```

## How It Works

When you provide rules in array format like:

```typescript
rules: [{ id: 'skip_main_exists', enabled: false }];
```

The addon automatically converts it to:

```typescript
rules: {
  'skip_main_exists': { enabled: false }
}
```

This ensures consistent behavior across both axe-core and equal-access engines.
