import type { ComponentProps } from 'react';
import type { Badge } from 'storybook/internal/components';
import type {
  A11yConfidence,
  A11yEngineType,
  A11yIssue,
  A11yIssueNode,
  A11ySeverity,
} from '../engines/types';

/**
 * Display-optimized severity information
 * Contains all UI-specific properties for rendering severity badges
 */
export interface DisplaySeverity {
  /** Severity level for programmatic use */
  level: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Human-readable label */
  label: string;
  /** Engine-specific severity label (e.g., "Serious" from axe-core, "Potential Violation" from equal-access) */
  engineLabel?: string;
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
  /** Engine that generated this report */
  engine: A11yEngineType;
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
