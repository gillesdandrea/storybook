# Equal Access Engine Fixes

## Issues Fixed

### 1. Issues Not Grouped by Rule ID

**Problem**: When using the Equal Access checker, issues with the same `ruleId` were appearing as separate entries in the UI instead of being grouped together with multiple nodes, unlike axe-core which naturally groups issues by rule.

**Root Cause**: The [`convertResults()`](code/addons/a11y/src/engines/equal-access/EqualAccessAdapter.ts:260) method was converting each Equal Access issue individually, creating a separate `A11yIssue` with a single node for each raw issue. This resulted in duplicate rule entries in the UI when multiple elements violated the same rule.

**Solution**: Modified the conversion logic to group issues by `ruleId` **within each category** (violations, warnings, incomplete, passes):

```typescript
// OLD - Each issue converted separately with single node
const issues = report.results.map((issue: any) => this.convertIssue(issue, report.nls));
const violations = issues.filter((i) => i.severity === A11ySeverity.VIOLATION);

// NEW - Categorize first, then group by ruleId within each category
const allIssues = report.results.map((issue: any) => this.convertIssue(issue, report.nls));

// Categorize issues first
const violationIssues = allIssues.filter(
  (i: A11yIssue) =>
    i.severity === A11ySeverity.VIOLATION &&
    i.confidence !== A11yConfidence.POTENTIAL &&
    i.confidence !== A11yConfidence.MANUAL
);

// Then group each category by ruleId
const violations = this.groupIssuesByRuleId(violationIssues);
```

The `groupIssuesByRuleId()` helper method combines issues with the same rule ID:

```typescript
private groupIssuesByRuleId(issues: A11yIssue[]): A11yIssue[] {
  const issuesByRuleId = new Map<string, A11yIssue>();

  for (const issue of issues) {
    if (issuesByRuleId.has(issue.ruleId)) {
      // Add nodes to existing issue
      const existingIssue = issuesByRuleId.get(issue.ruleId)!;
      existingIssue.nodes.push(...issue.nodes);
    } else {
      // Create new entry with this issue
      issuesByRuleId.set(issue.ruleId, issue);
    }
  }

  return Array.from(issuesByRuleId.values());
}
```

**Result**: Equal Access issues are now properly grouped by rule ID within each category (violations, warnings, incomplete, passes), preventing mixing of different issue types. Each rule shows a count of affected elements, matching axe-core's behavior.

**Additional Fix - Rule Titles and Descriptions**:

1. **Adapter**: Updated [`convertIssue()`](code/addons/a11y/src/engines/equal-access/EqualAccessAdapter.ts:340) to properly extract and separate title and description from Equal Access rule metadata:
   - Added [`getRuleTitle()`](code/addons/a11y/src/engines/equal-access/EqualAccessAdapter.ts:505): Extracts the **specific failure message** based on `reasonId` (e.g., "Fail_1")
     - Looks up `rule.messages['en-US'][issue.reasonId]` to get the specific message
     - Example: `messages['en-US']['Fail_1']` = "Content is not within a landmark element"
   - Added [`getRuleDescription()`](code/addons/a11y/src/engines/equal-access/EqualAccessAdapter.ts:527): Extracts the **general rule description**
     - Looks up `rule.messages['en-US'].group` to get the general description
     - Example: `messages['en-US'].group` = "All content must reside within an element with a landmark role"
   - Stores title in `engineSpecific.title` and description in `description` field

2. **UI Helper**: Updated [`getRuleTitle()`](code/addons/a11y/src/ruleHelpers.ts:58) in ruleHelpers to check `engineSpecific.title` first before falling back to registry cache or legacy maps.

**Result**:

- **Title** (in violations list): "Content is not within a landmark element" (from `messages['en-US']['Fail_1']`)
- **Description** (in details panel): "All content must reside within an element with a landmark role" (from `messages['en-US'].group`)
- Instead of showing "aria_content_in_landmark" for both

### 2. Inconclusive Errors Appearing in Violations

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

### 3. "Jump to Element" Not Highlighting DOM Elements

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

### 4. Body Element Highlighting Issue - FIXED

**Problem**: Clicking "Jump to element" for `body` elements showed no visual feedback because the highlighting system intentionally excludes `body`, `html`, and `main` elements from highlighting (they usually cover the whole page).

**Solution**: Enhanced [`handleJumpToElement()`](code/addons/a11y/src/components/A11yContext.tsx:323) to provide temporary visual feedback for unhighlighted selectors:

```typescript
const handleJumpToElement = useCallback(
  (target: string) => {
    // Check if this is an unhighlighted selector (like body, html, main)
    if (unhighlightedSelectors.includes(target)) {
      // Show temporary highlight with distinctive red outline
      emit(HIGHLIGHT, {
        id: `${ADDON_ID}/temp-highlight`,
        selectors: [target],
        styles: {
          outline: '2px solid #FF6B6B',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
        },
      });

      // Remove highlight after 2 seconds
      setTimeout(() => {
        emit(REMOVE_HIGHLIGHT, `${ADDON_ID}/temp-highlight`);
      }, 2000);
    }

    // Always scroll to element
    emit(SCROLL_INTO_VIEW, target);
  },
  [emit]
);
```

**Result**: Users now get visual feedback when jumping to `body` elements - a temporary red outline appears for 2 seconds, then disappears.

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
2. **[`A11yContext.tsx`](code/addons/a11y/src/components/A11yContext.tsx)**: Fixed selector matching in `handleSelect` and enhanced `handleJumpToElement` for unhighlighted selectors
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
   - For `body` elements: Verify temporary red outline appears for 2 seconds

## Impact

These fixes ensure Equal Access results behave consistently with axe-core results:

- Proper categorization of uncertain results
- Working element highlighting and navigation
- Improved user experience when using Equal Access engine

---

**Implementation Date**: 2025-12-05  
**Author**: IBM Bob
