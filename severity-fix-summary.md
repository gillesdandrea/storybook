# Severity Badge Display Fix

## Problem
All accessibility issues were showing "Information" severity instead of their proper severity levels (violation, warning, recommendation).

## Root Cause
The issue was in the `convertIssueToResult` function in `code/addons/a11y/src/a11yRunner.ts` (lines 309-370).

When converting the normalized `A11yReport` back to `AxeResults` format for backward compatibility:
1. The function was only preserving basic fields like `id`, `impact`, `tags`, `description`, `help`, `helpUrl`, and `nodes`
2. It was **NOT** preserving the normalized `severity` and `confidence` fields from the `A11yIssue` interface
3. The manager-side `ReportEnrichmentService` expects these fields to be present to display the correct severity badges

## Solution
Modified the `convertIssueToResult` function to preserve `severity` and `confidence` fields in two places:

### 1. When using original axe-core result (lines 325-333)
```typescript
// Before:
if (issueObj.engineSpecific?.axeResult) {
  return issueObj.engineSpecific.axeResult;
}

// After:
if (issueObj.engineSpecific?.axeResult) {
  return {
    ...issueObj.engineSpecific.axeResult,
    severity: (issueObj as { severity?: string }).severity,
    confidence: (issueObj as { confidence?: string }).confidence,
  };
}
```

### 2. When constructing fallback result (lines 334-345)
```typescript
// Added these two lines:
severity: (issueObj as { severity?: string }).severity,
confidence: (issueObj as { confidence?: string }).confidence,
```

## Data Flow
1. **AxeCoreAdapter** converts axe-core results to normalized `A11yIssue` format with `severity` and `confidence`
2. **a11yRunner** converts back to `AxeResults` format for backward compatibility
3. **Previously**: `severity` and `confidence` were lost during conversion
4. **Now**: `severity` and `confidence` are preserved in the converted result
5. **ReportEnrichmentService** receives the fields and displays correct severity badges

## Testing
After this fix, the severity badges should display:
- 🔴 **Violation** for critical/serious issues (red)
- 🟡 **Warning** for moderate issues (yellow)
- 🔵 **Recommendation** for minor issues (blue)
- ℹ️ **Information** for informational items (gray)

## Related Files
- `code/addons/a11y/src/a11yRunner.ts` - Fixed conversion function
- `code/addons/a11y/src/engines/types.ts` - Defines `A11yIssue` with `severity` and `confidence`
- `code/addons/a11y/src/display/ReportEnrichmentService.ts` - Consumes these fields for display
- `code/addons/a11y/src/engines/axe-core/AxeCoreAdapter.ts` - Maps axe-core impact to severity