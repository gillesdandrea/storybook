# Engine-Specific Severity Display Implementation

## Summary

Successfully implemented engine-specific severity labels in the a11y addon. The severity badges now display the original engine-specific labels (e.g., "Serious", "Critical", "Moderate", "Minor" from axe-core, or "Violation", "Potential Violation", "Recommendation" from Equal Access) while maintaining the same semantic colors based on the normalized severity level.

## Changes Made

### 1. AxeCoreAdapter (`code/addons/a11y/src/engines/axe-core/AxeCoreAdapter.ts`)
- Added `getOriginalSeverityLabel()` method to map axe-core's impact values to display labels
- Updated `convertIssue()` to store `originalSeverity` in `engineSpecific` data
- Labels: "Critical", "Serious", "Moderate", "Minor", "Pass", "Needs Review"

### 2. EqualAccessAdapter (`code/addons/a11y/src/engines/equal-access/EqualAccessAdapter.ts`)
- Added `getOriginalSeverityLabel()` method to map Equal Access policy/confidence to display labels
- Updated `convertIssue()` to store `originalSeverity` in `engineSpecific` data
- Labels: "Violation", "Potential Violation", "Recommendation", "Potential Recommendation", "Information", "Manual", "Pass"

### 3. DisplaySeverity Interface (`code/addons/a11y/src/display/types.ts`)
- Added optional `engineLabel?: string` field to store engine-specific severity label
- Maintains backward compatibility with existing `label` field

### 4. ReportEnrichmentService (`code/addons/a11y/src/display/ReportEnrichmentService.ts`)
- Updated `mapSeverityToDisplay()` to accept `engineSpecific` parameter
- Extracts `originalSeverity` from `engineSpecific` and assigns it to `engineLabel`
- Preserves semantic color mapping based on normalized severity level

### 5. Report Component (`code/addons/a11y/src/components/Report/Report.tsx`)
- Updated Badge display to use `item.severity.engineLabel || item.severity.label`
- Falls back to normalized label if engine-specific label is not available
- Maintains same badge status (color) based on semantic severity

## Key Design Decisions

1. **Backward Compatibility**: The `engineLabel` field is optional, ensuring existing code continues to work
2. **Semantic Colors**: Colors remain based on the normalized severity level (violation=red, warning=orange, etc.), not the engine-specific label
3. **Fallback Strategy**: If `engineLabel` is not available, the display falls back to the normalized `label`
4. **Single Source of Truth**: Engine-specific labels are generated once in the adapter and flow through the enrichment pipeline

## Testing

To test this implementation:

1. **Axe-Core Engine**: 
   - Run stories with accessibility violations
   - Verify badges show "Serious", "Critical", "Moderate", or "Minor" instead of generic "Violation"
   - Confirm colors match semantic severity (Critical/Serious = red, Moderate = orange, Minor = gray)

2. **Equal Access Engine**:
   - Configure a11y addon to use Equal Access engine
   - Verify badges show "Violation", "Potential Violation", "Recommendation", etc.
   - Confirm colors match semantic severity

3. **Mixed Scenarios**:
   - Test with incomplete/needs review items
   - Verify "Needs Review" or "Potential" labels appear with warning color

## Example Output

### Before:
- Badge: "Violation" (for all axe-core violations regardless of impact)

### After:
- Badge: "Serious" (for axe-core serious impact violations)
- Badge: "Critical" (for axe-core critical impact violations)
- Badge: "Moderate" (for axe-core moderate impact violations)
- Badge: "Minor" (for axe-core minor impact violations)
- Badge: "Potential Violation" (for Equal Access potential violations)

All badges maintain their semantic colors based on the normalized severity level.