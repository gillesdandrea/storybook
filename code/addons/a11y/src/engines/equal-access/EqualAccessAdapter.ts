import { A11yConfidence, A11yEngineType, A11ySeverity } from '../types';
import type {
  A11yContext,
  A11yEngineConfig,
  A11yIssue,
  A11yIssueNode,
  A11yReport,
  IA11yEngine,
} from '../types';

// IBM Equal Access types - using 'any' for now to avoid type conflicts
// The actual types will be resolved when the package is installed
type EqualAccessChecker = any;
type EqualAccessReport = any;
type EqualAccessIssue = any;
type EqualAccessGuideline = any;

// Policy and Confidence enums matching IBM Equal Access
enum EqualAccessPolicy {
  VIOLATION = 'VIOLATION',
  RECOMMENDATION = 'RECOMMENDATION',
  INFORMATION = 'INFORMATION',
}

enum EqualAccessConfidence {
  PASS = 'PASS',
  FAIL = 'FAIL',
  POTENTIAL = 'POTENTIAL',
  MANUAL = 'MANUAL',
}

/** Adapter for IBM Equal Access accessibility testing engine */
export class EqualAccessAdapter implements IA11yEngine {
  readonly type: A11yEngineType = A11yEngineType.EQUAL_ACCESS;
  readonly version: string = '3.1.0'; // Will be updated dynamically

  private checker: EqualAccessChecker | null = null;
  private initialized: boolean = false;
  private scriptLoaded: boolean = false;

  /** Load the IBM Equal Access engine script */
  private async loadEngineScript(): Promise<void> {
    if (this.scriptLoaded) {
      return;
    }

    // Check if already loaded globally
    if ((window as any).ace && (window as any).ace.Checker) {
      this.scriptLoaded = true;
      return;
    }

    // Load the UMD bundle by creating a script tag
    // This is the most reliable way to load UMD bundles that set globals
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');

      // Vite serves node_modules at this path in development
      // In production, the bundler will inline or copy the file
      script.src = '/node_modules/accessibility-checker-engine/ace.js';
      script.type = 'text/javascript';

      script.onload = () => {
        // Give the script time to execute and set the global
        setTimeout(() => {
          if ((window as any).ace && (window as any).ace.Checker) {
            this.scriptLoaded = true;
            resolve();
          } else {
            console.error('[Storybook A11y] window.ace:', (window as any).ace);
            reject(new Error('Script loaded but window.ace not found'));
          }
        }, 100);
      };

      script.onerror = (error) => {
        console.error('[Storybook A11y] Script load error:', error);
        reject(
          new Error(`Failed to load script from /node_modules/accessibility-checker-engine/ace.js`)
        );
      };

      document.head.appendChild(script);
    });
  }

  /** Initialize the IBM Equal Access engine */
  async initialize(): Promise<void> {
    if (this.initialized && this.checker) {
      return;
    }

    try {
      console.log('[Storybook A11y] Loading IBM Equal Access engine...');

      // The accessibility-checker-engine is a UMD bundle that creates a global 'ace' object
      // We need to load it as a script and access the global
      await this.loadEngineScript();

      // Access the global ace object
      const ace = (window as any).ace;

      if (!ace || !ace.Checker) {
        throw new Error('IBM Equal Access engine not found on window.ace');
      }

      this.checker = new ace.Checker();
      this.initialized = true;

      console.log(`[Storybook A11y] ✓ IBM Equal Access engine loaded (v${this.version})`);
    } catch (error) {
      console.error('[Storybook A11y] ✗ Failed to load IBM Equal Access engine:', error);
      throw new Error(
        `Failed to initialize IBM Equal Access engine: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Check if the engine is ready to run */
  isReady(): boolean {
    return this.initialized && this.checker !== null;
  }

  /** Run accessibility check using IBM Equal Access */
  async run(context: A11yContext, config: A11yEngineConfig): Promise<A11yReport> {
    if (!this.isReady()) {
      await this.initialize();
    }

    if (!this.checker) {
      throw new Error('IBM Equal Access engine not initialized');
    }

    const startTime = performance.now();

    try {
      // Determine the root node to scan
      const root = this.getContextRoot(context);

      // Prepare guideline IDs (rulesets)
      const guidelineIds = this.prepareGuidelineIds(config);

      // Configure rules if specified
      if (config.rules) {
        this.configureRules(config.rules);
      }

      // Run the check
      const report = await this.checker.check(root, guidelineIds);

      const executionTime = performance.now() - startTime;

      // Convert to normalized format
      return this.convertResults(report, executionTime);
    } catch (error) {
      throw new Error(
        `IBM Equal Access execution failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Get available rules from IBM Equal Access */
  async getRules(): Promise<Array<{ id: string; description: string; tags: string[] }>> {
    if (!this.isReady()) {
      await this.initialize();
    }

    if (!this.checker) {
      return [];
    }

    try {
      const ruleIds = this.checker.engine.getRulesIds();
      return ruleIds.map((ruleId: string) => {
        const rule = this.checker!.engine.getRule(ruleId);
        return {
          id: ruleId,
          description: rule?.messages?.['en-US']?.group || ruleId,
          tags: [], // Equal Access doesn't have tags like axe-core
        };
      });
    } catch (error) {
      console.warn('Failed to get IBM Equal Access rules:', error);
      return [];
    }
  }

  /** Cleanup IBM Equal Access resources */
  async cleanup(): Promise<void> {
    this.checker = null;
    this.initialized = false;
  }

  /** Get the root node from context */
  private getContextRoot(context: A11yContext): Node | Document {
    if (context.include instanceof Node) {
      return context.include;
    }

    if (typeof context.include === 'string') {
      const element = document.querySelector(context.include);
      if (element) {
        return element;
      }
    }

    // Default to document
    return document;
  }

  /** Prepare guideline IDs from config */
  private prepareGuidelineIds(config: A11yEngineConfig): string[] | undefined {
    // Check if engine-specific options specify guidelines
    if (config.engineOptions?.guidelines) {
      return Array.isArray(config.engineOptions.guidelines)
        ? config.engineOptions.guidelines
        : [config.engineOptions.guidelines];
    }

    // Default to IBM_Accessibility guideline
    return ['IBM_Accessibility'];
  }

  /** Configure rules based on config */
  private configureRules(rules: { [ruleId: string]: { enabled: boolean; options?: any } }): void {
    if (!this.checker) {
      return;
    }

    for (const [ruleId, ruleConfig] of Object.entries(rules)) {
      if (ruleConfig.enabled === false) {
        this.checker.disableRule(ruleId);
      } else {
        this.checker.enableRule(ruleId);
      }
    }
  }

  /** Convert IBM Equal Access results to normalized format */
  private convertResults(report: EqualAccessReport, executionTime: number): A11yReport {
    const issues = report.results.map((issue: any) => this.convertIssue(issue, report.nls));

    // Categorize issues
    const violations = issues.filter((i: A11yIssue) => i.severity === A11ySeverity.VIOLATION);
    const warnings = issues.filter((i: A11yIssue) => i.severity === A11ySeverity.WARNING);
    const passes = issues.filter(
      (i: A11yIssue) =>
        i.severity === A11ySeverity.INFORMATION && i.confidence === A11yConfidence.CERTAIN
    );
    const incomplete = issues.filter(
      (i: A11yIssue) =>
        i.confidence === A11yConfidence.POTENTIAL || i.confidence === A11yConfidence.MANUAL
    );

    return {
      engine: this.type,
      timestamp: Date.now(),
      url: window.location.href,
      violations,
      warnings,
      passes,
      incomplete,
      summary: {
        totalIssues: violations.length + warnings.length,
        violationCount: violations.length,
        warningCount: warnings.length,
        passCount: passes.length,
        incompleteCount: incomplete.length,
      },
      metadata: {
        executionTime,
        rulesExecuted: report.numExecuted,
        engineVersion: this.version,
      },
    };
  }

  /** Convert a single IBM Equal Access issue to normalized format */
  private convertIssue(issue: EqualAccessIssue, nls?: EqualAccessReport['nls']): A11yIssue {
    const [policy, confidence] = issue.value;

    // Get help URL
    const helpUrl = this.getHelpUrl(issue.ruleId, issue.reasonId);

    // Get localized message
    const message = this.getMessage(issue, nls);

    return {
      id: `${issue.ruleId}-${confidence}`,
      ruleId: issue.ruleId,
      description: message,
      help: message,
      helpUrl,
      severity: this.mapSeverity(policy, confidence),
      confidence: this.mapConfidence(confidence),
      tags: issue.category ? [issue.category] : [],
      nodes: [this.convertNode(issue)],
      engine: this.type,
      engineSpecific: {
        policy,
        confidence,
        reasonId: issue.reasonId,
        category: issue.category,
        equalAccessIssue: issue,
      },
    };
  }

  /** Convert IBM Equal Access issue node to normalized format */
  private convertNode(issue: EqualAccessIssue): A11yIssueNode {
    return {
      html: issue.snippet,
      target: issue.path.dom ? [issue.path.dom] : [],
      xpath: issue.path.xpath || undefined,
      bounds: issue.bounds,
    };
  }

  /** Map IBM Equal Access policy/confidence to normalized severity */
  private mapSeverity(policy: EqualAccessPolicy, confidence: EqualAccessConfidence): A11ySeverity {
    if (confidence === EqualAccessConfidence.PASS) {
      return A11ySeverity.INFORMATION;
    }

    switch (policy) {
      case EqualAccessPolicy.VIOLATION:
        return A11ySeverity.VIOLATION;
      case EqualAccessPolicy.RECOMMENDATION:
        return A11ySeverity.WARNING;
      case EqualAccessPolicy.INFORMATION:
        return A11ySeverity.INFORMATION;
      default:
        return A11ySeverity.INFORMATION;
    }
  }

  /** Map IBM Equal Access confidence to normalized confidence */
  private mapConfidence(confidence: EqualAccessConfidence): A11yConfidence {
    switch (confidence) {
      case EqualAccessConfidence.PASS:
        return A11yConfidence.CERTAIN;
      case EqualAccessConfidence.FAIL:
        return A11yConfidence.CERTAIN;
      case EqualAccessConfidence.POTENTIAL:
        return A11yConfidence.POTENTIAL;
      case EqualAccessConfidence.MANUAL:
        return A11yConfidence.MANUAL;
      default:
        return A11yConfidence.POTENTIAL;
    }
  }

  /** Get help URL for a rule */
  private getHelpUrl(ruleId: string, reasonId?: number | string): string {
    // IBM Equal Access help URLs follow a pattern
    const baseUrl = 'https://www.ibm.com/able/requirements/requirements';
    return `${baseUrl}/#${ruleId}`;
  }

  /** Get localized message for an issue */
  private getMessage(issue: EqualAccessIssue, nls?: EqualAccessReport['nls']): string {
    if (issue.message) {
      return issue.message;
    }

    if (nls && issue.ruleId in nls && issue.reasonId && issue.reasonId in nls[issue.ruleId]) {
      return nls[issue.ruleId][issue.reasonId];
    }

    return `Rule ${issue.ruleId} failed`;
  }
}

// Made with Bob
