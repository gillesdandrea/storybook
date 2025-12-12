# Analysis: `id` and `ruleId` Field Usage in Storybook A11y Addon

## Summary
After comprehensive review, the `id` and `ruleId` fields are **correctly defined and consistently used** across the codebase with one semantic difference between engines.

## Type Definitions

### 1. Engine Layer (`engines/types.ts`)
```typescript
export interface A11yIssue {
  /** Unique identifier for this issue instance */
  id: string;
  /** Rule identifier that triggered this issue */
  ruleId: string;
  // ... other fields
}
```

**Purpose:**
- `id`: Unique identifier for the specific issue instance (may include type suffix)
- `ruleId`: The base rule identifier without type suffix

### 2. Display Layer (`display/types.ts`)
```typescript
export interface EnrichedIssue {
  /** Unique identifier */
  id: string;
  /** Rule identifier */
  ruleId: string;
  // ... other fields
}
```

**Purpose:** Maintains the same semantic meaning as the engine layer.

## Engine Implementations

### Axe-Core Adapter (`engines/axe-core/AxeCoreAdapter.ts`)

**Line 284-285:**
```typescript
return {
  id: `${result.id}-${type}`,  // e.g., "color-contrast-violation"
  ruleId: result.id,            // e.g., "color-contrast"
  // ...
};
```

**Behavior:**
- `id`: Includes type suffix for uniqueness across violation/pass/incomplete
- `ruleId`: Pure rule identifier from axe-core

### Equal Access Adapter (`engines/equal-access/EqualAccessAdapter.ts`)

**Line 415-416:**
```typescript
return {
  id: issue.ruleId,      // e.g., "WCAG20_Input_ExplicitLabel"
  ruleId: issue.ruleId,  // e.g., "WCAG20_Input_ExplicitLabel"
  // ...
};
```

**Behavior:**
- Both `id` and `ruleId` use the same value
- Equal Access doesn't need type suffixes as issues are already categorized

## Display Layer Transformation

### ReportEnrichmentService (`display/ReportEnrichmentService.ts`)

**Line 44-45:**
```typescript
return {
  id: issue.id,
  ruleId: issue.ruleId,
  // ...
};
```

**Behavior:** Pass-through - preserves both fields exactly as provided by engines.

## UI Component Usage

### Report Component (`components/Report/Report.tsx`)

**Line 92:**
```typescript
const id = `${type}.${item.id}`;
```

**Line 100:**
```typescript
<RuleId>{item.id}</RuleId>
```

**Usage:**
- Uses `item.id` for building unique keys
- Displays `item.id` in the UI (shows the full identifier with type suffix for axe-core)

### Details Component (`components/Report/Details.tsx`)

**Line 175:**
```typescript
<RuleId>{item.id}</RuleId>
```

**Lines 203, 222, 240:**
```typescript
const key = `${type}.${item.id}.${index + 1}`;
```

**Usage:**
- Uses `item.id` consistently for key generation
- Displays `item.id` in the UI

## Semantic Differences Between Engines

| Field | Axe-Core | Equal Access |
|-------|----------|--------------|
| `id` | `{ruleId}-{type}` (e.g., "color-contrast-violation") | `{ruleId}` (e.g., "WCAG20_Input_ExplicitLabel") |
| `ruleId` | Base rule ID (e.g., "color-contrast") | Same as `id` |

## Why This Design Works

1. **Uniqueness**: The `id` field ensures uniqueness across all issue instances
   - Axe-core: Adds type suffix to distinguish violation/pass/incomplete
   - Equal Access: Already unique per issue type

2. **Consistency**: Both engines populate both fields, maintaining interface compatibility

3. **Display**: UI components use `id` for both keys and display, which works for both engines:
   - Axe-core: Shows descriptive ID with type (e.g., "color-contrast-violation")
   - Equal Access: Shows rule ID (e.g., "WCAG20_Input_ExplicitLabel")

4. **Backward Compatibility**: The `ruleId` field is preserved for any code that might need the base rule identifier

## Conclusion

✅ **Type definitions are correct**: Both `id` and `ruleId` are properly defined in all type interfaces

✅ **Engine implementations are correct**: Each engine populates both fields appropriately for their data model

✅ **UI usage is correct**: Components consistently use `item.id` for keys and display

✅ **No issues found**: The current implementation is semantically correct and handles the differences between engines appropriately

## Recommendation

**No changes needed.** The current implementation correctly handles the semantic differences between engines while maintaining a consistent interface. The use of `id` in UI components is the right choice as it provides the most specific identifier for each issue instance.