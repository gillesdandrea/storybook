import { describe, it, expect } from 'vitest';
import type { A11yReport, A11yIssue, A11yIssueNode } from '../engines/types';
import { A11yEngineType, A11ySeverity, A11yConfidence } from '../engines/types';
import { ReportEnrichmentService } from './ReportEnrichmentService';

describe('ReportEnrichmentService', () => {
  describe('enrich', () => {
    it('enriches all report categories', () => {
      const report = createMockReport({
        violations: [createMockIssue({ ruleId: 'violation-1' })],
        warnings: [createMockIssue({ ruleId: 'warning-1' })],
        passes: [createMockIssue({ ruleId: 'pass-1' })],
        incomplete: [createMockIssue({ ruleId: 'incomplete-1' })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations).toHaveLength(1);
      expect(enriched.warnings).toHaveLength(1);
      expect(enriched.passes).toHaveLength(1);
      expect(enriched.incomplete).toHaveLength(1);
      expect(enriched.summary).toEqual(report.summary);
      expect(enriched.metadata).toEqual(report.metadata);
    });
  });

  describe('severity mapping', () => {
    it('maps violation + certain to critical', () => {
      const report = createMockReport({
        violations: [createMockIssue({ severity: A11ySeverity.VIOLATION, confidence: A11yConfidence.CERTAIN })],
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

    it('maps warning + certain to high', () => {
      const report = createMockReport({
        warnings: [createMockIssue({ severity: A11ySeverity.WARNING, confidence: A11yConfidence.CERTAIN })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.warnings[0].severity).toEqual({
        level: 'high',
        label: 'Warning',
        badgeStatus: 'negative',
        color: '#FC521F',
        description: 'This is likely an accessibility issue',
      });
    });

    it('maps recommendation + certain to low', () => {
      const report = createMockReport({
        violations: [createMockIssue({ severity: A11ySeverity.RECOMMENDATION, confidence: A11yConfidence.CERTAIN })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].severity).toEqual({
        level: 'low',
        label: 'Recommendation',
        badgeStatus: 'neutral',
        color: '#999999',
        description: 'This is a best practice recommendation',
      });
    });

    it('maps information + certain to info', () => {
      const report = createMockReport({
        passes: [createMockIssue({ severity: A11ySeverity.INFORMATION, confidence: A11yConfidence.CERTAIN })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.passes[0].severity).toEqual({
        level: 'info',
        label: 'Information',
        badgeStatus: 'neutral',
        color: '#999999',
        description: 'This is informational',
      });
    });

    it('maps potential confidence to needs review regardless of severity', () => {
      const report = createMockReport({
        incomplete: [createMockIssue({ severity: A11ySeverity.VIOLATION, confidence: A11yConfidence.POTENTIAL })],
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

    it('maps manual confidence to needs review regardless of severity', () => {
      const report = createMockReport({
        incomplete: [createMockIssue({ severity: A11ySeverity.VIOLATION, confidence: A11yConfidence.MANUAL })],
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

  describe('confidence mapping', () => {
    it('maps certain confidence', () => {
      const report = createMockReport({
        violations: [createMockIssue({ confidence: A11yConfidence.CERTAIN })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].confidence).toEqual({
        level: 'certain',
        label: 'Certain',
        description: 'This issue was definitively detected',
      });
    });

    it('maps likely confidence', () => {
      const report = createMockReport({
        violations: [createMockIssue({ confidence: A11yConfidence.LIKELY })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].confidence).toEqual({
        level: 'likely',
        label: 'Likely',
        description: 'This issue is likely present',
      });
    });

    it('maps potential confidence', () => {
      const report = createMockReport({
        incomplete: [createMockIssue({ confidence: A11yConfidence.POTENTIAL })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.incomplete[0].confidence).toEqual({
        level: 'potential',
        label: 'Potential',
        description: 'This may be an issue',
      });
    });

    it('maps manual confidence', () => {
      const report = createMockReport({
        incomplete: [createMockIssue({ confidence: A11yConfidence.MANUAL })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.incomplete[0].confidence).toEqual({
        level: 'manual',
        label: 'Manual Check Required',
        description: 'This requires manual verification',
      });
    });
  });

  describe('title extraction', () => {
    it('uses engineSpecific.title if available', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
            help: 'Generic help',
            description: 'Generic description',
            engineSpecific: { title: 'Specific title' },
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].displayTitle).toBe('Specific title');
    });

    it('falls back to help if no engineSpecific.title', () => {
      const report = createMockReport({
        violations: [createMockIssue({ help: 'Help text', description: 'Desc' })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].displayTitle).toBe('Help text');
    });

    it('falls back to description if no help', () => {
      const report = createMockReport({
        violations: [createMockIssue({ description: 'Desc', ruleId: 'rule-1' })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].displayTitle).toBe('Desc');
    });

    it('falls back to ruleId if no description', () => {
      const report = createMockReport({
        violations: [createMockIssue({ ruleId: 'rule-1' })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].displayTitle).toBe('rule-1');
    });
  });

  describe('description extraction', () => {
    it('uses description if available', () => {
      const report = createMockReport({
        violations: [createMockIssue({ description: 'Description text', help: 'Help text' })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].displayDescription).toBe('Description text');
    });

    it('falls back to help if no description', () => {
      const report = createMockReport({
        violations: [createMockIssue({ help: 'Help text' })],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].displayDescription).toBe('Help text');
    });

    it('returns empty string if neither available', () => {
      const report = createMockReport({
        violations: [createMockIssue({})],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].displayDescription).toBe('');
    });
  });

  describe('message extraction', () => {
    it('extracts messages from any array', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
            nodes: [
              {
                html: '<div></div>',
                target: ['div'],
                any: [{ id: 'check1', message: 'Primary message' }],
              },
            ],
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);
      const messages = enriched.violations[0].nodes[0].messages;

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        id: 'check1',
        text: 'Primary message',
        category: 'primary',
        data: undefined,
      });
    });

    it('extracts messages from all array', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
            nodes: [
              {
                html: '<div></div>',
                target: ['div'],
                all: [{ id: 'check2', message: 'Secondary message' }],
              },
            ],
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);
      const messages = enriched.violations[0].nodes[0].messages;

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        id: 'check2',
        text: 'Secondary message',
        category: 'secondary',
        data: undefined,
      });
    });

    it('extracts messages from none array', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
            nodes: [
              {
                html: '<div></div>',
                target: ['div'],
                none: [{ id: 'check3', message: 'Detail message' }],
              },
            ],
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);
      const messages = enriched.violations[0].nodes[0].messages;

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        id: 'check3',
        text: 'Detail message',
        category: 'detail',
        data: undefined,
      });
    });

    it('extracts messages from all arrays combined', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
            nodes: [
              {
                html: '<div></div>',
                target: ['div'],
                any: [{ id: 'check1', message: 'Primary message' }],
                all: [{ id: 'check2', message: 'Secondary message' }],
                none: [{ id: 'check3', message: 'Detail message' }],
              },
            ],
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);
      const messages = enriched.violations[0].nodes[0].messages;

      expect(messages).toHaveLength(3);
      expect(messages[0].category).toBe('primary');
      expect(messages[1].category).toBe('secondary');
      expect(messages[2].category).toBe('detail');
    });

    it('handles nodes with no messages', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
            nodes: [
              {
                html: '<div></div>',
                target: ['div'],
              },
            ],
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);
      const messages = enriched.violations[0].nodes[0].messages;

      expect(messages).toHaveLength(0);
    });
  });

  describe('message grouping', () => {
    it('groups nodes by primary message', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
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
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);
      const groups = enriched.violations[0].groupedMessages;

      expect(groups.size).toBe(2);
      expect(groups.get('Message A')).toHaveLength(2);
      expect(groups.get('Message B')).toHaveLength(1);
    });

    it('handles nodes with no messages', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
            nodes: [
              {
                html: '<div>1</div>',
                target: ['div'],
              },
            ],
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);
      const groups = enriched.violations[0].groupedMessages;

      expect(groups.size).toBe(1);
      expect(groups.get('')).toHaveLength(1);
    });
  });

  describe('node enrichment', () => {
    it('extracts selector from target array', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
            nodes: [
              {
                html: '<div></div>',
                target: ['div.class', 'div#id'],
              },
            ],
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].nodes[0].selector).toBe('div.class');
    });

    it('handles empty target array', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
            nodes: [
              {
                html: '<div></div>',
                target: [],
              },
            ],
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);

      expect(enriched.violations[0].nodes[0].selector).toBe('');
    });

    it('preserves xpath and bounds', () => {
      const report = createMockReport({
        violations: [
          createMockIssue({
            nodes: [
              {
                html: '<div></div>',
                target: ['div'],
                xpath: '/html/body/div',
                bounds: { left: 0, top: 0, width: 100, height: 50 },
              },
            ],
          }),
        ],
      });

      const enriched = ReportEnrichmentService.enrich(report);
      const node = enriched.violations[0].nodes[0];

      expect(node.xpath).toBe('/html/body/div');
      expect(node.bounds).toEqual({ left: 0, top: 0, width: 100, height: 50 });
    });
  });
});

// Helper functions
function createMockReport(overrides: Partial<A11yReport> = {}): A11yReport {
  return {
    engine: A11yEngineType.AXE_CORE,
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
    severity: A11ySeverity.VIOLATION,
    confidence: A11yConfidence.CERTAIN,
    tags: [],
    nodes: [],
    engine: A11yEngineType.AXE_CORE,
    ...overrides,
  };
}

// Made with Bob
