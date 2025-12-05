/**
 * Central registry for all accessibility rules across engines
 * Provides unified access to rule metadata regardless of engine
 */
import type { A11yEngineType } from '../engines/types';
import type { 
  A11yRuleMetadata, 
  IA11yRuleProvider, 
  A11yRuleCategory,
  A11yRuleSearchOptions 
} from './types';

export class A11yRuleRegistry {
  private static providers = new Map<A11yEngineType, IA11yRuleProvider>();
  private static ruleCache = new Map<string, A11yRuleMetadata>();
  private static initialized = false;
  
  /**
   * Register a rule provider for an engine
   */
  static registerProvider(provider: IA11yRuleProvider): void {
    this.providers.set(provider.engineType, provider);
    this.ruleCache.clear();
  }
  
  /**
   * Initialize registry with default providers
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }
  
  /**
   * Get all rules from all engines
   */
  static async getAllRules(): Promise<A11yRuleMetadata[]> {
    await this.initialize();
    
    const allRules: A11yRuleMetadata[] = [];
    
    for (const provider of this.providers.values()) {
      try {
        const rules = await provider.getAllRules();
        allRules.push(...rules);
      } catch (error) {
        console.warn(`Failed to get rules from ${provider.engineType}:`, error);
      }
    }
    
    return allRules;
  }
  
  /**
   * Get rule metadata by ID (searches all engines)
   */
  static async getRule(ruleId: string, engine?: A11yEngineType): Promise<A11yRuleMetadata | undefined> {
    const cacheKey = engine ? `${engine}:${ruleId}` : ruleId;
    
    if (this.ruleCache.has(cacheKey)) {
      return this.ruleCache.get(cacheKey);
    }
    
    await this.initialize();
    
    if (engine) {
      const provider = this.providers.get(engine);
      if (provider) {
        const rule = await provider.getRule(ruleId);
        if (rule) {
          this.ruleCache.set(cacheKey, rule);
          return rule;
        }
      }
      return undefined;
    }
    
    for (const provider of this.providers.values()) {
      try {
        const rule = await provider.getRule(ruleId);
        if (rule) {
          this.ruleCache.set(cacheKey, rule);
          return rule;
        }
      } catch (error) {
        console.warn(`Error searching for rule ${ruleId} in ${provider.engineType}:`, error);
      }
    }
    
    return undefined;
  }
  
  /**
   * Get rules by engine
   */
  static async getRulesByEngine(engine: A11yEngineType): Promise<A11yRuleMetadata[]> {
    await this.initialize();
    
    const provider = this.providers.get(engine);
    if (!provider) {
      return [];
    }
    
    try {
      return await provider.getAllRules();
    } catch (error) {
      console.warn(`Failed to get rules from ${engine}:`, error);
      return [];
    }
  }
  
  /**
   * Search rules with advanced filtering
   */
  static async searchRules(query: string, options: A11yRuleSearchOptions = {}): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    
    let filteredRules = allRules;
    
    if (options.engines?.length) {
      filteredRules = filteredRules.filter(rule => 
        options.engines!.includes(rule.engine)
      );
    }
    
    if (options.categories?.length) {
      filteredRules = filteredRules.filter(rule => 
        options.categories!.includes(rule.category)
      );
    }
    
    if (options.tags?.length) {
      filteredRules = filteredRules.filter(rule => 
        options.tags!.some(tag => rule.tags.includes(tag))
      );
    }
    
    if (options.severities?.length) {
      filteredRules = filteredRules.filter(rule => 
        options.severities!.includes(rule.defaultSeverity)
      );
    }
    
    if (options.wcagCriteria?.length) {
      filteredRules = filteredRules.filter(rule => 
        rule.wcagCriteria?.some(criteria => 
          options.wcagCriteria!.includes(criteria)
        )
      );
    }
    
    if (options.enabledOnly) {
      filteredRules = filteredRules.filter(rule => rule.enabledByDefault);
    }
    
    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      filteredRules = filteredRules.filter(rule => 
        rule.id.toLowerCase().includes(searchTerm) ||
        rule.title.toLowerCase().includes(searchTerm) ||
        rule.description.toLowerCase().includes(searchTerm) ||
        rule.help.toLowerCase().includes(searchTerm) ||
        rule.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }
    
    return filteredRules;
  }
  
  /**
   * Get user-friendly title for a rule
   */
  static async getRuleTitle(ruleId: string, engine?: A11yEngineType): Promise<string> {
    const rule = await this.getRule(ruleId, engine);
    return rule?.title || ruleId;
  }
  
  /**
   * Get user-friendly help text for a rule
   */
  static async getRuleHelp(ruleId: string, engine?: A11yEngineType): Promise<string> {
    const rule = await this.getRule(ruleId, engine);
    return rule?.help || rule?.description || `Rule ${ruleId}`;
  }
  
  /**
   * Get rules by category (across all engines)
   */
  static async getRulesByCategory(category: A11yRuleCategory): Promise<A11yRuleMetadata[]> {
    const allRules = await this.getAllRules();
    return allRules.filter(rule => rule.category === category);
  }
  
  /**
   * Clear all cached rules
   */
  static clearCache(): void {
    this.ruleCache.clear();
  }
  
  /**
   * Get registry statistics
   */
  static getStats(): {
    totalProviders: number;
    totalRules: number;
    rulesByEngine: Record<string, number>;
  } {
    const stats = {
      totalProviders: this.providers.size,
      totalRules: this.ruleCache.size,
      rulesByEngine: {} as Record<string, number>
    };
    
    for (const rule of this.ruleCache.values()) {
      const engine = rule.engine;
      stats.rulesByEngine[engine] = (stats.rulesByEngine[engine] || 0) + 1;
    }
    
    return stats;
  }
}

