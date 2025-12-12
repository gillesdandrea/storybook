import type {
  A11yConfidence,
  A11yIssue,
  A11yIssueNode,
  A11yReport,
  A11ySeverity,
} from '../engines/types';
import type {
  DisplayConfidence,
  DisplayMessage,
  DisplayNode,
  DisplaySeverity,
  EnrichedIssue,
  EnrichedReport,
} from './types';

const COLOR_RED = '#fa4d56';
const COLOR_ORANGE = '#ff832b';
const COLOR_YELLOW = '#f1c21b';
const COLOR_BLUE = '#4589ff';

/**
 * Service for enriching normalized A11yReport with display-specific metadata
 * This is the single transformation point from engine data to display data
 */
export class ReportEnrichmentService {
  /**
   * Enrich a normalized A11yReport with display metadata
   */
  static enrich(report: A11yReport): EnrichedReport {
    const enrichedViolations = (report.violations || []).map((issue) => this.enrichIssue(issue, report));

    return {
      engine: report.engine,
      violations: enrichedViolations,
      warnings: (report.warnings || []).map((issue) => this.enrichIssue(issue, report)),
      passes: (report.passes || []).map((issue) => this.enrichIssue(issue, report)),
      incomplete: (report.incomplete || []).map((issue) => this.enrichIssue(issue, report)),
      summary: report.summary,
      metadata: report.metadata,
    };
  }

  /**
   * Enrich a single issue with display metadata
   */
  private static enrichIssue(issue: A11yIssue, report: A11yReport): EnrichedIssue {
    const nodes = issue.nodes.map((node) => this.enrichNode(node));
    const displaySeverity = this.mapSeverityToDisplay(issue.severity, issue.confidence, issue.engineSpecific);

    return {
      id: issue.id,
      ruleId: issue.ruleId,
      displayTitle: this.extractTitle(issue),
      displayDescription: this.extractDescription(issue),
      helpUrl: issue.helpUrl,
      severity: displaySeverity,
      confidence: this.mapConfidenceToDisplay(issue.confidence),
      tags: issue.tags,
      nodes,
      groupedMessages: this.groupNodesByMessage(nodes),
      engine: issue.engine,
      engineVersion: report.metadata?.engineVersion,
    };
  }

  /**
   * Enrich a node with display-optimized data
   */
  private static enrichNode(node: A11yIssueNode): DisplayNode {
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
    confidence: A11yConfidence,
    engineSpecific?: Record<string, unknown>
  ): DisplaySeverity {
    // Extract engine-specific severity label if available
    const engineLabel = engineSpecific?.originalSeverity as string | undefined;

    // For IBM Equal Access, use engine-specific color mapping
    if (engineLabel) {
      // Manual confidence - yellow
      if (confidence === 'manual') {
        return {
          level: 'medium',
          label: 'Needs Review',
          engineLabel,
          badgeStatus: 'warning',
          color: COLOR_YELLOW,
          description: 'This issue requires manual verification',
        };
      }

      // // Violation or Potential Violation - red
      // if (engineLabel === 'Violation' || engineLabel === 'Potential Violation') {
      //   return {
      //     level: 'critical',
      //     label: severity === 'violation' ? 'Violation' : 'Needs Review',
      //     engineLabel,
      //     badgeStatus: 'critical',
      //     color: COLOR_RED,
      //     description: engineLabel === 'Violation'
      //       ? 'This is a definite accessibility violation'
      //       : 'This is a potential violation requiring review',
      //   };
      // }

      // Violation Violation - red
      if (engineLabel === 'Violation') {
        return {
          level: 'critical',
          label: 'Violation',
          engineLabel,
          badgeStatus: 'critical',
          color: COLOR_RED,
          description: 'This is a definite accessibility violation',
        };
      }

      // Violation or Potential Violation - red
      if (engineLabel === 'Potential Violation') {
        return {
          level: 'high',
          label: 'Needs Review',
          engineLabel,
          badgeStatus: 'critical',
          color: COLOR_ORANGE,
          description: 'This is a potential violation requiring review',
        };
      }

      // Recommendation or Potential Recommendation - blue
      if (engineLabel === 'Recommendation' || engineLabel === 'Potential Recommendation') {
        return {
          level: 'low',
          label: 'Recommendation',
          engineLabel,
          badgeStatus: 'neutral',
          color: COLOR_BLUE,
          description: engineLabel === 'Recommendation'
            ? 'This is a best practice recommendation'
            : 'This is a potential recommendation requiring review',
        };
      }

      // Needs Review (catch-all for manual) - yellow
      if (engineLabel === 'Needs Review') {
        return {
          level: 'medium',
          label: 'Needs Review',
          engineLabel,
          badgeStatus: 'warning',
          color: COLOR_YELLOW,
          description: 'This issue requires manual verification',
        };
      }
    }

    // Default mapping for axe-core and fallback
    // Handle uncertain results first (potential/manual)
    if (confidence === 'potential' || confidence === 'manual') {
      return {
        level: 'medium',
        label: 'Needs Review',
        engineLabel,
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
          engineLabel,
          badgeStatus: 'critical',
          color: COLOR_RED,
          description: 'This is a definite accessibility violation',
        };
      case 'warning':
        return {
          level: 'high',
          label: 'Warning',
          engineLabel,
          badgeStatus: 'negative',
          color: '#FC521F',
          description: 'This is likely an accessibility issue',
        };
      case 'recommendation':
        return {
          level: 'low',
          label: 'Recommendation',
          engineLabel,
          badgeStatus: 'neutral',
          color: '#1EA7FD', // Blue
          description: 'This is a best practice recommendation',
        };
      case 'information':
        return {
          level: 'info',
          label: 'Information',
          engineLabel,
          badgeStatus: 'neutral',
          color: '#999999',
          description: 'This is informational',
        };
      default:
        return {
          level: 'info',
          label: 'Information',
          engineLabel,
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
      default:
        return {
          level: 'likely' as A11yConfidence,
          label: 'Likely',
          description: 'This issue is likely present',
        };
    }
  }

  /**
   * Extract all messages from a node in display format
   * Flattens any/all/none arrays into a single message list
   */
  private static extractMessages(node: A11yIssueNode): DisplayMessage[] {
    const messages: DisplayMessage[] = [];

    // Primary messages (any checks)
    if (node.any) {
      messages.push(
        ...node.any.map((check) => ({
          id: check.id,
          text: check.message,
          category: 'primary' as const,
          data: check.data,
        }))
      );
    }

    // Secondary messages (all checks)
    if (node.all) {
      messages.push(
        ...node.all.map((check) => ({
          id: check.id,
          text: check.message,
          category: 'secondary' as const,
          data: check.data,
        }))
      );
    }

    // Detail messages (none checks)
    if (node.none) {
      messages.push(
        ...node.none.map((check) => ({
          id: check.id,
          text: check.message,
          category: 'detail' as const,
          data: check.data,
        }))
      );
    }

    return messages;
  }

  /**
   * Group nodes by their primary message content
   * This supports equal-access's multi-message display pattern
   */
  private static groupNodesByMessage(nodes: DisplayNode[]): Map<string, DisplayNode[]> {
    const groups = new Map<string, DisplayNode[]>();

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
