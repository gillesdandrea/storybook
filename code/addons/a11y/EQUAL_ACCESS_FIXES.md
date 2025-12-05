# Equal Access Engine Fixes

## Issues Fixed

### 1. Inconclusive Errors Appearing in Violations

**Problem**: Items with `POTENTIAL` or `MANUAL` confidence were appearing in both the violations/warnings sections AND the inconclusive section, causing duplication.

**Root Cause**: The categorization logic in [`EqualAccessAdapter.ts`](code/addons/a11y/src/engines/equal-access/EqualAccessAdapter.ts:263) was filtering by severity first, then by confidence separately. This meant an item could be both a VIOLATION (by severity) and INCONCLUSIVE (by confidence).

**Solution**: Modified the categorization logic to prioritize confidence over severity:

```typescript
// OLD - Items could appear in multiple categories
const violations = issues.filter((i: A11yIssue) => i.severity === A11ySeverity.VIOLATION);
const incomplete = issues.filter(
  (i: A11yIssue) =>
    i.confidence === A11yConfidence.POTENTIAL || i.confidence === A11yConfidence.MANUAL
);

// NEW - Inconclusive items are excluded from violations/warnings
const incomplete = issues.filter(
  (i: A11yIssue) =>
    i.confidence === A11yConfidence.POTENTIAL || i.confidence === A11yConfidence.MANUAL
);

const violations = issues.filter(
  (i: A11yIssue) =>
    i.severity === A11ySeverity.VIOLATION &&
    i.confidence !== A11yConfidence.POTENTIAL &&
    i.confidence !== A11yConfidence.MANUAL
);
```

**Result**: Items with uncertain confidence now appear ONLY in the inconclusive section, matching the expected behavior.

### 2. "Jump to Element" Not Highlighting DOM Elements

**Problem**: The "Jump to element" button in Equal Access results was not properly highlighting DOM elements like it does for axe-core results.

**Root Cause**: Two issues in the highlighting system:

1. **Selector Comparison Logic**: In [`A11yContext.tsx`](code/addons/a11y/src/components/A11yContext.tsx:241), the selector matching logic was comparing `details.selectors` with `String(n.target)`, but `n.target` is an array, so `String(n.target)` creates a comma-separated string that doesn't match individual selectors.

2. **Target Conversion**: In [`Details.tsx`](code/addons/a11y/src/components/Report/Details.tsx:206), the button was calling `handleJumpToElement(node.target.toString())`, which converts the array to a comma-separated string instead of passing individual selectors.

**Solutions**:

1. **Fixed Selector Matching Logic**:

```typescript
// OLD - Incorrect array-to-string comparison
const index = nodes.findIndex((n) => details.selectors.some((s) => s === String(n.target))) ?? -1;

// NEW - Proper array handling
const index =
  nodes.findIndex((n) =>
    details.selectors.some((selector) =>
      Array.isArray(n.target) ? n.target.includes(selector) : n.target === selector
    )
  ) ?? -1;
```

2. **Fixed Target Conversion**:

```typescript
// OLD - Incorrect array-to-string conversion
onClick={() => handleJumpToElement(node.target.toString())}

// NEW - Proper selector extraction
onClick={() => {
  const targetSelector = Array.isArray(node.target)
    ? node.target[0]
    : typeof node.target === 'string'
      ? node.target
      : (node.target as any)?.selector || String(node.target);
  handleJumpToElement(targetSelector);
}}
```

**Result**: The "Jump to element" button now properly highlights DOM elements for Equal Access results, matching the behavior of axe-core results.

## Technical Details

### Equal Access Confidence Mapping

Equal Access uses confidence levels that map to our abstraction:

- `PASS` → `A11yConfidence.CERTAIN`
- `FAIL` → `A11yConfidence.CERTAIN`
- `POTENTIAL` → `A11yConfidence.POTENTIAL`
- `MANUAL` → `A11yConfidence.MANUAL`

Items with `POTENTIAL` or `MANUAL` confidence should only appear in the inconclusive section, regardless of their severity level.

### CSS Selector Generation

Equal Access provides DOM element references that we convert to CSS selectors using [`generateCssSelector()`](code/addons/a11y/src/engines/equal-access/EqualAccessAdapter.ts:352). The generated selectors are stored in the `target` array and used for element highlighting.

### Highlighting System Flow

1. User clicks "Jump to element" button
2. Button extracts first selector from `node.target` array
3. Calls `handleJumpToElement(selector)`
4. Highlighting system uses selector to find and highlight DOM element
5. Element is scrolled into view

## Files Modified

1. **[`EqualAccessAdapter.ts`](code/addons/a11y/src/engines/equal-access/EqualAccessAdapter.ts)**: Fixed result categorization logic
2. **[`A11yContext.tsx`](code/addons/a11y/src/components/A11yContext.tsx)**: Fixed selector matching in `handleSelect`
3. **[`Details.tsx`](code/addons/a11y/src/components/Report/Details.tsx)**: Fixed target selector extraction for jump button

## Testing

To verify the fixes:

1. **Inconclusive Items**:
   - Run Equal Access on a page with potential/manual issues
   - Verify items appear only in "Inconclusive" tab, not in "Violations"

2. **Element Highlighting**:
   - Run Equal Access on a page with accessibility issues
   - Click "Jump to element" button in issue details
   - Verify DOM element is highlighted and scrolled into view

## Impact

These fixes ensure Equal Access results behave consistently with axe-core results:

- Proper categorization of uncertain results
- Working element highlighting and navigation
- Improved user experience when using Equal Access engine

---

**Implementation Date**: 2025-12-05  
**Author**: IBM Bob
