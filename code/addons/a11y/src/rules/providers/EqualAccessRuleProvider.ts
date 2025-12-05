import type { A11yEngineType, A11ySeverity } from '../../engines/types';
import type { A11yRuleMetadata, IA11yRuleProvider, A11yRuleCategory } from '../types';

interface EqualAccessEngine {
  engine: {
    getRulesIds: () => string[];
    getRule: (ruleId: string) => unknown;
  };
  Checker: unknown;
}

export class EqualAccessRuleProvider implements IA11yRuleProvider {
  readonly engineType: A11yEngineType = 'equal-access' as A11yEngineType;
  
  private eaEngine: EqualAccessEngine | null = null;
  private rulesCache: A11yRuleMetadata[] | null = null;
  
  constructor(eaEngine?: EqualAccessEngine) {
    this.eaEngine = eaEngine || null;
  }
  
  setEqualAccessEngine(eaEngine: EqualAccessEngine): void {
    this.eaEngine = eaEngine;
    this.rulesCache = null;
  }
  
  async getAllRules(): Promise<A11yRuleMetadata[]> {
    if (this.rulesCache !== null) {
      return this.rulesCache as A11yRuleMetadata[];
    }
    
    if (!this.eaEngine) {
      console.warn('Equal Access engine not available for rule provider');
      return [];
    }
    
    try {
      if (!this.eaEngine) {
        return [];
      }
      const ruleIds = this.eaEngine.engine.getRulesIds();
      this.rulesCache = ruleIds.map((ruleId: string) => {
        const rule = this.eaEngine!.engine.getRule(ruleId);
        return this.convertEqualAccessRule(ruleId, rule);
      });
      return this.rulesCache;
    } catch (error) {
      console.warn('Failed to get Equal Access rules:', error);
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
  
  private convertEqualAccessRule(ruleId: string, eaRule: unknown): A11yRuleMetadata {
    const rule = eaRule as {
      messages?: { 'en-US'?: { group?: string; [key: string]: string | undefined } };
      category?: string;
      policy?: string;
    };
    const groupMessage = rule?.messages?.['en-US']?.group;
    const detailMessage = rule?.messages?.['en-US']?.[0];
    
    return {
      id: ruleId,
      engine: this.engineType,
      title: this.generateTitle(ruleId),
      description: groupMessage || detailMessage || ruleId,
      help: detailMessage || groupMessage || `Rule ${ruleId} guidance`,
      helpUrl: this.generateHelpUrl(ruleId),
      tags: rule?.category ? [rule.category] : [],
      category: this.mapEqualAccessCategory(rule?.category),
      defaultSeverity: this.mapEqualAccessPolicy(rule?.policy),
      wcagCriteria: this.extractWcagFromRuleId(ruleId),
      enabledByDefault: true,
      engineSpecific: {
        category: rule?.category,
        policy: rule?.policy,
        equalAccessRule: eaRule
      }
    };
  }
  
  private generateTitle(ruleId: string): string {
    return ruleId
      .replace(/^WCAG\d+_/, '')
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\s+/g, ' ');
  }
  
  private generateHelpUrl(ruleId: string): string {
    return `https://unpkg.com/accessibility-checker-engine@4.0.9/help/en-US/${ruleId}.html`;
  }
  
  private mapEqualAccessCategory(category?: string): A11yRuleCategory {
    if (!category) return 'best-practices' as A11yRuleCategory;
    
    switch (category.toLowerCase()) {
      case 'aria': return 'aria' as A11yRuleCategory;
      case 'forms': return 'forms' as A11yRuleCategory;
      case 'images': return 'images-media' as A11yRuleCategory;
      case 'structure': return 'structure' as A11yRuleCategory;
      case 'navigation': return 'links-navigation' as A11yRuleCategory;
      case 'tables': return 'tables' as A11yRuleCategory;
      case 'keyboard': return 'keyboard-navigation' as A11yRuleCategory;
      case 'color': return 'color-contrast' as A11yRuleCategory;
      default: return 'best-practices' as A11yRuleCategory;
    }
  }
  
  private mapEqualAccessPolicy(policy?: string): A11ySeverity {
    switch (policy) {
      case 'VIOLATION': return 'violation' as A11ySeverity;
      case 'RECOMMENDATION': return 'warning' as A11ySeverity;
      case 'INFORMATION': return 'information' as A11ySeverity;
      default: return 'information' as A11ySeverity;
    }
  }
  
  private extractWcagFromRuleId(ruleId: string): string[] {
    const wcagMatch = ruleId.match(/WCAG(\d+)_/);
    if (wcagMatch) {
      const version = wcagMatch[1];
      return [`WCAG ${version.charAt(0)}.${version.slice(1)}`];
    }
    return [];
  }
}

