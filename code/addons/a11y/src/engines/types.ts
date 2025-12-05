/** Storybook A11y Addon - Multi-Engine Support Engine Abstraction Layer Types */

/** Supported accessibility testing engines */
export enum A11yEngineType {
  AXE_CORE = 'axe-core',
  EQUAL_ACCESS = 'equal-access',
}

/** Normalized severity levels across engines */
export enum A11ySeverity {
  VIOLATION = 'violation',
  WARNING = 'warning',
  RECOMMENDATION = 'recommendation',
  INFORMATION = 'information',
}

/** Normalized confidence levels across engines */
export enum A11yConfidence {
  CERTAIN = 'certain',
  LIKELY = 'likely',
  POTENTIAL = 'potential',
  MANUAL = 'manual',
}

/** Represents a single node/element with an accessibility issue */
export interface A11yIssueNode {
  /** HTML snippet of the element */
  html: string;
  /** CSS selector path to the element */
  target: string[];
  /** XPath to the element (optional) */
  xpath?: string;
  /** Bounding box of the element (optional) */
  bounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  /** Axe-core specific: checks that passed (for backward compatibility) */
  any?: Array<{ id: string; message: string; data?: unknown }>;
  /** Axe-core specific: checks that must all pass (for backward compatibility) */
  all?: Array<{ id: string; message: string; data?: unknown }>;
  /** Axe-core specific: checks that must not pass (for backward compatibility) */
  none?: Array<{ id: string; message: string; data?: unknown }>;
}

/** Normalized accessibility issue format */
export interface A11yIssue {
  /** Unique identifier for this issue instance */
  id: string;
  /** Rule identifier that triggered this issue */
  ruleId: string;
  /** Human-readable description of the issue */
  description: string;
  /** Help text explaining how to fix the issue */
  help: string;
  /** URL to detailed help documentation (optional) */
  helpUrl?: string;
  /** Severity level of the issue */
  severity: A11ySeverity;
  /** Confidence level of the detection */
  confidence: A11yConfidence;
  /** Tags/categories for this issue */
  tags: string[];
  /** DOM nodes affected by this issue */
  nodes: A11yIssueNode[];
  /** Engine that detected this issue */
  engine: A11yEngineType;
  /** Engine-specific data preserved for advanced use cases */
  engineSpecific?: Record<string, unknown>;
}

/** Normalized accessibility report format */
export interface A11yReport {
  /** Engine that generated this report */
  engine: A11yEngineType;
  /** Timestamp when the report was generated */
  timestamp: number;
  /** URL of the page tested (optional) */
  url?: string;

  /** Issues categorized by type */
  violations: A11yIssue[];
  warnings: A11yIssue[];
  passes: A11yIssue[];
  incomplete: A11yIssue[];

  /** Summary statistics */
  summary: {
    totalIssues: number;
    violationCount: number;
    warningCount: number;
    passCount: number;
    incompleteCount: number;
  };

  /** Execution metadata */
  metadata: {
    executionTime: number;
    rulesExecuted: number;
    engineVersion?: string;
  };
}

/** Configuration for an accessibility engine */
export interface A11yEngineConfig {
  /** Enable/disable the engine */
  enabled?: boolean;

  /** Rule-specific configuration */
  rules?: {
    [ruleId: string]: {
      enabled: boolean;
      options?: Record<string, unknown>;
    };
  };

  /** Engine-specific options */
  engineOptions?: Record<string, unknown>;
}

/** Context specification for accessibility testing */
export interface A11yContext {
  /** Elements to include in testing */
  include?: string | string[] | Node | Node[];
  /** Elements to exclude from testing */
  exclude?: string | string[] | Node | Node[];
}

/** Core interface that all accessibility engines must implement */
export interface IA11yEngine {
  /** Engine type identifier */
  readonly type: A11yEngineType;

  /** Engine version */
  readonly version: string;

  /**
   * Initialize the engine (load dependencies, configure)
   *
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>;

  /**
   * Check if the engine is ready to run
   *
   * @returns True if the engine is initialized and ready
   */
  isReady(): boolean;

  /**
   * Run accessibility check on the specified context
   *
   * @param context - DOM context to test
   * @param config - Engine configuration
   * @returns Promise resolving to normalized accessibility report
   */
  run(context: A11yContext, config: A11yEngineConfig): Promise<A11yReport>;

  /**
   * Get available rules for this engine
   *
   * @returns Promise resolving to array of rule metadata
   */
  getRules(): Promise<
    Array<{
      id: string;
      description: string;
      tags: string[];
    }>
  >;

  /**
   * Cleanup resources used by the engine
   *
   * @returns Promise that resolves when cleanup is complete
   */
  cleanup(): Promise<void>;
}

