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

```typescript
a11y: {
  engine: 'equal-access',
  config: {
    policies: ['IBM_Accessibility'], // or 'WCAG_2_1', 'WCAG_2_0'
    rules: [
      { id: 'skip_main_exists', enabled: false }
    ]
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
