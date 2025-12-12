# A11Y Display Abstraction - Implementation Plan (Option 4)

## Objective
Implement comprehensive refactoring to establish proper abstraction between accessibility engines and display components. **No legacy code support** - only legacy configuration compatibility.

## Architecture Overview

```
┌─────────────────────┐
│  Engine Adapters    │
│  (axe-core, equal-  │
│   access)           │
└──────────┬──────────┘
           │ A11yReport (normalized)
           ▼
┌─────────────────────┐
│ Report Enrichment   │
│ Service             │
└──────────┬──────────┘
           │ EnrichedReport
           ▼
┌─────────────────────┐
│ Display Components  │
│ (Report, Details,   │
│  A11YPanel)         │
└─────────────────────┘
```

## Phase 1: Create Enrichment Layer

### 1.1 Create Display Types

**File**: `code/addons/a11y/src/display/types.ts`

```typescript
import type { ComponentProps } from 'react';
import type { Badge } from 'storybook/internal/components';
import type { A11yConfidence, A11yEngineType, A11yIssue, A11yIssueNode, A11ySeverity } from '../engines/types';

/**
 * Display-optimized severity information
 * Contains all UI-specific properties for rendering severity badges
 */
export interface DisplaySeverity {
  /** Severity level for programmatic use */
  level: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Human-readable label */
  label: string;
  /** Badge component status prop */
  badgeStatus: ComponentProps<typeof Badge>['status'];
  /** Color for custom styling */
  color: string;
  /** Description for tooltips/help text */
  description: string;
}

/**
 * Display-optimized confidence information
 */
export interface DisplayConfidence {
  /** Confidence level */
  level: A11yConfidence;
  /** Human-readable label */
  label: string;
  /** Description for tooltips/help text */
  description: string;
}

/**
 * Display-optimized message from a node
 */
export interface DisplayMessage {
  /** Unique identifier */
  id: string;
  /** Message text */
  text: string;
  /** Message category for styling */
  category: 'primary' | 'secondary' | 'detail';
  /** Additional data */
  data?: unknown;
}

/**
 * Display-optimized node information
 */
export interface DisplayNode {
  /** HTML snippet */
  html: string;
  /** CSS selector */
  selector: string;
  /** XPath (optional) */
  xpath?: string;
  /** Bounding box (optional) */
  bounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  /** Extracted messages */
  messages: DisplayMessage[];
  /** Link path for deep linking */
  linkPath?: string;
}

/**
 * Display-optimized issue with all metadata pre-computed
 */
export interface EnrichedIssue {
  /** Unique identifier */
  id: string;
  /** Rule identifier */
  ruleId: string;
  /** Display title (pre-extracted) */
  displayTitle: string;
  /** Display description */
  displayDescription: string;
  /** Help URL */
  helpUrl?: string;
  /** Display-optimized severity */
  severity: DisplaySeverity;
  /** Display-optimized confidence */
  confidence: DisplayConfidence;
  /** Tags */
  tags: string[];
  /** Display-optimized nodes */
  nodes: DisplayNode[];
  /** Nodes grouped by message (for equal-access multi-message support) */
  groupedMessages: Map<string, DisplayNode[]>;
  /** Source engine */
  engine: A11yEngineType;
  /** Engine version */
  engineVersion?: string;
}

/**
 * Display-optimized report
 */
export interface EnrichedReport {
  violations: EnrichedIssue[];
  warnings: EnrichedIssue[];
  passes: EnrichedIssue[];
  incomplete: EnrichedIssue[];
  summary: {
    totalIssues: number;
    violationCount: number;
    warningCount: number;
    passCount: number;
    incompleteCount: number;
  };
  metadata: {
    executionTime: number;
    rulesExecuted: number;
    engineVersion?: string;
  };
}
```

### 1.2 Create Report Enrichment Service

**File**: `code/addons/a11y/src/display/ReportEnrichmentService.ts`

```typescript
import type { A11yConfidence, A11yIssue, A11yReport, A11ySeverity } from '../engines/types';
import type { DisplayConfidence, DisplaySeverity, EnrichedIssue, EnrichedReport } from './types';

/**
 * Service for enriching normalized A11yReport with display-specific metadata
 * This is the single transformation point from engine data to display data
 */
export class ReportEnrichmentService {
  /**
   * Enrich a normalized A11yReport with display metadata
   */
  static enrich(report: A11yReport): EnrichedReport {
    return {
      violations: report.violations.map(issue => this.enrichIssue(issue, report)),
      warnings: report.warnings.map(issue => this.enrichIssue(issue, report)),
      passes: report.passes.map(issue => this.enrichIssue(issue, report)),
      incomplete: report.incomplete.map(issue => this.enrichIssue(issue, report)),
      summary: report.summary,
      metadata: report.metadata,
    };
  }

  /**
   * Enrich a single issue with display metadata
   */
  private static enrichIssue(issue: A11yIssue, report: A11yReport): EnrichedIssue {
    const nodes = issue.nodes.map(node => this.enrichNode(node));
    
    return {
      id: issue.id,
      ruleId: issue.ruleId,
      displayTitle: this.extractTitle(issue),
      displayDescription: this.extractDescription(issue),
      helpUrl: issue.helpUrl,
      severity: this.mapSeverityToDisplay(issue.severity, issue.confidence),
      confidence: this.mapConfidenceToDisplay(issue.confidence),
      tags: issue.tags,
      nodes,
      groupedMessages: this.groupNodesByMessage(nodes),
      engine: issue.engine,
      engineVersion: report.metadata.engineVersion,
    };
  }

  /**
   * Enrich a node with display-optimized data
   */
  private static enrichNode(node: A11yIssueNode): import('./types').DisplayNode {
    return {
      html: node.html,
      selector: node.target[0] || '',
      xpath: node.xpath,
      bounds: node.bounds,
      messages: this.extractMessages(node),
      linkPath: (node as any).linkPath, // Legacy property
    };
  }

  /**
   * Extract display title from issue
   * Priority: engineSpecific.title > help > description > ruleId
   */
  private static extractTitle(issue: A11yIssue): string {
    if (issue.engineSpecific?.title) {
      return String(issue.engineSpecific.title);
    }
    return issue.help || issue.description || issue.ruleId;
  }

  /**
   * Extract display description from issue
   */
  private static extractDescription(issue: A11yIssue): string {
    return issue.description || issue.help || '';
  }

  /**
   * Map normalized severity + confidence to display properties
   */
  private static mapSeverityToDisplay(
    severity: A11ySeverity,
    confidence: A11yConfidence
  ): DisplaySeverity {
    // Handle uncertain results first (potential/manual)
    if (confidence === 'potential' || confidence === 'manual') {
      return {
        level: 'medium',
        label: 'Needs Review',
        badgeStatus: 'warning',
        color: '#FFA500',
        description: 'This issue requires manual verification',
      };
    }

    // Map severity to display properties
    switch (severity) {
      case 'violation':
        return {
          level: 'critical',
          label: 'Violation',
          badgeStatus: 'critical',
          color: '#FF4785',
          description: 'This is a definite accessibility violation',
        };
      case 'warning':
        return {
          level: 'high',
          label: 'Warning',
          badgeStatus: 'negative',
          color: '#FC521F',
          description: 'This is likely an accessibility issue',
        };
      case 'recommendation':
        return {
          level: 'low',
          label: 'Recommendation',
          badgeStatus: 'neutral',
          color: '#999999',
          description: 'This is a best practice recommendation',
        };
      case 'information':
        return {
          level: 'info',
          label: 'Information',
          badgeStatus: 'neutral',
          color: '#999999',
          description: 'This is informational',
        };
    }
  }

  /**
   * Map confidence to display properties
   */
  private static mapConfidenceToDisplay(confidence: A11yConfidence): DisplayConfidence {
    switch (confidence) {
      case 'certain':
        return {
          level: confidence,
          label: 'Certain',
          description: 'This issue was definitively detected',
        };
      case 'likely':
        return {
          level: confidence,
          label: 'Likely',
          description: 'This issue is likely present',
        };
      case 'potential':
        return {
          level: confidence,
          label: 'Potential',
          description: 'This may be an issue',
        };
      case 'manual':
        return {
          level: confidence,
          label: 'Manual Check Required',
          description: 'This requires manual verification',
        };
    }
  }

  /**
   * Extract all messages from a node in display format
   * Flattens any/all/none arrays into a single message list
   */
  private static extractMessages(node: A11yIssueNode): import('./types').DisplayMessage[] {
    const messages: import('./types').DisplayMessage[] = [];

    // Primary messages (any checks)
    if (node.any) {
      messages.push(...node.any.map(check => ({
        id: check.id,
        text: check.message,
        category: 'primary' as const,
        data: check.data,
      })));
    }

    // Secondary messages (all checks)
    if (node.all) {
      messages.push(...node.all.map(check => ({
        id: check.id,
        text: check.message,
        category: 'secondary' as const,
        data: check.data,
      })));
    }

    // Detail messages (none checks)
    if (node.none) {
      messages.push(...node.none.map(check => ({
        id: check.id,
        text: check.message,
        category: 'detail' as const,
        data: check.data,
      })));
    }

    return messages;
  }

  /**
   * Group nodes by their primary message content
   * This supports equal-access's multi-message display pattern
   */
  private static groupNodesByMessage(
    nodes: import('./types').DisplayNode[]
  ): Map<string, import('./types').DisplayNode[]> {
    const groups = new Map<string, import('./types').DisplayNode[]>();
    
    for (const node of nodes) {
      // Get primary message (first message)
      const message = node.messages[0]?.text || '';
      
      if (!groups.has(message)) {
        groups.set(message, []);
      }
      groups.get(message)!.push(node);
    }
    
    return groups;
  }
}
```

### 1.3 Create Tests

**File**: `code/addons/a11y/src/display/ReportEnrichmentService.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import type { A11yReport, A11yIssue } from '../engines/types';
import { ReportEnrichmentService } from './ReportEnrichmentService';

describe('ReportEnrichmentService', () => {
  describe('severity mapping', () => {
    it('maps violation + certain to critical', () => {
      const report = createMockReport({
        violations: [createMockIssue({ severity: 'violation', confidence: 'certain' })],
      });
      
      const enriched = ReportEnrichmentService.enrich(report);
      
      expect(enriched.violations[0].severity).toEqual({
        level: 'critical',
        label: 'Violation',
        badgeStatus: 'critical',
        color: '#FF4785',
        description: 'This is a definite accessibility violation',
      });
    });

    it('maps potential confidence to needs review regardless of severity', () => {
      const report = createMockReport({
        incomplete: [createMockIssue({ severity: 'violation', confidence: 'potential' })],
      });
      
      const enriched = ReportEnrichmentService.enrich(report);
      
      expect(enriched.incomplete[0].severity).toEqual({
        level: 'medium',
        label: 'Needs Review',
        badgeStatus: 'warning',
        color: '#FFA500',
        description: 'This issue requires manual verification',
      });
    });
  });

  describe('title extraction', () => {
    it('uses engineSpecific.title if available', () => {
      const report = createMockReport({
        violations: [createMockIssue({
          help: 'Generic help',
          engineSpecific: { title: 'Specific title' },
        })],
      });
      
      const enriched = ReportEnrichmentService.enrich(report);
      
      expect(enriched.violations[0].displayTitle).toBe('Specific title');
    });

    it('falls back to help then description then ruleId', () => {
      const report1 = createMockReport({
        violations: [createMockIssue({ help: 'Help text', description: 'Desc' })],
      });
      expect(ReportEnrichmentService.enrich(report1).violations[0].displayTitle).toBe('Help text');

      const report2 = createMockReport({
        violations: [createMockIssue({ description: 'Desc', ruleId: 'rule-1' })],
      });
      expect(ReportEnrichmentService.enrich(report2).violations[0].displayTitle).toBe('Desc');

      const report3 = createMockReport({
        violations: [createMockIssue({ ruleId: 'rule-1' })],
      });
      expect(ReportEnrichmentService.enrich(report3).violations[0].displayTitle).toBe('rule-1');
    });
  });

  describe('message extraction', () => {
    it('extracts messages from any/all/none arrays', () => {
      const report = createMockReport({
        violations: [createMockIssue({
          nodes: [{
            html: '<div></div>',
            target: ['div'],
            any: [{ id: 'check1', message: 'Primary message' }],
            all: [{ id: 'check2', message: 'Secondary message' }],
            none: [{ id: 'check3', message: 'Detail message' }],
          }],
        })],
      });
      
      const enriched = ReportEnrichmentService.enrich(report);
      const messages = enriched.violations[0].nodes[0].messages;
      
      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({
        id: 'check1',
        text: 'Primary message',
        category: 'primary',
      });
      expect(messages[1]).toEqual({
        id: 'check2',
        text: 'Secondary message',
        category: 'secondary',
      });
      expect(messages[2]).toEqual({
        id: 'check3',
        text: 'Detail message',
        category: 'detail',
      });
    });
  });

  describe('message grouping', () => {
    it('groups nodes by primary message', () => {
      const report = createMockReport({
        violations: [createMockIssue({
          nodes: [
            {
              html: '<div>1</div>',
              target: ['div:nth-of-type(1)'],
              any: [{ id: 'c1', message: 'Message A' }],
            },
            {
              html: '<div>2</div>',
              target: ['div:nth-of-type(2)'],
              any: [{ id: 'c2', message: 'Message A' }],
            },
            {
              html: '<div>3</div>',
              target: ['div:nth-of-type(3)'],
              any: [{ id: 'c3', message: 'Message B' }],
            },
          ],
        })],
      });
      
      const enriched = ReportEnrichmentService.enrich(report);
      const groups = enriched.violations[0].groupedMessages;
      
      expect(groups.size).toBe(2);
      expect(groups.get('Message A')).toHaveLength(2);
      expect(groups.get('Message B')).toHaveLength(1);
    });
  });
});

// Helper functions
function createMockReport(overrides: Partial<A11yReport> = {}): A11yReport {
  return {
    engine: 'axe-core',
    timestamp: Date.now(),
    violations: [],
    warnings: [],
    passes: [],
    incomplete: [],
    summary: {
      totalIssues: 0,
      violationCount: 0,
      warningCount: 0,
      passCount: 0,
      incompleteCount: 0,
    },
    metadata: {
      executionTime: 0,
      rulesExecuted: 0,
    },
    ...overrides,
  };
}

function createMockIssue(overrides: Partial<A11yIssue> = {}): A11yIssue {
  return {
    id: 'test-issue',
    ruleId: 'test-rule',
    description: 'Test description',
    help: 'Test help',
    severity: 'violation',
    confidence: 'certain',
    tags: [],
    nodes: [],
    engine: 'axe-core',
    ...overrides,
  };
}
```

## Phase 2: Update Context Layer

### 2.1 Update A11yContext.tsx

**Changes**:
1. Import enrichment service
2. Change results type to `EnrichedReport`
3. Enrich reports before storing

```typescript
// Add imports
import { ReportEnrichmentService } from '../display/ReportEnrichmentService';
import type { EnrichedReport } from '../display/types';

// Update interface
export interface A11yContextStore {
  // ... other properties
  results: EnrichedReport | undefined; // Changed from EnhancedResults
  // ... other properties
}

// Update handleResult
const handleResult = useCallback(
  (report: A11yReport, id: string) => {
    if (storyId === id) {
      // Enrich report before storing
      const enrichedReport = ReportEnrichmentService.enrich(report);
      setState((prev) => ({ ...prev, status: 'ran', results: enrichedReport }));
      
      // ... rest of logic
    }
  },
  [storyId, setState]
);
```

## Phase 3: Update Display Components

### 3.1 Update Report.tsx

**File**: `code/addons/a11y/src/components/Report/Report.tsx`

```typescript
import type { FC } from 'react';
import React from 'react';
import { Badge, Button, EmptyTabContent } from 'storybook/internal/components';
import { ChevronSmallDownIcon } from '@storybook/icons';
import { styled } from 'storybook/theming';
import type { EnrichedIssue } from '../../display/types';
import { RuleType } from '../../types';
import { Details } from './Details';

// Remove axe-core imports
// Remove impact mappings

const Wrapper = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  containerType: 'inline-size',
  fontSize: theme.typography.size.s2,
}));

const Icon = styled(ChevronSmallDownIcon)({
  transition: 'transform 0.1s ease-in-out',
});

const HeaderBar = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px 6px 15px',
  minHeight: 40,
  background: 'none',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
  '&:hover': {
    color: theme.color.secondary,
  },
}));

const Title = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  flexGrow: 1,
  fontSize: theme.typography.size.s2,
  gap: 8,
}));

const RuleId = styled.div(({ theme }) => ({
  display: 'none',
  color: theme.textMutedColor,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
  '@container (min-width: 800px)': {
    display: 'block',
  },
}));

const Count = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.textMutedColor,
  width: 28,
  height: 28,
}));

export interface ReportProps {
  items: EnrichedIssue[];
  empty: string;
  type: RuleType;
  handleSelectionChange: (key: string) => void;
  selectedItems: Map<string, string>;
  toggleOpen: (event: React.SyntheticEvent<Element>, type: RuleType, item: EnrichedIssue) => void;
}

export const Report: FC<ReportProps> = ({
  items,
  empty,
  type,
  handleSelectionChange,
  selectedItems,
  toggleOpen,
}) => (
  <>
    {items && items.length ? (
      items.map((item) => {
        const id = `${type}.${item.ruleId}`;
        const detailsId = `details:${id}`;
        const selection = selectedItems.get(id);
        
        return (
          <Wrapper key={id}>
            <HeaderBar onClick={(event) => toggleOpen(event, type, item)} data-active={!!selection}>
              <Title>
                <strong>{item.displayTitle}</strong>
                <RuleId>{item.ruleId}</RuleId>
              </Title>
              <Badge status={type === RuleType.PASS ? 'neutral' : item.severity.badgeStatus}>
                {item.severity.label}
              </Badge>
              <Count>{item.nodes.length}</Count>
              <Button
                onClick={(event) => toggleOpen(event, type, item)}
                ariaLabel={`${selection ? 'Collapse' : 'Expand'} details for: ${item.displayTitle}`}
                aria-expanded={!!selection}
                aria-controls={detailsId}
                variant="ghost"
                padding="small"
              >
                <Icon style={{ transform: `rotate(${selection ? -180 : 0}deg)` }} />
              </Button>
            </HeaderBar>
            {selection ? (
              <Details
                id={detailsId}
                item={item}
                type={type}
                selection={selection}
                handleSelectionChange={handleSelectionChange}
              />
            ) : (
              <div id={detailsId} />
            )}
          </Wrapper>
        );
      })
    ) : (
      <EmptyTabContent title={empty} />
    )}
  </>
);
```

### 3.2 Update Details.tsx

**File**: `code/addons/a11y/src/components/Report/Details.tsx`

```typescript
import React, { Fragment, useCallback, useMemo, useState } from 'react';
import { Button, Link, SyntaxHighlighter } from 'storybook/internal/components';
import { CheckIcon, CopyIcon, LocationIcon } from '@storybook/icons';
import * as Tabs from '@radix-ui/react-tabs';
import { styled } from 'storybook/theming';
import type { EnrichedIssue } from '../../display/types';
import type { RuleType } from '../../types';
import { useA11yContext } from '../A11yContext';

// ... styled components remain the same ...

interface DetailsProps {
  id: string;
  item: EnrichedIssue;
  type: RuleType;
  selection: string | undefined;
  handleSelectionChange: (key: string) => void;
}

export const Details = ({ id, item, type, selection, handleSelectionChange }: DetailsProps) => {
  // Check if we have multiple message groups (equal-access multi-message scenario)
  const hasMultipleMessages = item.groupedMessages.size > 1;
  const messageGroups = Array.from(item.groupedMessages.entries());

  return (
    <Wrapper id={id}>
      <Info>
        <RuleId>{item.ruleId}</RuleId>
        <Description>
          {item.displayDescription}{' '}
          {item.helpUrl && (
            <Link href={item.helpUrl} target="_blank" rel="noopener noreferrer" withArrow>
              Learn how to resolve this violation
            </Link>
          )}
        </Description>
      </Info>

      <Tabs.Root
        defaultValue={selection}
        orientation="vertical"
        value={selection}
        onValueChange={handleSelectionChange}
        asChild
      >
        <Columns>
          <Tabs.List aria-label={type}>
            {hasMultipleMessages ? (
              // Group nodes by message
              messageGroups.map(([message, nodes], groupIndex) => (
                <Fragment key={`group-${groupIndex}`}>
                  {message && <MessageGroupTitle>{message}</MessageGroupTitle>}
                  {nodes.map((node, nodeIndex) => {
                    const globalIndex = item.nodes.indexOf(node);
                    const key = `${type}.${item.ruleId}.${globalIndex + 1}`;
                    return (
                      <Fragment key={key}>
                        <Tabs.Trigger value={key} asChild>
                          <Item ariaLabel={false} variant="ghost" size="medium" id={key}>
                            {globalIndex + 1}. {node.html}
                          </Item>
                        </Tabs.Trigger>
                        <Tabs.Content value={key} asChild>
                          <Content side="left">{getContent(node)}</Content>
                        </Tabs.Content>
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))
            ) : (
              // Original flat list for single-message rules
              item.nodes.map((node, index) => {
                const key = `${type}.${item.ruleId}.${index + 1}`;
                return (
                  <Fragment key={key}>
                    <Tabs.Trigger value={key} asChild>
                      <Item ariaLabel={false} variant="ghost" size="medium" id={key}>
                        {index + 1}. {node.html}
                      </Item>
                    </Tabs.Trigger>
                    <Tabs.Content value={key} asChild>
                      <Content side="left">{getContent(node)}</Content>
                    </Tabs.Content>
                  </Fragment>
                );
              })
            )}
          </Tabs.List>

          {item.nodes.map((node, index) => {
            const key = `${type}.${item.ruleId}.${index + 1}`;
            return (
              <Tabs.Content key={key} value={key} asChild>
                <Content side="right">{getContent(node)}</Content>
              </Tabs.Content>
            );
          })}
        </Columns>
      </Tabs.Root>
    </Wrapper>
  );
};

function getContent(node: import('../../display/types').DisplayNode) {
  const { handleCopyLink, handleJumpToElement } = useA11yContext();
  
  return (
    <>
      <Messages>
        {node.messages.map((message) => (
          <div key={message.id}>
            {`${message.text}${/(\.|: [^.]+\.*)$/.test(message.text) ? '' : '.'}`}
          </div>
        ))}
      </Messages>

      <Actions>
        <Button ariaLabel={false} onClick={() => handleJumpToElement(node.selector)}>
          <LocationIcon /> Jump to element
        </Button>
        {node.linkPath && <CopyButton onClick={() => handleCopyLink(node.linkPath!)} />}
      </Actions>

      <StyledSyntaxHighlighter
        language="jsx"
        wrapLongLines
      >{`/* element */\n${node.html}`}</StyledSyntaxHighlighter>

      <StyledSyntaxHighlighter
        language="css"
        wrapLongLines
      >{`/* selector */\n${node.selector} {}`}</StyledSyntaxHighlighter>
    </>
  );
}
```

## Phase 4: Clean Up Adapters

### 4.1 Remove EqualAccessAdapter Workarounds

**File**: `code/addons/a11y/src/engines/equal-access/EqualAccessAdapter.ts`

**Remove**:
- `mapSeverityToImpact()` method (lines 589-603)
- `impact` property from `engineSpecific` (line 427)

**Keep**:
- `any/all/none` population (this is now the standard approach, not a workaround)
- `title` in `engineSpecific` (this is legitimate engine-specific data)

### 4.2 Update A11YPanel.tsx

**File**: `code/addons/a11y/src/components/A11YPanel.tsx`

Update type imports:
```typescript
import type { EnrichedReport } from '../display/types';
```

Update results destructuring to use EnrichedReport type.

## Phase 5: Testing

### 5.1 Unit Tests
- ReportEnrichmentService (all methods)
- Display components with enriched data
- Both axe-core and equal-access flows

### 5.2 Integration Tests
- End-to-end: axe-core report → enrichment → display
- End-to-end: equal-access report → enrichment → display
- Multi-message grouping (equal-access)

### 5.3 Visual Regression
- Screenshot comparison before/after
- Verify badge colors and labels match
- Verify message formatting

## Configuration Compatibility

### Legacy Configuration Support

The only legacy support needed is for **configuration**, not code structures:

```typescript
// These configuration formats must continue to work:

// 1. Axe-core legacy config
parameters: {
  a11y: {
    config: {
      rules: {
        'color-contrast': { enabled: false }
      }
    }
  }
}

// 2. Equal-access legacy config
parameters: {
  a11y: {
    engine: 'equal-access',
    config: {
      policies: ['IBM_Accessibility'],
      reportLevels: ['violation', 'potentialviolation']
    }
  }
}
```

These are handled at the **adapter level** during engine configuration, not in display layer.

## Migration Checklist

- [ ] Phase 1: Create enrichment layer
  - [ ] Create display/types.ts
  - [ ] Create display/ReportEnrichmentService.ts
  - [ ] Create display/ReportEnrichmentService.test.ts
  - [ ] Run tests

- [ ] Phase 2: Update context
  - [ ] Update A11yContext.tsx to use EnrichedReport
  - [ ] Update handleResult to enrich reports
  - [ ] Test context with both engines

- [ ] Phase 3: Update components
  - [ ] Update Report.tsx (remove axe-core imports)
  - [ ] Update Details.tsx (use DisplayNode)
  - [ ] Update A11YPanel.tsx types
  - [ ] Test components with enriched data

- [ ] Phase 4: Clean up adapters
  - [ ] Remove mapSeverityToImpact from EqualAccessAdapter
  - [ ] Remove impact from engineSpecific
  - [ ] Test both adapters

- [ ] Phase 5: Testing
  - [ ] Run all unit tests
  - [ ] Run integration tests
  - [ ] Visual regression tests
  - [ ] Manual testing with both engines

- [ ] Phase 6: Documentation
  - [ ] Update README
  - [ ] Add migration notes
  - [ ] Update examples

## Success Criteria

✅ No axe-core imports in display components  
✅ No conditional logic for engine-specific values  
✅ Both engines display correctly  
✅ All tests pass  
✅ Visual regression tests pass  
✅ Legacy configuration still works  
✅ Performance is maintained or improved