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

const DISABLED_RULES = [
  // In component testing, landmarks are not always present
  // and the rule check can cause false positives
  'region',
] as const;

// A simple queue to run axe-core in sequence
// This is necessary because axe-core is not designed to run in parallel
const queue: (() => Promise<void>)[] = [];
let isRunning = false;

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
  // @ts-expect-error - the whole point of this is to error if 'element' is passed
  if (input.element) {
    throw new ElementA11yParameterError();
  }

  // Determine which engine to use (default to axe-core for backward compatibility)
  const engineType = (input.engine || 'axe-core') as A11yEngineType;

  console.log(`[Storybook A11y] Running accessibility check with ${engineType} engine`);

  // Get or initialize the engine
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
      context.include = (input.context as any).include;
    } else if (!hasInclude && !hasExclude) {
      // 2. if context exists, but it's not an object with include or exclude, it's an implicit include
      context.include = input.context as any;
    }

    // 3. if context.exclude exists, merge it with the default exclude
    if (hasExclude) {
      const userExclude = (input.context as any).exclude;
      context.exclude = Array.isArray(userExclude)
        ? [...(context.exclude as string[]), ...userExclude]
        : [...(context.exclude as string[]), userExclude];
    }
  }

  // Prepare configuration
  const config: A11yEngineConfig = input.config || {};

  // Handle legacy axe-core configuration for backward compatibility
  if (engineType === 'axe-core') {
    // Add default disabled rules for axe-core
    if (!config.rules) {
      config.rules = {};
    }
    for (const ruleId of DISABLED_RULES) {
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
    if ((input as any).config?.rules) {
      const legacyRules = (input as any).config.rules;
      if (Array.isArray(legacyRules)) {
        for (const rule of legacyRules) {
          if (rule.id) {
            config.rules[rule.id] = {
              enabled: rule.enabled !== false,
              options: rule,
            };
          }
        }
      }
    }
  }

  return new Promise<A11yReport | AxeResults>((resolve, reject) => {
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
        resolve(resultWithLinks);
      } catch (error) {
        console.error(`[Storybook A11y] Check failed with ${engineType} engine:`, error);
        reject(error);
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
  });
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
      orientationAngle: (window.screen as any).orientation?.angle,
      orientationType: (window.screen as any).orientation?.type,
    },
    toolOptions: {},
    violations: allViolations,
    passes: report.passes.map((issue) => convertIssueToResult(issue)),
    incomplete: report.incomplete.map((issue) => convertIssueToResult(issue)),
    inapplicable: [],
  } as AxeResults;
}

function convertIssueToResult(issue: any): any {
  // If we have the original axe-core result stored, use it directly
  // This preserves all axe-specific properties like 'any', 'all', 'none'
  if (issue.engineSpecific?.axeResult) {
    return issue.engineSpecific.axeResult;
  }

  // Fallback: construct a basic result for non-axe engines (e.g., IBM Equal Access)
  // Preserve all node properties to maintain backward compatibility
  return {
    id: issue.ruleId,
    impact: issue.engineSpecific?.impact,
    tags: issue.tags,
    description: issue.description,
    help: issue.help,
    helpUrl: issue.helpUrl,
    nodes: issue.nodes.map((node: any) => ({
      ...node, // Preserve all existing node properties (any, all, none, etc.)
      html: node.html,
      target: node.target,
      xpath: node.xpath,
    })),
    // Preserve engineSpecific data for Equal Access and other engines
    engineSpecific: issue.engineSpecific,
  };
}

channel.on(EVENTS.MANUAL, async (storyId: string, input: A11yParameters = DEFAULT_PARAMETERS) => {
  try {
    await waitForAnimations();
    
    // Get the engine and its rule provider
    const engineType = (input.engine || 'axe-core') as A11yEngineType;
    const engine = await EngineRegistry.getOrInitialize(engineType);
    // Cast to access getRuleProvider (not in IA11yEngine interface but available on adapters)
    const provider = (engine as any).getRuleProvider?.();
    
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
    // Axe result contains class instances, which telejson deserializes in a
    // way that violates:
    //  Content Security Policy directive: "script-src 'self' 'unsafe-inline'".
    const resultJson = JSON.parse(JSON.stringify(result));
    channel.emit(EVENTS.RESULT, resultJson, storyId);
  } catch (error) {
    channel.emit(EVENTS.ERROR, error);
  }
});
