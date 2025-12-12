import { ElementA11yParameterError } from 'storybook/internal/preview-errors';

import { global } from '@storybook/global';

import type { AxeResults } from 'axe-core';
import { addons, waitForAnimations } from 'storybook/preview-api';

import { withLinkPaths } from './a11yRunnerUtils';
import { EVENTS } from './constants';
import { EngineRegistry } from './engines/EngineRegistry';
import type { A11yContext, A11yEngineConfig, A11yEngineType, A11yReport } from './engines/types';
import type { A11yParameters } from './params';

const { document } = global;

const channel = addons.getChannel();

const DEFAULT_PARAMETERS: A11yParameters = {
  engine: 'axe-core' as A11yEngineType,
  config: {},
  options: {},
};

const DISABLED_RULES_AXE_CORE = [
  // In component testing, landmarks are not always present
  // and the rule check can cause false positives
  'region',
] as const;

const DISABLED_RULES_EQUAL_ACCESS = [
  // In component testing, landmarks are not always present
  // and the rule check can cause false positives
  'aria_content_in_landmark',
] as const;

// A simple queue to run axe-core in sequence
// This is necessary because axe-core is not designed to run in parallel
const queue: (() => Promise<void>)[] = [];
let isRunning = false;

// Track ongoing runs to prevent duplicates
const ongoingRuns = new Map<string, Promise<A11yReport | AxeResults>>();

const runNext = async () => {
  if (queue.length === 0) {
    isRunning = false;
    return;
  }

  isRunning = true;
  const next = queue.shift();
  if (next) {
    await next();
  }
  runNext();
};

export const run = async (
  input: A11yParameters = DEFAULT_PARAMETERS,
  storyId: string
): Promise<A11yReport | AxeResults> => {
  if ('element' in input) {
    throw new ElementA11yParameterError();
  }

  // Check if there's already an ongoing run for this story
  const ongoingRun = ongoingRuns.get(storyId);
  if (ongoingRun) {
    console.log(`[Storybook A11y] Reusing ongoing check for story ${storyId}`);
    return ongoingRun;
  }

  // Determine which engine to use (default to axe-core for backward compatibility)
  const engineType = (input.engine || 'axe-core') as A11yEngineType;

  console.log(`[Storybook A11y] Running accessibility check with ${engineType} engine`);
  
  // Create a placeholder promise and track it IMMEDIATELY to prevent race conditions
  // This must happen BEFORE any async operations (like engine initialization)
  let resolvePromise: (value: A11yReport | AxeResults) => void;
  let rejectPromise: (reason: any) => void;
  
  const runPromise = new Promise<A11yReport | AxeResults>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  
  // Track this run BEFORE doing anything else (especially before async operations)
  ongoingRuns.set(storyId, runPromise);

  // Now get or initialize the engine (this is async and may take time)
  const engine = await EngineRegistry.getOrInitialize(engineType);

  // Prepare context
  const context: A11yContext = {
    include: document?.body,
    exclude: ['.sb-wrapper', '#storybook-docs', '#storybook-highlights-root'],
  };

  if (input.context) {
    const hasInclude =
      typeof input.context === 'object' &&
      'include' in input.context &&
      input.context.include !== undefined;
    const hasExclude =
      typeof input.context === 'object' &&
      'exclude' in input.context &&
      input.context.exclude !== undefined;

    // 1. if context.include exists, use it
    if (hasInclude) {
      context.include = (input.context as { include: A11yContext['include'] }).include;
    } else if (!hasInclude && !hasExclude) {
      // 2. if context exists, but it's not an object with include or exclude, it's an implicit include
      context.include = input.context as A11yContext['include'];
    }

    // 3. if context.exclude exists, merge it with the default exclude
    if (hasExclude) {
      const userExclude = (input.context as { exclude: A11yContext['exclude'] }).exclude;
      if (Array.isArray(userExclude)) {
        context.exclude = [...(context.exclude as string[]), ...(userExclude as string[])];
      } else if (userExclude) {
        context.exclude = [...(context.exclude as string[]), userExclude as string];
      }
    }
  }

  // Prepare configuration
  const config: A11yEngineConfig = input.config || {};

  // Add default disabled rules based on engine type
  if (engineType === 'axe-core') {
    // Add default disabled rules for axe-core
    if (!config.rules) {
      config.rules = {};
    }
    for (const ruleId of DISABLED_RULES_AXE_CORE) {
      if (!(ruleId in config.rules)) {
        config.rules[ruleId] = { enabled: false };
      }
    }

    // Handle legacy options parameter
    if (input.options) {
      config.engineOptions = {
        ...config.engineOptions,
        ...input.options,
      };
    }

    // Handle legacy config parameter (axe-core specific format)
    if (input.config?.rules) {
      const legacyRules = input.config.rules as unknown as unknown[];
      if (Array.isArray(legacyRules)) {
        for (const rule of legacyRules) {
          const ruleObj = rule as { id?: string; enabled?: boolean };
          if (ruleObj.id) {
            config.rules[ruleObj.id] = {
              enabled: ruleObj.enabled !== false,
              options: rule as Record<string, unknown>,
            };
          }
        }
      }
    }
  } else if (engineType === 'equal-access') {
    // Add default disabled rules for equal-access
    if (!config.rules) {
      config.rules = {};
    }
    for (const ruleId of DISABLED_RULES_EQUAL_ACCESS) {
      if (!(ruleId in config.rules)) {
        config.rules[ruleId] = { enabled: false };
      }
    }

    // Normalize 'policies' parameter to 'engineOptions.guidelines'
    // This provides a user-friendly alias for the Equal Access guideline configuration
    if (input.config && 'policies' in input.config) {
      const policies = (input.config as any).policies;
      if (policies) {
        if (!config.engineOptions) {
          config.engineOptions = {};
        }
        // Only set guidelines if not already explicitly set
        if (!config.engineOptions.guidelines) {
          config.engineOptions.guidelines = Array.isArray(policies) ? policies : [policies];
        }
      }
    }

    // Normalize 'reportLevels' parameter to 'engineOptions.reportLevels'
    // This provides filtering of results by report level
    if (input.config && 'reportLevels' in input.config) {
      const reportLevels = (input.config as any).reportLevels;
      if (reportLevels && Array.isArray(reportLevels)) {
        if (!config.engineOptions) {
          config.engineOptions = {};
        }
        // Only set reportLevels if not already explicitly set
        if (!config.engineOptions.reportLevels) {
          config.engineOptions.reportLevels = reportLevels;
        }
      }
    }
  }

  // Handle array-based rules configuration for all engines
  // Convert array format [{ id: 'rule1', enabled: false }] to object format { rule1: { enabled: false } }
  if (input.config?.rules) {
    const rulesConfig = input.config.rules as unknown as unknown[];
    if (Array.isArray(rulesConfig)) {
      if (!config.rules) {
        config.rules = {};
      }
      for (const rule of rulesConfig) {
        const ruleObj = rule as { id?: string; enabled?: boolean; [key: string]: unknown };
        if (ruleObj.id) {
          config.rules[ruleObj.id] = {
            enabled: ruleObj.enabled !== false,
            options: rule as Record<string, unknown>,
          };
        }
      }
    }
  }

  // Now set up the actual work
  const highlightsRoot = document?.getElementById('storybook-highlights-root');
  if (highlightsRoot) {
    highlightsRoot.style.display = 'none';
  }

  const task = async () => {
    try {
      const result = await engine.run(context, config);

      // Log results summary
      const violationCount = result.violations?.length || 0;
      const passCount = result.passes?.length || 0;
      const incompleteCount = result.incomplete?.length || 0;
      console.log(
        `[Storybook A11y] Check complete: ${violationCount} violations, ${passCount} passes, ${incompleteCount} incomplete`
      );

      // Convert to AxeResults format for backward compatibility and add link paths
      const axeResult = convertToAxeResults(result);
      const resultWithLinks = withLinkPaths(axeResult, storyId);
      
      // Clean up tracking before resolving
      ongoingRuns.delete(storyId);
      
      resolvePromise!(resultWithLinks);
    } catch (error) {
      console.error(`[Storybook A11y] Check failed with ${engineType} engine:`, error);
      // Clean up tracking before rejecting
      ongoingRuns.delete(storyId);
      rejectPromise!(error);
    } finally {
      if (highlightsRoot) {
        highlightsRoot.style.display = '';
      }
    }
  };

  queue.push(task);

  if (!isRunning) {
    runNext();
  }
  
  return runPromise;
};

/** Convert normalized A11yReport back to AxeResults format for backward compatibility */
function convertToAxeResults(report: A11yReport): AxeResults {
  // Combine violations and warnings since axe-core doesn't have a separate warnings category
  const allViolations = [
    ...report.violations.map((issue) => convertIssueToResult(issue)),
    ...report.warnings.map((issue) => convertIssueToResult(issue)),
  ];

  return {
    url: report.url || '',
    timestamp: new Date(report.timestamp).toISOString(),
    testEngine: {
      name: report.engine,
      version: report.metadata.engineVersion || 'unknown',
    },
    testRunner: {
      name: 'storybook-addon-a11y',
    },
    testEnvironment: {
      userAgent: navigator.userAgent,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      orientationAngle: (window.screen as { orientation?: { angle?: number } }).orientation?.angle,
      orientationType: (window.screen as { orientation?: { type?: string } }).orientation?.type,
    },
    toolOptions: {},
    violations: allViolations,
    passes: report.passes.map((issue) => convertIssueToResult(issue)),
    incomplete: report.incomplete.map((issue) => convertIssueToResult(issue)),
    inapplicable: [],
    // Preserve engine and metadata for the manager to display
    engine: report.engine,
    metadata: report.metadata,
  } as AxeResults;
}

function convertIssueToResult(issue: unknown): unknown {
  const issueObj = issue as {
    engineSpecific?: { axeResult?: unknown; impact?: string };
    ruleId?: string;
    tags?: string[];
    description?: string;
    help?: string;
    helpUrl?: string;
    nodes?: Array<{
      html?: string;
      target?: string[];
      xpath?: string;
      [key: string]: unknown;
    }>;
  };

  // If we have the original axe-core result stored, use it directly
  // This preserves all axe-specific properties like 'any', 'all', 'none'
  // But also add normalized severity and confidence for display
  if (issueObj.engineSpecific?.axeResult) {
    return {
      ...issueObj.engineSpecific.axeResult,
      severity: (issueObj as { severity?: string }).severity,
      confidence: (issueObj as { confidence?: string }).confidence,
    };
  }

  // Fallback: construct a basic result for non-axe engines (e.g., IBM Equal Access)
  // Preserve all node properties to maintain backward compatibility
  // But exclude DOM element references that cause circular structure errors
  return {
    id: issueObj.ruleId,
    ruleId: issueObj.ruleId, // Preserve ruleId field
    engine: (issueObj as { engine?: string }).engine, // Preserve engine field
    impact: issueObj.engineSpecific?.impact,
    tags: issueObj.tags,
    description: issueObj.description,
    help: issueObj.help,
    helpUrl: issueObj.helpUrl,
    // Preserve normalized severity and confidence for display
    severity: (issueObj as { severity?: string }).severity,
    confidence: (issueObj as { confidence?: string }).confidence,
    nodes: issueObj.nodes?.map((node) => {
      // Create a clean node object without DOM references
      const cleanNode: Record<string, unknown> = {
        html: node.html,
        target: node.target,
        xpath: node.xpath,
      };
      
      // Preserve specific axe-core properties (any, all, none) if they exist
      // These are arrays of check results, not DOM elements
      if ('any' in node && Array.isArray(node.any)) {
        cleanNode.any = node.any;
      }
      if ('all' in node && Array.isArray(node.all)) {
        cleanNode.all = node.all;
      }
      if ('none' in node && Array.isArray(node.none)) {
        cleanNode.none = node.none;
      }
      
      // Preserve other safe properties (strings, numbers, booleans, arrays, plain objects)
      // but skip DOM elements and functions
      for (const [key, value] of Object.entries(node)) {
        if (key in cleanNode) continue; // Already handled
        
        const valueType = typeof value;
        if (valueType === 'function') continue; // Skip functions
        if (value instanceof Element) continue; // Skip DOM elements
        if (value instanceof Node) continue; // Skip DOM nodes
        
        // Include primitives and serializable objects
        if (
          value === null ||
          valueType === 'string' ||
          valueType === 'number' ||
          valueType === 'boolean' ||
          Array.isArray(value) ||
          (valueType === 'object' && value && value.constructor === Object)
        ) {
          cleanNode[key] = value;
        }
      }
      
      return cleanNode;
    }),
    // Preserve engineSpecific data for Equal Access and other engines
    engineSpecific: issueObj.engineSpecific,
  };
}

channel.on(EVENTS.MANUAL, async (storyId: string, input: A11yParameters = DEFAULT_PARAMETERS) => {
  try {
    await waitForAnimations();
    
    // Get the engine and its rule provider
    const engineType = (input.engine || 'axe-core') as A11yEngineType;
    const engine = await EngineRegistry.getOrInitialize(engineType);
    // Cast to access getRuleProvider (not in IA11yEngine interface but available on adapters)
    const provider = (engine as { getRuleProvider?: () => { getAllRules: () => Promise<unknown[]> } }).getRuleProvider?.();
    
    // Send rule metadata to manager if provider is available
    if (provider) {
      try {
        const rules = await provider.getAllRules();
        // Serialize rules to avoid telejson issues
        const rulesJson = JSON.parse(JSON.stringify(rules));
        channel.emit(EVENTS.RULES_METADATA, rulesJson, engineType);
      } catch (error) {
        console.warn('[Storybook A11y] Failed to send rule metadata:', error);
      }
    }
    
    const result = await run(input, storyId);
    
    console.log('[a11yRunner] Result before serialization:', {
      engine: (result as any).engine || (result as any).testEngine?.name,
      violationCount: result.violations?.length || 0,
      firstViolation: result.violations?.[0] ? {
        id: (result.violations[0] as any).id,
        ruleId: (result.violations[0] as any).ruleId,
        severity: (result.violations[0] as any).severity,
        confidence: (result.violations[0] as any).confidence,
      } : null,
    });
    
    // Axe result contains class instances, which telejson deserializes in a
    // way that violates:
    //  Content Security Policy directive: "script-src 'self' 'unsafe-inline'".
    const resultJson = JSON.parse(JSON.stringify(result));
    
    console.log('[a11yRunner] Result after serialization:', {
      engine: resultJson.engine || resultJson.testEngine?.name,
      violationCount: resultJson.violations?.length || 0,
      firstViolation: resultJson.violations?.[0] ? {
        id: resultJson.violations[0].id,
        ruleId: resultJson.violations[0].ruleId,
        severity: resultJson.violations[0].severity,
        confidence: resultJson.violations[0].confidence,
      } : null,
    });
    
    channel.emit(EVENTS.RESULT, resultJson, storyId);
  } catch (error) {
    channel.emit(EVENTS.ERROR, error);
  }
});
