import { A11yConfidence, A11yEngineType, A11ySeverity } from '../types';
import type {
  A11yContext,
  A11yEngineConfig,
  A11yIssue,
  A11yIssueNode,
  A11yReport,
  IA11yEngine,
} from '../types';
import { EqualAccessRuleProvider } from '../../rules/providers/EqualAccessRuleProvider';
import type { Checker } from 'accessibility-checker-engine';
import type { Report } from 'accessibility-checker-engine/v4/api/IReport';
import type { eRulePolicy, eRuleConfidence, Issue } from 'accessibility-checker-engine/v4/api/IRule';
import type { Guideline } from 'accessibility-checker-engine/v4/api/IGuideline';

// IBM Equal Access types
type EqualAccessChecker = Checker;
type EqualAccessReport = Report;
type EqualAccessIssue = Issue;
type EqualAccessGuideline = Guideline;

// Use the actual enums from the library
type EqualAccessPolicy = eRulePolicy;
type EqualAccessConfidence = eRuleConfidence;

// Re-export enum values for convenience
const EqualAccessPolicy = {
  VIOLATION: 'VIOLATION' as eRulePolicy,
  RECOMMENDATION: 'RECOMMENDATION' as eRulePolicy,
  INFORMATION: 'INFORMATION' as eRulePolicy,
};

const EqualAccessConfidence = {
  PASS: 'PASS' as eRuleConfidence,
  FAIL: 'FAIL' as eRuleConfidence,
  POTENTIAL: 'POTENTIAL' as eRuleConfidence,
  MANUAL: 'MANUAL' as eRuleConfidence,
};

/** Adapter for IBM Equal Access accessibility testing engine */
export class EqualAccessAdapter implements IA11yEngine {
  readonly type: A11yEngineType = A11yEngineType.EQUAL_ACCESS;
  readonly version: string = '4.0.9'; // IBM Equal Access Checker Engine version

  private checker: EqualAccessChecker | null = null;
  private initialized: boolean = false;
  private initializing: boolean = false;
  private scriptLoaded: boolean = false;
  private ruleProvider: EqualAccessRuleProvider | null = null;

  /** Load the IBM Equal Access engine script */
  private async loadEngineScript(): Promise<void> {
    if (this.scriptLoaded) {
      return;
    }

    // Check if already loaded globally
    const globalWindow = window as Window & { ace?: { Checker: typeof Checker } };
    if (globalWindow.ace && globalWindow.ace.Checker) {
      this.scriptLoaded = true;
      return;
    }

    try {
      // Import the raw script content using Vite's ?raw suffix
      // This prevents Vite from processing it as an ES module
      // @ts-ignore - Vite's ?raw suffix is not recognized by TypeScript
      const aceRaw = await import('accessibility-checker-engine/ace.js?raw');
      const scriptContent = aceRaw.default as string;
      
      if (!scriptContent) {
        throw new Error('Failed to load raw script content');
      }
      
      // Create a script element and inject the code
      // This ensures it executes in the global scope where it can set window.ace
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
      
      // Wait for the script to execute and set globals
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if window.ace was set
      const globalWindowAfter = window as Window & { ace?: { Checker: typeof Checker } };
      if (globalWindowAfter.ace && globalWindowAfter.ace.Checker) {
        this.scriptLoaded = true;
        console.log('[Storybook A11y] ✓ IBM Equal Access engine loaded');
        // Clean up the script element
        document.head.removeChild(script);
        return;
      }
      
      // Clean up on failure
      document.head.removeChild(script);
      throw new Error('Script executed but window.ace not set');
    } catch (error) {
      console.error('[Storybook A11y] Failed to load IBM Equal Access engine:', error);
      throw new Error(
        `Failed to load IBM Equal Access engine: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Initialize the IBM Equal Access engine */
  async initialize(): Promise<void> {
    // Check if already initialized
    if (this.initialized && this.checker) {
      return;
    }

    // Check if initialization is in progress (prevent race condition)
    if (this.initializing) {
      // Wait for initialization to complete
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return;
    }

    // Mark as initializing to prevent concurrent initialization
    this.initializing = true;

    try {
      console.log('[Storybook A11y] Loading IBM Equal Access engine...');

      // The accessibility-checker-engine is a UMD bundle that creates a global 'ace' object
      // We need to load it as a script and access the global
      await this.loadEngineScript();

      // Access the global ace object
      const globalWindow = window as Window & { ace?: { Checker: typeof Checker; engine: unknown } };
      const ace = globalWindow.ace;

      if (!ace || !ace.Checker) {
        throw new Error('IBM Equal Access engine not found on window.ace');
      }

      this.checker = new ace.Checker();
      this.initialized = true;

      // Initialize rule provider
      // Note: ace.engine has the getRulesIds() and getRule() methods
      this.ruleProvider = new EqualAccessRuleProvider({
        engine: (ace as any).engine as { getRulesIds: () => string[]; getRule: (ruleId: string) => unknown },
        Checker: ace.Checker
      });
      
      console.log(`[Storybook A11y] ✓ IBM Equal Access engine loaded (v${this.version})`);
    } catch (error) {
      console.error('[Storybook A11y] ✗ Failed to load IBM Equal Access engine:', error);
      throw new Error(
        `Failed to initialize IBM Equal Access engine: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      // Always clear the initializing flag
      this.initializing = false;
    }
  }

  /** Check if the engine is ready to run */
  isReady(): boolean {
    return this.initialized && this.checker !== null;
  }

  /** Run accessibility check using IBM Equal Access */
  async run(context: A11yContext, config: A11yEngineConfig): Promise<A11yReport> {
    if (!this.checker) {
      throw new Error('IBM Equal Access engine not initialized. Call initialize() first.');
    }

    const startTime = performance.now();

    try {
      // Determine the root node to scan
      const root = this.getContextRoot(context);

      // Prepare guideline IDs (rulesets)
      const guidelineIds = this.prepareGuidelineIds(config);

      // Run the check (don't configure rules before check as it affects the checker globally)
      const report = await this.checker.check(root, guidelineIds);

      const executionTime = performance.now() - startTime;

      // Convert to normalized format and filter results based on rule configuration
      return this.convertResults(report, executionTime, config.rules);
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
    this.ruleProvider = null;
  }

  /** Get the rule provider for this engine */
  getRuleProvider(): EqualAccessRuleProvider | null {
    return this.ruleProvider;
  }

  /** Get the underlying checker instance (for advanced usage) */
  getCheckerInstance(): EqualAccessChecker | null {
    return this.checker;
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
      const guidelines = config.engineOptions.guidelines;
      return Array.isArray(guidelines)
        ? (guidelines as string[])
        : [String(guidelines)];
    }

    // Default to IBM_Accessibility guideline
    return ['IBM_Accessibility'];
  }


  /** Convert IBM Equal Access results to normalized format */
  private convertResults(
    report: EqualAccessReport,
    executionTime: number,
    rulesConfig?: { [ruleId: string]: { enabled: boolean; options?: Record<string, unknown> } }
  ): A11yReport {
    // First, convert all issues to determine their category
    let allIssues = report.results.map((issue: EqualAccessIssue) => this.convertIssue(issue, report.nls));
    
    // Filter out issues for rules that are explicitly disabled
    if (rulesConfig) {
      allIssues = allIssues.filter((issue: A11yIssue) => {
        const ruleConfig = rulesConfig[issue.ruleId];
        // Only filter out if explicitly disabled (enabled === false)
        // If not in config or enabled === true, keep the issue
        return !ruleConfig || ruleConfig.enabled !== false;
      });
    }

    // Categorize issues first
    // Items with POTENTIAL or MANUAL confidence should only appear in incomplete, not in violations/warnings
    const incompleteIssues = allIssues.filter(
      (i: A11yIssue) =>
        i.confidence === A11yConfidence.POTENTIAL || i.confidence === A11yConfidence.MANUAL
    );
    
    const violationIssues = allIssues.filter(
      (i: A11yIssue) =>
        i.severity === A11ySeverity.VIOLATION &&
        i.confidence !== A11yConfidence.POTENTIAL &&
        i.confidence !== A11yConfidence.MANUAL
    );
    
    const warningIssues = allIssues.filter(
      (i: A11yIssue) =>
        i.severity === A11ySeverity.WARNING &&
        i.confidence !== A11yConfidence.POTENTIAL &&
        i.confidence !== A11yConfidence.MANUAL
    );
    
    const passIssues = allIssues.filter(
      (i: A11yIssue) =>
        i.severity === A11ySeverity.INFORMATION && i.confidence === A11yConfidence.CERTAIN
    );

    // Now group each category by ruleId
    const incomplete = this.groupIssuesByRuleId(incompleteIssues);
    const violations = this.groupIssuesByRuleId(violationIssues);
    const warnings = this.groupIssuesByRuleId(warningIssues);
    const passes = this.groupIssuesByRuleId(passIssues);

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

  /** Group issues by ruleId, combining nodes from issues with the same rule */
  private groupIssuesByRuleId(issues: A11yIssue[]): A11yIssue[] {
    const issuesByRuleId = new Map<string, A11yIssue>();
    
    for (const issue of issues) {
      const ruleId = issue.ruleId;
      
      if (issuesByRuleId.has(ruleId)) {
        // Add nodes to existing issue
        const existingIssue = issuesByRuleId.get(ruleId)!;
        existingIssue.nodes.push(...issue.nodes);
      } else {
        // Create new entry with this issue
        issuesByRuleId.set(ruleId, issue);
      }
    }
    
    return Array.from(issuesByRuleId.values());
  }

  /** Convert a single IBM Equal Access issue to normalized format */
  private convertIssue(issue: EqualAccessIssue, nls?: EqualAccessReport['nls']): A11yIssue {
    const [policy, confidence] = issue.value;

    // Get help URL with full issue context
    const helpUrl = this.getHelpUrl(issue);

    // Get rule title and description
    // Title: specific failure message (e.g., "Content is not within a landmark element")
    // Description: general rule description (e.g., "All content must reside within an element with a landmark role")
    const ruleTitle = this.getRuleTitle(issue, nls);
    const ruleDescription = this.getRuleDescription(issue, nls);

    return {
      id: issue.ruleId, // Use just the rule ID for cleaner display
      ruleId: issue.ruleId,
      description: ruleDescription, // General description for details panel
      help: ruleDescription, // Same description for help text
      helpUrl,
      severity: this.mapSeverity(policy, confidence),
      confidence: this.mapConfidence(confidence),
      tags: issue.category ? [issue.category] : [],
      nodes: [this.convertNode(issue, ruleTitle)],
      engine: this.type,
      engineSpecific: {
        title: ruleTitle, // Specific failure message for list display
        policy,
        confidence,
        reasonId: issue.reasonId,
        category: issue.category,
        equalAccessIssue: issue,
        // Store severity as impact for backward compatibility with Report component
        impact: this.mapSeverityToImpact(this.mapSeverity(policy, confidence)),
      },
    };
  }

  /** Convert IBM Equal Access issue node to normalized format */
  private convertNode(issue: EqualAccessIssue, specificMessage: string): A11yIssueNode {
    // Generate CSS selector from the actual element
    // IBM Equal Access provides the element reference in issue.node
    const cssSelector = this.generateCssSelector(issue.node as Element);

    return {
      html: issue.snippet,
      target: cssSelector ? [cssSelector] : [],
      xpath: issue.path.xpath || issue.path.dom || undefined,
      bounds: issue.bounds,
      // Add axe-core compatibility properties for Details component
      // Store the specific error message in the 'any' array so Details can display it
      any: [{
        id: String(issue.reasonId || issue.ruleId),
        message: specificMessage,
        data: { reasonId: issue.reasonId }
      }],
      all: [],
      none: [],
    };
  }

  /**
   * Generate a CSS selector for an element that works within the iframe context This creates a
   * selector relative to the document root, similar to axe-core
   */
  private generateCssSelector(element: Element | undefined): string | null {
    if (!element || !(element instanceof Element)) {
      return null;
    }

    try {
      // Build selector path from element to root
      const path: string[] = [];
      let current: Element | null = element;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.tagName.toLowerCase();

        // Add ID if available (most specific)
        if (current.id) {
          selector += `#${CSS.escape(current.id)}`;
          path.unshift(selector);
          break; // ID is unique, we can stop here
        }

        // Add classes if available
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).filter(Boolean);
          if (classes.length > 0) {
            selector += '.' + classes.map((c) => CSS.escape(c)).join('.');
          }
        }

        // Add nth-of-type if needed for specificity
        if (current.parentElement) {
          const siblings = Array.from(current.parentElement.children).filter(
            (el) => el.tagName === current!.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }

        path.unshift(selector);

        // Stop at body to keep selectors manageable
        if (current.tagName.toLowerCase() === 'body') {
          break;
        }

        current = current.parentElement;
      }

      return path.join(' > ');
    } catch (error) {
      console.warn('[Storybook A11y] Failed to generate CSS selector:', error);
      return null;
    }
  }

  /** Map IBM Equal Access policy/confidence to normalized severity */
  private mapSeverity(policy: EqualAccessPolicy, confidence: EqualAccessConfidence): A11ySeverity {
    // PASS results are always informational
    if (confidence === EqualAccessConfidence.PASS) {
      return A11ySeverity.INFORMATION;
    }

    // POTENTIAL and MANUAL confidence levels should be treated as "Need Review" (WARNING)
    // regardless of policy, since they require manual verification
    if (confidence === EqualAccessConfidence.POTENTIAL || confidence === EqualAccessConfidence.MANUAL) {
      return A11ySeverity.WARNING;
    }

    // For FAIL confidence, use the policy to determine severity
    switch (policy) {
      case EqualAccessPolicy.VIOLATION:
        return A11ySeverity.VIOLATION;
      case EqualAccessPolicy.RECOMMENDATION:
        return A11ySeverity.RECOMMENDATION;
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

  /** Map normalized severity to custom impact values for equal-access display */
  private mapSeverityToImpact(severity: A11ySeverity): string {
    // Use custom impact values that will be recognized by the Report component
    // These map directly to the severity labels we want to display
    switch (severity) {
      case A11ySeverity.VIOLATION:
        return 'violation';
      case A11ySeverity.WARNING:
        return 'needsReview';
      case A11ySeverity.RECOMMENDATION:
        return 'recommendation';
      case A11ySeverity.INFORMATION:
        return 'information';
      default:
        return 'information';
    }
  }

  /** Get help URL for a rule */
  private getHelpUrl(issue: EqualAccessIssue): string {
    // IBM Equal Access help URLs are hosted on unpkg CDN
    // Format: https://unpkg.com/accessibility-checker-engine@{version}/help/en-US/{ruleId}.html#{fragment}
    // The help page JavaScript (help.js) parses the fragment to display issue details

    // Build the fragment with issue details that help.js expects
    const fragment = {
      message: issue.message,
      msgArgs: (issue as unknown as { msgArgs?: string[] }).msgArgs || [],
      value: issue.value,
      reasonId: issue.reasonId,
      snippet: issue.snippet, // Include snippet for "Element location" section
    };

    const encodedFragment = encodeURIComponent(JSON.stringify(fragment));

    return `https://unpkg.com/accessibility-checker-engine@${this.version}/help/en-US/${issue.ruleId}.html#${encodedFragment}`;
  }

  /**
   * Replace message template placeholders with actual values
   * E.g., "{0} input and others with the name \"{1}\" are not grouped together"
   * becomes "Radio input and others with the name \"b\" are not grouped together"
   */
  private fillMessageParameters(template: string, msgArgs: string[]): string {
    if (!msgArgs || msgArgs.length === 0) {
      return template;
    }

    let result = template;
    msgArgs.forEach((arg, index) => {
      // Replace {0}, {1}, etc. with actual values
      result = result.replace(new RegExp(`\\{${index}\\}`, 'g'), arg);
    });
    
    return result;
  }

  /** Get rule title from engine metadata */
  private getRuleTitle(issue: EqualAccessIssue, nls?: EqualAccessReport['nls']): string {
    // PRIORITY 1: Use issue.message if available - it already has parameters filled in by the engine
    if (issue.message) {
      return issue.message;
    }
    
    // PRIORITY 2: Get msgArgs for parameter substitution in templates
    const msgArgs = (issue as unknown as { msgArgs?: string[] }).msgArgs || [];
    
    // Try to get the specific message for this reasonId from the engine's rule metadata
    if (this.checker && this.checker.engine) {
      try {
        const rule = this.checker.engine.getRule(issue.ruleId);
        
        if (rule && rule.messages && rule.messages['en-US']) {
          // Try specific reasonId message first
          if (issue.reasonId) {
            const specificMessage = rule.messages['en-US'][issue.reasonId];
            if (specificMessage && specificMessage !== 'Rule Passed') {
              return this.fillMessageParameters(specificMessage, msgArgs);
            }
          }
          // Fall back to group message if reasonId message not found
          if (rule.messages['en-US'].group) {
            return this.fillMessageParameters(rule.messages['en-US'].group, msgArgs);
          }
        }
      } catch (error) {
        // Silently handle errors
      }
    }

    // Try to get from NLS data in the report
    if (nls && issue.ruleId in nls) {
      // Try specific reasonId message first
      if (issue.reasonId && issue.reasonId in nls[issue.ruleId]) {
        return this.fillMessageParameters(nls[issue.ruleId][issue.reasonId], msgArgs);
      }
      // Fall back to group message
      if ('group' in nls[issue.ruleId]) {
        return this.fillMessageParameters(nls[issue.ruleId].group, msgArgs);
      }
    }

    // Final fallback to rule ID
    return issue.ruleId;
  }

  /** Get the group description (general rule description) */
  private getRuleDescription(issue: EqualAccessIssue, nls?: EqualAccessReport['nls']): string {
    // Get msgArgs for parameter substitution
    const msgArgs = (issue as unknown as { msgArgs?: string[] }).msgArgs || [];
    
    // Try to get the group message from the engine's rule metadata
    // This gives us the general description like "All content must reside within an element with a landmark role"
    if (this.checker && this.checker.engine) {
      try {
        const rule = this.checker.engine.getRule(issue.ruleId);
        if (rule && rule.messages && rule.messages['en-US'] && rule.messages['en-US'].group) {
          return this.fillMessageParameters(rule.messages['en-US'].group, msgArgs);
        }
      } catch (error) {
        // Fall through to NLS data
      }
    }

    // Try to get from NLS data in the report
    if (nls && issue.ruleId in nls && 'group' in nls[issue.ruleId]) {
      return this.fillMessageParameters(nls[issue.ruleId].group, msgArgs);
    }

    // Fall back to getMessage
    return this.getMessage(issue, nls);
  }

  /** Get short group message for an issue (used as description) */
  private getGroupMessage(issue: EqualAccessIssue, nls?: EqualAccessReport['nls']): string {
    // Get msgArgs for parameter substitution
    const msgArgs = (issue as unknown as { msgArgs?: string[] }).msgArgs || [];
    
    // Try to get the group message from NLS data
    if (nls && issue.ruleId in nls && 'group' in nls[issue.ruleId]) {
      return this.fillMessageParameters(nls[issue.ruleId].group, msgArgs);
    }

    // Fall back to the detailed message if group message not available
    return this.getMessage(issue, nls);
  }

  /** Get detailed localized message for an issue */
  private getMessage(issue: EqualAccessIssue, nls?: EqualAccessReport['nls']): string {
    // Get msgArgs for parameter substitution
    const msgArgs = (issue as unknown as { msgArgs?: string[] }).msgArgs || [];
    
    if (issue.message) {
      // The issue.message should already have parameters filled in by the engine
      return issue.message;
    }

    if (nls && issue.ruleId in nls && issue.reasonId && issue.reasonId in nls[issue.ruleId]) {
      return this.fillMessageParameters(nls[issue.ruleId][issue.reasonId], msgArgs);
    }

    return `Rule ${issue.ruleId} failed`;
  }
}

