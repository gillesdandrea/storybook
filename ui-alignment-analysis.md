# UI Alignment Analysis

## Current UI Usage of Rule Information

After analyzing the UI components, here's what the current implementation uses:

### 1. **Report.tsx** (Lines 110-116)
```typescript
const title = getTitleForAxeResult(item);
// Used in:
// - HeaderBar title display
// - Button aria-label
```

**Current Usage:**
- Displays rule title in the header
- Uses for accessibility labels

### 2. **Details.tsx** (Lines 143-148)
```typescript
getFriendlySummaryForAxeResult(item)
// Used in:
// - Description text
// - Paired with helpUrl link
```

**Current Usage:**
- Shows friendly summary/help text
- Displays "Learn how to resolve this violation" link with `item.helpUrl`

### 3. **A11yContext.tsx** (Lines 371-372, 414-415)
```typescript
getTitleForAxeResult(result)
getFriendlySummaryForAxeResult(result)
// Used in:
// - Highlight menu items (tooltip-like overlays)
```

**Current Usage:**
- Creates highlight menu with rule title and description
- Shows when hovering over highlighted elements

### 4. **Impact/Severity Display** (Report.tsx Lines 118-122)
```typescript
{item.impact && (
  <Badge status={type === RuleType.PASS ? 'neutral' : impactStatus[item.impact]}>
    {impactLabels[item.impact]}
  </Badge>
)}
```

**Current Usage:**
- Shows impact badge (Minor, Moderate, Serious, Critical)
- Maps axe-core impact to badge status

## What the Abstraction Provides

### ✅ **Already Covered**

1. **`A11yRuleMetadata.title`** → Replaces `getTitleForAxeResult()`
2. **`A11yRuleMetadata.help`** → Replaces `getFriendlySummaryForAxeResult()`
3. **`A11yRuleMetadata.helpUrl`** → Already in `item.helpUrl`
4. **`A11yRuleMetadata.description`** → Additional context available
5. **`A11yRuleMetadata.defaultSeverity`** → Maps to impact levels

### ⚠️ **Needs Adjustment**

The current UI expects **axe-core specific types**:

```typescript
// Current types (axe-core specific)
import type { ImpactValue } from 'axe-core';
import type { EnhancedResult, EnhancedNodeResult } from '../types';

// These are based on axe-core's Result and NodeResult types
```

## Required Changes for UI Alignment

### 1. **Update Type Imports**

**Current:**
```typescript
import type { ImpactValue } from 'axe-core';
import { getTitleForAxeResult, getFriendlySummaryForAxeResult } from '../axeRuleMappingHelper';
```

**New:**
```typescript
import { A11yRuleRegistry } from '../rules/registry';
import type { A11yIssue } from '../engines/types';
// No more axe-core imports in UI components
```

### 2. **Update Impact/Severity Mapping**

**Current (Report.tsx):**
```typescript
const impactStatus: Record<NonNullable<ImpactValue>, ComponentProps<typeof Badge>['status']> = {
  minor: 'neutral',
  moderate: 'warning',
  serious: 'negative',
  critical: 'critical',
};
```

**New:**
```typescript
import type { A11ySeverity } from '../engines/types';

const severityStatus: Record<A11ySeverity, ComponentProps<typeof Badge>['status']> = {
  information: 'neutral',
  recommendation: 'neutral',
  warning: 'warning',
  violation: 'negative',
};

const severityLabels: Record<A11ySeverity, string> = {
  information: 'Info',
  recommendation: 'Recommendation',
  warning: 'Warning',
  violation: 'Violation',
};
```

### 3. **Update Component Props**

**Current:**
```typescript
export interface ReportProps {
  items: EnhancedResult[];  // axe-core specific
  // ...
}
```

**New:**
```typescript
export interface ReportProps {
  items: A11yIssue[];  // engine-agnostic
  // ...
}
```

### 4. **Async Rule Metadata Loading**

The new abstraction uses **async** methods, so components need to handle loading:

**Pattern for Report.tsx:**
```typescript
const [ruleTitle, setRuleTitle] = useState(item.ruleId);

useEffect(() => {
  A11yRuleRegistry.getRuleTitle(item.ruleId, item.engine)
    .then(setRuleTitle);
}, [item.ruleId, item.engine]);
```

**Pattern for Details.tsx:**
```typescript
const [ruleHelp, setRuleHelp] = useState(item.help || item.description);

useEffect(() => {
  A11yRuleRegistry.getRuleHelp(item.ruleId, item.engine)
    .then(setRuleHelp);
}, [item.ruleId, item.engine]);
```

### 5. **Update A11yContext Highlight Menu**

**Current (A11yContext.tsx lines 371-372):**
```typescript
title: getTitleForAxeResult(result),
description: getFriendlySummaryForAxeResult(result),
```

**New:**
```typescript
// Need to pre-load rule metadata or use cached values
const [ruleMetadata, setRuleMetadata] = useState<Map<string, A11yRuleMetadata>>(new Map());

useEffect(() => {
  // Load all rule metadata for current results
  const loadMetadata = async () => {
    const metadata = new Map();
    for (const result of results?.[ui.tab] || []) {
      const meta = await A11yRuleRegistry.getRule(result.ruleId, result.engine);
      if (meta) {
        metadata.set(result.ruleId, meta);
      }
    }
    setRuleMetadata(metadata);
  };
  loadMetadata();
}, [results, ui.tab]);

// Then use:
title: ruleMetadata.get(result.ruleId)?.title || result.ruleId,
description: ruleMetadata.get(result.ruleId)?.help || result.description,
```

## Missing Features Analysis

### ✅ **Nothing Missing from Abstraction**

The proposed abstraction covers all current UI needs:

1. ✅ Rule title (for display)
2. ✅ Rule help text (friendly summary)
3. ✅ Help URL (documentation link)
4. ✅ Severity/impact (for badges)
5. ✅ Rule ID (already in issue)
6. ✅ Description (additional context)
7. ✅ Tags (for future filtering)
8. ✅ Category (for future grouping)

### 🆕 **New Capabilities Enabled**

The abstraction adds capabilities not currently used:

1. **Rule Search**: `A11yRuleRegistry.searchRules(query)`
2. **Category Filtering**: `A11yRuleRegistry.getRulesByCategory(category)`
3. **WCAG Criteria**: `ruleMetadata.wcagCriteria`
4. **Cross-Engine Support**: Works with both axe-core and Equal Access

## Implementation Recommendations

### Phase 1: Type Updates
1. Update `types.ts` to use engine-agnostic types
2. Update `EnhancedResult` to extend `A11yIssue`
3. Keep backward compatibility in type definitions

### Phase 2: Component Updates
1. Update Report.tsx to use async rule loading
2. Update Details.tsx to use async rule loading
3. Update A11yContext.tsx to pre-load rule metadata
4. Update severity/impact mappings

### Phase 3: Performance Optimization
1. Add rule metadata caching in components
2. Pre-load all rule metadata when results arrive
3. Use React.memo for expensive components

## Proposed Type Bridge

To minimize changes, create a bridge type:

```typescript
// src/types.ts
import type { A11yIssue } from './engines/types';

/**
 * Enhanced result with UI-specific additions
 * Extends the engine-agnostic A11yIssue
 */
export type EnhancedResult = A11yIssue & {
  // UI-specific fields can be added here if needed
};

/**
 * Enhanced node result with UI-specific additions
 */
export type EnhancedNodeResult = A11yIssueNode & {
  linkPath: string; // UI-specific: deep link path
};

/**
 * Enhanced results collection
 */
export interface EnhancedResults {
  violations: EnhancedResult[];
  passes: EnhancedResult[];
  incomplete: EnhancedResult[];
  // Keep other axe-core fields for compatibility
  url?: string;
  timestamp?: number;
}
```

This approach:
- ✅ Minimizes component changes
- ✅ Maintains type compatibility
- ✅ Enables gradual migration
- ✅ Preserves existing functionality

## Summary

### What's Aligned ✅
- All current UI needs are covered by the abstraction
- Rule title, help text, and URLs are available
- Severity/impact mapping is straightforward

### What Needs Adding 🔧
- Async loading patterns in components
- Rule metadata caching strategy
- Type bridge for gradual migration
- Severity mapping from engine-agnostic to UI badges

### What's Enhanced 🆕
- Cross-engine support (works with Equal Access too)
- Rule search and filtering capabilities
- Better categorization and tagging
- WCAG criteria tracking

The abstraction is **well-aligned** with current UI needs and provides a clear migration path without breaking changes.