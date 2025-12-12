# A11Y Report Display Abstraction Analysis

## Executive Summary

Analysis of the Storybook A11y addon's accessibility report display implementation reveals **moderate to high coupling** to axe-core's data structures. While engine adapters provide normalization, the display layer still exhibits axe-core dependencies, with equal-access reports being **retrofitted through workarounds**.

---

## Current Implementation Analysis

### 1. Type System Structure

**Legacy Types (Axe-Core Based)**:
```typescript
// types.ts lines 41-57
export type EnhancedNodeResult = NodeResult & { linkPath: string };
export type EnhancedResult = Omit<Result, 'nodes'> & { nodes: EnhancedNodeResult[] };
export type EnhancedResults = Omit<AxeResults, 'incomplete' | 'passes' | 'violations'> & {
  incomplete: EnhancedResult[];
  passes: EnhancedResult[];
  violations: EnhancedResult[];
};
```

**Normalized Types (Engine-Agnostic)**:
```typescript
// engines/types.ts
export interface A11yIssue {
  id: string;
  ruleId: string;
  description: string;
  severity: A11ySeverity;
  confidence: A11yConfidence;
  nodes: A11yIssueNode[];
  engine: A11yEngineType;
  engineSpecific?: Record<string, unknown>;
}
```

### 2. Display Component Coupling

#### Report.tsx - HIGH COUPLING

**Direct axe-core Dependencies**:
- Line 8: `import type { ImpactValue } from 'axe-core'`
- Lines 15-27: Hardcoded axe-core impact mappings (minor/moderate/serious/critical)
- Lines 29-42: Equal-access workaround mappings (violation/needsReview/recommendation)

**Conditional Logic**:
```typescript
// Lines 133-154
const impact = item.impact as string | undefined;
if (impact in equalAccessImpactLabels) {
  // Equal-access custom path
} else if (impact in impactLabels) {
  // Axe-core standard path
}
```

#### Details.tsx - HIGH COUPLING

**Axe-Core Structure Dependency**:
```typescript
// Lines 258-270
const { any, all, none } = node;
const rules = [...any, ...all, ...none];
```

**Equal-Access Workaround**:
```typescript
// Lines 159-174: Groups nodes by message from any[0]
const errorMessage = node.any && node.any.length > 0 ? node.any[0].message : '';
```

### 3. Equal-Access Adapter Workarounds

#### Forced Conformance to Axe-Core Structure

**1. Custom Impact Values** (EqualAccessAdapter.ts:589-603):
```typescript
private mapSeverityToImpact(severity: A11ySeverity): string {
  switch (severity) {
    case A11ySeverity.VIOLATION: return 'violation';
    case A11ySeverity.WARNING: return 'needsReview'; // Custom for equal-access
    case A11ySeverity.RECOMMENDATION: return 'recommendation';
  }
}
```

**2. Storing Impact in engineSpecific** (line 427):
```typescript
engineSpecific: {
  title: ruleTitle,
  impact: this.mapSeverityToImpact(this.mapSeverity(policy, confidence)), // For Report.tsx
}
```

**3. Populating any/all/none Arrays** (lines 445-451):
```typescript
// Add axe-core compatibility properties for Details component
any: [{
  id: String(issue.reasonId || issue.ruleId),
  message: specificMessage,
  data: { reasonId: issue.reasonId }
}],
all: [],
none: [],
```

---

## Coupling Assessment Matrix

| Component | Coupled To | Evidence | Severity |
|-----------|-----------|----------|----------|
| Report.tsx | axe-core ImpactValue | Direct type import | 🔴 Critical |
| Report.tsx | axe-core impact values | Hardcoded minor/moderate/serious/critical | 🔴 Critical |
| Details.tsx | axe-core any/all/none | Expects three-array structure | 🔴 Critical |
| EnhancedResult | axe-core Result | Extends axe-core type | 🔴 Critical |
| EqualAccessAdapter | Report.tsx expectations | Must provide custom impact values | 🟡 High |
| EqualAccessAdapter | Details.tsx expectations | Must populate any/all/none arrays | 🟡 High |

---

## Refactoring Options

### Option 1: Minimal - Type Unions ⚡ Low Effort

**Approach**: Make coupling explicit through union types.

```typescript
type UnifiedImpact = ImpactValue | 'violation' | 'needsReview' | 'recommendation';

interface UnifiedNode {
  html: string;
  target: string[];
  messages: Array<{ id: string; message: string }>;
  any?: Array<{ id: string; message: string }>; // Deprecated
}
```

**Pros**: Minimal changes, maintains compatibility  
**Cons**: Doesn't eliminate coupling  
**Effort**: 2-3 days | **Benefit**: Low

---

### Option 2: Display Transformation Layer 🎯 Recommended Balance

**Approach**: Transform normalized reports into display-optimized model.

```typescript
interface DisplaySeverity {
  level: 'critical' | 'high' | 'medium' | 'low' | 'info';
  label: string;
  badgeStatus: 'critical' | 'negative' | 'warning' | 'neutral';
}

interface DisplayIssue {
  id: string;
  title: string;
  severity: DisplaySeverity;
  nodes: DisplayNode[];
}

class ReportDisplayTransformer {
  static transform(report: A11yReport): DisplayReport {
    return {
      violations: report.violations.map(i => this.transformIssue(i)),
      // Transform other categories
    };
  }

  private static transformIssue(issue: A11yIssue): DisplayIssue {
    return {
      id: issue.id,
      title: this.extractTitle(issue),
      severity: this.mapSeverity(issue.severity, issue.confidence),
      nodes: issue.nodes.map(n => this.transformNode(n)),
    };
  }

  private static mapSeverity(severity: A11ySeverity, confidence: A11yConfidence): DisplaySeverity {
    if (confidence === A11yConfidence.POTENTIAL) {
      return { level: 'medium', label: 'Needs Review', badgeStatus: 'warning' };
    }
    switch (severity) {
      case A11ySeverity.VIOLATION:
        return { level: 'critical', label: 'Violation', badgeStatus: 'critical' };
      // Other cases
    }
  }
}
```

**Usage**:
```typescript
// A11yContext.tsx
const displayReport = ReportDisplayTransformer.transform(normalizedReport);

// Report.tsx - no axe-core imports
<Badge status={item.severity.badgeStatus}>{item.severity.label}</Badge>
```

**Pros**: Clean separation, centralized logic, testable  
**Cons**: Additional transformation step  
**Effort**: 1-2 weeks | **Benefit**: High

---

### Option 3: Adapter Pattern 🔧 Distributed Control

**Approach**: Each engine provides display adapter.

```typescript
interface IDisplayAdapter {
  getSeverityDisplay(issue: A11yIssue): SeverityDisplay;
  getIssueTitle(issue: A11yIssue): string;
  getMessages(node: A11yIssueNode): MessageDisplay[];
}

class AxeCoreDisplayAdapter implements IDisplayAdapter {
  getSeverityDisplay(issue: A11yIssue): SeverityDisplay {
    const impact = issue.engineSpecific?.impact as ImpactValue;
    switch (impact) {
      case 'critical': return { label: 'Critical', status: 'critical' };
      // Other cases
    }
  }
}

class DisplayAdapterRegistry {
  private static adapters = new Map<A11yEngineType, IDisplayAdapter>();
  static get(engine: A11yEngineType): IDisplayAdapter { /* ... */ }
}
```

**Usage**:
```typescript
// Report.tsx
const adapter = DisplayAdapterRegistry.get(item.engine);
const severity = adapter.getSeverityDisplay(item);
```

**Pros**: Engine-specific control, follows adapter pattern  
**Cons**: Distributed logic, more classes  
**Effort**: 1-2 weeks | **Benefit**: High

---

### Option 4: Comprehensive Refactoring 🏗️ Best Long-Term

**Approach**: Full abstraction with enrichment layer.

```typescript
interface EnrichedIssue extends A11yIssue {
  displayMetadata: {
    severity: {
      level: 'critical' | 'high' | 'medium' | 'low' | 'info';
      label: string;
      badgeStatus: ComponentProps<typeof Badge>['status'];
    };
    confidence: { level: A11yConfidence; label: string };
  };
  displayTitle: string;
  groupedMessages: Map<string, A11yIssueNode[]>;
}

class ReportEnrichmentService {
  static enrich(report: A11yReport): EnrichedReport {
    return {
      violations: report.violations.map(i => this.enrichIssue(i)),
      // Enrich other categories
    };
  }

  private static enrichIssue(issue: A11yIssue): EnrichedIssue {
    return {
      ...issue,
      displayMetadata: this.createDisplayMetadata(issue),
      displayTitle: this.extractTitle(issue),
      groupedMessages: this.groupMessages(issue.nodes),
    };
  }

  private static createDisplayMetadata(issue: A11yIssue) {
    return {
      severity: this.mapSeverity(issue.severity, issue.confidence),
      confidence: this.mapConfidence(issue.confidence),
    };
  }

  private static mapSeverity(severity: A11ySeverity, confidence: A11yConfidence) {
    if (confidence === A11yConfidence.POTENTIAL || confidence === A11yConfidence.MANUAL) {
      return { level: 'medium', label: 'Needs Review', badgeStatus: 'warning' };
    }
    switch (severity) {
      case A11ySeverity.VIOLATION:
        return { level: 'critical', label: 'Violation', badgeStatus: 'critical' };
      case A11ySeverity.WARNING:
        return { level: 'high', label: 'Warning', badgeStatus: 'negative' };
      case A11ySeverity.RECOMMENDATION:
        return { level: 'low', label: 'Recommendation', badgeStatus: 'neutral' };
      case A11ySeverity.INFORMATION:
        return { level: 'info', label: 'Information', badgeStatus: 'neutral' };
    }
  }
}

class MessageExtractionService {
  static extractMessages(node: A11yIssueNode) {
    const messages = [];
    if (node.any) messages.push(...node.any.map(c => ({ ...c, category: 'primary' })));
    if (node.all) messages.push(...node.all.map(c => ({ ...c, category: 'secondary' })));
    if (node.none) messages.push(...node.none.map(c => ({ ...c, category: 'detail' })));
    return messages;
  }
}
```

**Updated Components**:
```typescript
// A11yContext.tsx
const enrichedReport = ReportEnrichmentService.enrich(normalizedReport);

// Report.tsx - completely generic
<Badge status={item.displayMetadata.severity.badgeStatus}>
  {item.displayMetadata.severity.label}
</Badge>

// Details.tsx - uses message extraction
const messages = MessageExtractionService.extractMessages(node);
```

**Adapter Cleanup**:
```typescript
// EqualAccessAdapter - remove workarounds
// No need for mapSeverityToImpact
// No need to store impact in engineSpecific
// any/all/none is standard approach, not workaround
```

**Pros**: Complete separation, removes all workarounds, scalable  
**Cons**: Most extensive refactoring  
**Effort**: 2-3 weeks | **Benefit**: Very High

---

## Recommendation: Option 4 (Comprehensive)

### Why Option 4?

1. **Eliminates Technical Debt**: Removes all coupling and workarounds
2. **Scalability**: New engines require zero display changes
3. **Maintainability**: Clear separation of concerns
4. **Performance**: Single enrichment pass
5. **Quality**: Consistent UX across engines

### Implementation Roadmap

**Week 1: Foundation**
- Create ReportEnrichmentService with comprehensive tests
- Create MessageExtractionService with tests
- Define EnrichedIssue and EnrichedReport types
- Add backward compatibility guards

**Week 2: Integration**
- Update A11yContext to use enrichment
- Update Report.tsx to use enriched data
- Update Details.tsx to use message extraction
- Remove axe-core imports from display layer

**Week 3: Cleanup & Testing**
- Remove workarounds from EqualAccessAdapter
- Update all tests
- Visual regression testing
- Documentation updates

### Alternative: Option 2 if Time-Constrained

If 3 weeks is not feasible, Option 2 provides:
- Good separation (1-2 weeks)
- Significant benefits
- Clear path to Option 4 later

---

## Testing Strategy

### Unit Tests
- ReportEnrichmentService: All severity/confidence combinations
- MessageExtractionService: All node structures
- Display components: Both engines

### Integration Tests
- End-to-end: axe-core flow
- End-to-end: equal-access flow
- Backward compatibility

### Visual Regression
- Screenshot comparison before/after
- Badge colors and labels
- Message formatting

---

## Conclusion

**Current State**: Moderate-high coupling with workarounds  
**Recommended Solution**: Option 4 (Comprehensive Refactoring)  
**Investment**: 2-3 weeks  
**Return**: Eliminates technical debt, enables easy engine addition, improves maintainability

The comprehensive refactoring establishes proper abstraction, removes all engine-specific knowledge from display components, and creates a maintainable architecture for future growth.