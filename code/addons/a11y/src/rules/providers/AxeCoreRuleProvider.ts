import type { A11yEngineType, A11ySeverity } from '../../engines/types';
import type { A11yRuleMetadata, IA11yRuleProvider, A11yRuleCategory } from '../types';
import { combinedRulesMap } from '../../AccessibilityRuleMaps';
import type { RuleMetadata } from 'axe-core';

export class AxeCoreRuleProvider implements IA11yRuleProvider {
  readonly engineType: A11yEngineType = 'axe-core' as A11yEngineType;
  
  private axeEngine: {
    getRules: () => RuleMetadata[];
  } | null = null;
  private rulesCache: A11yRuleMetadata[] | null = null;
  
  constructor(axeEngine?: { getRules: () => RuleMetadata[] }) {
    this.axeEngine = axeEngine || null;
  }
  
  setAxeEngine(axeEngine: { getRules: () => RuleMetadata[] }): void {
    this.axeEngine = axeEngine;
    this.rulesCache = null;
  }
  
  async getAllRules(): Promise<A11yRuleMetadata[]> {
    if (this.rulesCache !== null) {
      return this.rulesCache;
    }
    
    if (!this.axeEngine) {
      console.warn('Axe engine not available for rule provider');
      return [];
    }
    
    try {
      const axeRules = this.axeEngine.getRules();
      this.rulesCache = axeRules.map((rule: RuleMetadata) => this.convertAxeRule(rule));
      return this.rulesCache;
    } catch (error) {
      console.warn('Failed to get axe-core rules:', error);
      return [];
    }
  }
  
  async getRule(ruleId: string): Promise<A11yRuleMetadata | undefined> {
    const allRules = await this.getAllRules();
    return allRules.find(rule => rule.id === ruleId);
  }
  
  async getRulesByCategory(category: A11yRuleCategory): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    return allRules.filter(rule => rule.category === category);
  }
  
  async getRulesByTags(tags: string[]): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    return allRules.filter(rule => 
      tags.some(tag => rule.tags.includes(tag))
    );
  }
  
  async searchRules(query: string): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    const searchTerm = query.toLowerCase();
    
    return allRules.filter(rule => 
      rule.id.toLowerCase().includes(searchTerm) ||
      rule.title.toLowerCase().includes(searchTerm) ||
      rule.description.toLowerCase().includes(searchTerm) ||
      rule.help.toLowerCase().includes(searchTerm)
    );
  }
  
  private convertAxeRule(axeRule: RuleMetadata): A11yRuleMetadata {
    const mapping = combinedRulesMap[axeRule.ruleId];
    const impact = (axeRule as RuleMetadata & { impact?: string }).impact;
    
    return {
      id: axeRule.ruleId,
      engine: this.engineType,
      title: mapping?.title || axeRule.ruleId,
      description: mapping?.axeSummary || axeRule.description || axeRule.help,
      help: mapping?.friendlySummary || axeRule.help || axeRule.description,
      helpUrl: axeRule.helpUrl,
      tags: axeRule.tags || [],
      category: this.mapAxeTagsToCategory(axeRule.tags || []),
      defaultSeverity: this.mapAxeImpactToSeverity(impact),
      wcagCriteria: this.extractWcagCriteria(axeRule.tags || []),
      enabledByDefault: true,
      engineSpecific: {
        impact,
        axeRule: axeRule
      }
    };
  }
  
  private mapAxeTagsToCategory(tags: string[]): A11yRuleCategory {
    if (tags.includes('color')) return 'color-contrast' as A11yRuleCategory;
    if (tags.includes('keyboard')) return 'keyboard-navigation' as A11yRuleCategory;
    if (tags.includes('aria')) return 'aria' as A11yRuleCategory;
    if (tags.includes('forms')) return 'forms' as A11yRuleCategory;
    if (tags.includes('images')) return 'images-media' as A11yRuleCategory;
    if (tags.includes('structure')) return 'structure' as A11yRuleCategory;
    if (tags.includes('links')) return 'links-navigation' as A11yRuleCategory;
    if (tags.includes('tables')) return 'tables' as A11yRuleCategory;
    if (tags.includes('language')) return 'language' as A11yRuleCategory;
    if (tags.includes('experimental')) return 'experimental' as A11yRuleCategory;
    
    return 'best-practices' as A11yRuleCategory;
  }
  
  private mapAxeImpactToSeverity(impact?: string): A11ySeverity {
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
  
  private extractWcagCriteria(tags: string[]): string[] {
    return tags.filter(tag => 
      tag.startsWith('wcag') || 
      tag.includes('wcag') ||
      tag.match(/\d+\.\d+\.\d+/)
    );
  }
}

