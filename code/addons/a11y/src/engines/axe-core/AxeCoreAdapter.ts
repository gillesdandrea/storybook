/** Storybook A11y Addon - Axe-Core Adapter Wraps axe-core engine with normalized interface */
import type { AxeResults, NodeResult, Result, RunOptions, Spec } from 'axe-core';

import type {
  A11yConfidence,
  A11yContext,
  A11yEngineConfig,
  A11yEngineType,
  A11yIssue,
  A11yIssueNode,
  A11yReport,
  A11ySeverity,
  IA11yEngine,
} from '../types';
import { AxeCoreRuleProvider } from '../../rules/providers/AxeCoreRuleProvider';

/**
 * Adapter for axe-core accessibility engine Maintains full backward compatibility with existing
 * axe-core usage
 */
export class AxeCoreAdapter implements IA11yEngine {
  readonly type: A11yEngineType = 'axe-core' as A11yEngineType;

  private axe: any = null;
  private initialized = false;
  private ruleProvider: AxeCoreRuleProvider | null = null;

  get version(): string {
    return this.axe?.version || 'unknown';
  }

  /** Initialize axe-core engine Uses dynamic import to support various bundler configurations */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('[Storybook A11y] Loading axe-core engine...');

      const axeCore = await import('axe-core');
      // Handle both ESM and UMD formats
      this.axe = axeCore?.default || (globalThis as any).axe;

      if (!this.axe) {
        throw new Error('Failed to load axe-core');
      }

      this.initialized = true;
      
      // Initialize rule provider
      this.ruleProvider = new AxeCoreRuleProvider(this.axe);
      
      console.log(`[Storybook A11y] ✓ axe-core engine loaded (v${this.version})`);
    } catch (error) {
      console.error('[Storybook A11y] ✗ Failed to load axe-core engine:', error);
      throw new Error(
        `Failed to initialize axe-core: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** Check if the engine is ready to run */
  isReady(): boolean {
    return this.initialized && this.axe !== null;
  }

  /** Run accessibility check using axe-core */
  async run(context: A11yContext, config: A11yEngineConfig): Promise<A11yReport> {
    if (!this.isReady()) {
      throw new Error('AxeCoreAdapter not initialized. Call initialize() first.');
    }

    const startTime = performance.now();

    try {
      // Convert normalized context to axe format
      const axeContext = this.convertContext(context);

      // Convert normalized config to axe format
      const { axeConfig, axeOptions } = this.convertConfig(config);

      // Reset and configure axe
      this.axe.reset();
      if (axeConfig && Object.keys(axeConfig).length > 0) {
        this.axe.configure(axeConfig);
      }

      // Run axe-core
      const axeResults: AxeResults = await this.axe.run(axeContext, axeOptions);

      const executionTime = performance.now() - startTime;

      // Convert results to normalized format
      return this.convertResults(axeResults, executionTime);
    } catch (error) {
      throw new Error(
        `Axe-core execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** Get available rules from axe-core */
  async getRules(): Promise<Array<{ id: string; description: string; tags: string[] }>> {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const rules = this.axe.getRules();
      return rules.map((rule: any) => ({
        id: rule.ruleId,
        description: rule.description || rule.help || rule.ruleId,
        tags: rule.tags || [],
      }));
    } catch (error) {
      console.warn('Failed to get axe-core rules:', error);
      return [];
    }
  }

  /** Get the rule provider for this engine */
  getRuleProvider(): AxeCoreRuleProvider | null {
    return this.ruleProvider;
  }

  /** Get the underlying axe instance (for advanced usage) */
  getAxeInstance(): any {
    return this.axe;
  }

  /** Cleanup axe-core resources */
  async cleanup(): Promise<void> {
    if (this.axe) {
      try {
        this.axe.reset();
      } catch (error) {
        console.warn('Error during axe-core cleanup:', error);
      }
    }
    this.axe = null;
    this.initialized = false;
  }

  /** Convert normalized context to axe-core format */
  private convertContext(context: A11yContext): Spec {
    const axeContext: Spec = {
      include: [],
      exclude: [],
    };

    // Handle include
    if (context.include) {
      if (context.include instanceof Node) {
        axeContext.include = [[context.include as any]];
      } else if (typeof context.include === 'string') {
        axeContext.include = [[context.include]];
      } else if (Array.isArray(context.include)) {
        if (context.include.length > 0) {
          if (context.include[0] instanceof Node) {
            axeContext.include = context.include.map((node) => [node as any]);
          } else {
            axeContext.include = [context.include as string[]];
          }
        }
      }
    }

    // Default to document.body if no include specified
    if (!axeContext.include || axeContext.include.length === 0) {
      axeContext.include = [[document.body]];
    }

    // Handle exclude
    if (context.exclude) {
      if (typeof context.exclude === 'string') {
        axeContext.exclude = [[context.exclude]];
      } else if (Array.isArray(context.exclude)) {
        if (context.exclude.length > 0) {
          if (context.exclude[0] instanceof Node) {
            axeContext.exclude = context.exclude.map((node) => [node as any]);
          } else {
            axeContext.exclude = [context.exclude as string[]];
          }
        }
      }
    }

    return axeContext;
  }

  /** Convert normalized config to axe-core format */
  private convertConfig(config: A11yEngineConfig): { axeConfig: any; axeOptions: RunOptions } {
    const axeConfig: any = {
      rules: [],
    };

    const axeOptions: RunOptions = config.engineOptions || {};

    // Convert rule configuration
    if (config.rules) {
      for (const [ruleId, ruleConfig] of Object.entries(config.rules)) {
        axeConfig.rules.push({
          id: ruleId,
          enabled: ruleConfig.enabled,
          ...ruleConfig.options,
        });
      }
    }

    return { axeConfig, axeOptions };
  }

  /** Convert axe-core results to normalized format */
  private convertResults(axeResults: AxeResults, executionTime: number): A11yReport {
    const violations = axeResults.violations.map((v) => this.convertIssue(v, 'violation'));

    const passes = axeResults.passes.map((p) => this.convertIssue(p, 'pass'));

    const incomplete = axeResults.incomplete.map((i) => this.convertIssue(i, 'incomplete'));

    return {
      engine: this.type,
      timestamp: Date.now(),
      url: axeResults.url,
      violations,
      warnings: [], // Axe doesn't have a separate warnings category
      passes,
      incomplete,
      summary: {
        totalIssues: violations.length + incomplete.length,
        violationCount: violations.length,
        warningCount: 0,
        passCount: passes.length,
        incompleteCount: incomplete.length,
      },
      metadata: {
        executionTime,
        rulesExecuted: violations.length + passes.length + incomplete.length,
        engineVersion: this.version,
      },
    };
  }

  /** Convert a single axe-core result to normalized issue format */
  private convertIssue(result: Result, type: 'violation' | 'pass' | 'incomplete'): A11yIssue {
    return {
      id: `${result.id}-${type}`,
      ruleId: result.id,
      description: result.description,
      help: result.help,
      helpUrl: result.helpUrl,
      severity: this.mapSeverity(result.impact, type),
      confidence: this.mapConfidence(type),
      tags: result.tags,
      nodes: result.nodes.map((node) => this.convertNode(node)),
      engine: this.type,
      engineSpecific: {
        impact: result.impact,
        axeResult: result,
      },
    };
  }

  /** Convert axe-core node to normalized format */
  private convertNode(node: NodeResult): A11yIssueNode {
    return {
      html: node.html,
      target: Array.isArray(node.target) ? node.target.map(String) : [String(node.target)],
      xpath: Array.isArray(node.xpath) ? node.xpath.join(' | ') : node.xpath,
      any: node.any,
      all: node.all,
      none: node.none,
    };
  }

  /** Map axe-core impact levels to normalized severity */
  private mapSeverity(impact: string | undefined, type: string): A11ySeverity {
    if (type === 'pass') {
      return 'information' as A11ySeverity;
    }

    if (type === 'incomplete') {
      return 'warning' as A11ySeverity;
    }

    switch (impact) {
      case 'critical':
      case 'serious':
        return 'violation' as A11ySeverity;
      case 'moderate':
        return 'warning' as A11ySeverity;
      case 'minor':
        return 'recommendation' as A11ySeverity;
      default:
        return 'information' as A11ySeverity;
    }
  }

  /** Map result type to normalized confidence level */
  private mapConfidence(type: string): A11yConfidence {
    switch (type) {
      case 'violation':
        return 'certain' as A11yConfidence;
      case 'incomplete':
        return 'potential' as A11yConfidence;
      case 'pass':
        return 'certain' as A11yConfidence;
      default:
        return 'likely' as A11yConfidence;
    }
  }
}

