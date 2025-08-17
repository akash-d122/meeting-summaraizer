/**
 * Fallback Configuration for Summary Generation
 * 
 * Defines fallback strategies, thresholds, and decision logic
 * for intelligent model switching and error recovery
 */

require('dotenv').config();

// Fallback configuration
const fallbackConfig = {
  // Cost thresholds (in USD)
  costThresholds: {
    maxPrimaryCost: parseFloat(process.env.MAX_PRIMARY_COST) || 0.05,     // $0.05 per summary
    maxFallbackCost: parseFloat(process.env.MAX_FALLBACK_COST) || 0.02,   // $0.02 per summary
    costSavingsThreshold: parseFloat(process.env.COST_SAVINGS_THRESHOLD) || 0.70 // 70% cost savings triggers fallback
  },

  // Latency thresholds (in milliseconds)
  latencyThresholds: {
    maxPrimaryLatency: parseInt(process.env.MAX_PRIMARY_LATENCY) || 30000,   // 30 seconds
    maxFallbackLatency: parseInt(process.env.MAX_FALLBACK_LATENCY) || 15000, // 15 seconds
    fastResponseThreshold: parseInt(process.env.FAST_RESPONSE_THRESHOLD) || 5000 // 5 seconds
  },

  // Token thresholds
  tokenThresholds: {
    largeSummaryTokens: parseInt(process.env.LARGE_SUMMARY_TOKENS) || 20000,  // Use fallback for large inputs
    complexSummaryTokens: parseInt(process.env.COMPLEX_SUMMARY_TOKENS) || 50000 // Always use primary for complex
  },

  // Retry configuration
  retryConfig: {
    maxRetries: parseInt(process.env.MAX_FALLBACK_RETRIES) || 3,
    retryDelay: parseInt(process.env.RETRY_DELAY) || 2000,        // 2 seconds
    backoffMultiplier: parseFloat(process.env.BACKOFF_MULTIPLIER) || 1.5,
    retryableErrors: [
      'RATE_LIMIT_EXCEEDED',
      'SERVICE_UNAVAILABLE', 
      'TIMEOUT',
      'NETWORK_ERROR',
      'TEMPORARY_FAILURE'
    ]
  },

  // Fallback triggers
  triggers: {
    // When to automatically use fallback model
    autoFallbackConditions: {
      enableCostOptimization: process.env.ENABLE_COST_OPTIMIZATION !== 'false',
      enableLatencyOptimization: process.env.ENABLE_LATENCY_OPTIMIZATION !== 'false',
      enableLoadBalancing: process.env.ENABLE_LOAD_BALANCING !== 'false'
    },

    // Quality vs speed preferences
    qualityPreference: process.env.QUALITY_PREFERENCE || 'balanced', // 'high', 'balanced', 'fast'
    
    // Summary style preferences for fallback
    fallbackPreferredStyles: ['executive', 'action-items'], // Simpler styles work well with fallback
    primaryRequiredStyles: ['technical', 'detailed']        // Complex styles need primary model
  },

  // Model selection strategies
  strategies: {
    // Default strategy selection
    defaultStrategy: process.env.FALLBACK_STRATEGY || 'smart', // 'smart', 'cost', 'speed', 'quality'
    
    // Strategy definitions
    smart: {
      description: 'Intelligent selection based on content and requirements',
      usePrimaryFor: ['technical', 'detailed', 'complex_content'],
      useFallbackFor: ['executive', 'action-items', 'simple_content'],
      considerCost: true,
      considerLatency: true,
      considerQuality: true
    },
    
    cost: {
      description: 'Prioritize cost savings',
      usePrimaryFor: ['complex_content'],
      useFallbackFor: ['executive', 'action-items', 'technical', 'detailed'],
      considerCost: true,
      considerLatency: false,
      considerQuality: false
    },
    
    speed: {
      description: 'Prioritize response time',
      usePrimaryFor: [],
      useFallbackFor: ['executive', 'action-items', 'technical', 'detailed'],
      considerCost: false,
      considerLatency: true,
      considerQuality: false
    },
    
    quality: {
      description: 'Prioritize output quality',
      usePrimaryFor: ['executive', 'action-items', 'technical', 'detailed'],
      useFallbackFor: [],
      considerCost: false,
      considerLatency: false,
      considerQuality: true
    }
  }
};

/**
 * Fallback Decision Engine
 */
class FallbackDecisionEngine {
  constructor(config = fallbackConfig) {
    this.config = config;
    this.strategy = this.config.strategies[this.config.strategies.defaultStrategy];
  }

  /**
   * Decide which model to use based on context
   */
  selectModel(context) {
    const {
      summaryStyle,
      estimatedTokens,
      estimatedCost,
      userPreference,
      sessionHistory,
      urgency = 'normal'
    } = context;

    const decision = {
      model: 'primary',
      reason: 'default',
      confidence: 0.5,
      fallbackReasons: []
    };

    // Check if fallback is forced
    if (userPreference === 'fallback') {
      decision.model = 'fallback';
      decision.reason = 'user_preference';
      decision.confidence = 1.0;
      return decision;
    }

    // Check complexity requirements
    if (estimatedTokens > this.config.tokenThresholds.complexSummaryTokens) {
      decision.model = 'primary';
      decision.reason = 'complex_content';
      decision.confidence = 0.9;
      return decision;
    }

    // Apply strategy-based logic
    const strategyDecision = this.applyStrategy(context);
    if (strategyDecision.override) {
      return strategyDecision;
    }

    // Cost-based decision
    if (this.strategy.considerCost && estimatedCost > this.config.costThresholds.maxPrimaryCost) {
      decision.fallbackReasons.push('cost_threshold_exceeded');
      decision.model = 'fallback';
      decision.reason = 'cost_optimization';
      decision.confidence = 0.8;
    }

    // Style-based decision
    if (this.config.triggers.fallbackPreferredStyles.includes(summaryStyle)) {
      decision.fallbackReasons.push('style_suitable_for_fallback');
      if (decision.model === 'primary') {
        decision.model = 'fallback';
        decision.reason = 'style_optimization';
        decision.confidence = 0.7;
      }
    }

    // Urgency-based decision
    if (urgency === 'high' && this.strategy.considerLatency) {
      decision.fallbackReasons.push('high_urgency');
      decision.model = 'fallback';
      decision.reason = 'latency_optimization';
      decision.confidence = 0.8;
    }

    // Session history influence
    if (sessionHistory && this.shouldConsiderHistory(sessionHistory)) {
      const historyDecision = this.analyzeSessionHistory(sessionHistory);
      if (historyDecision.suggestFallback) {
        decision.fallbackReasons.push('session_history');
        decision.model = 'fallback';
        decision.reason = 'historical_performance';
        decision.confidence = Math.min(decision.confidence + 0.2, 1.0);
      }
    }

    return decision;
  }

  /**
   * Apply strategy-specific logic
   */
  applyStrategy(context) {
    const { summaryStyle, estimatedTokens } = context;
    
    // Check if style requires primary model
    if (this.strategy.usePrimaryFor.includes(summaryStyle)) {
      return {
        model: 'primary',
        reason: 'strategy_primary_required',
        confidence: 0.9,
        override: true
      };
    }

    // Check if style is suitable for fallback
    if (this.strategy.useFallbackFor.includes(summaryStyle)) {
      return {
        model: 'fallback',
        reason: 'strategy_fallback_suitable',
        confidence: 0.8,
        override: true
      };
    }

    return { override: false };
  }

  /**
   * Analyze session history for patterns
   */
  analyzeSessionHistory(history) {
    const recentSummaries = history.slice(-5); // Last 5 summaries
    
    let fallbackSuccessRate = 0;
    let primaryFailureRate = 0;
    let avgFallbackTime = 0;
    let avgPrimaryTime = 0;

    recentSummaries.forEach(summary => {
      if (summary.model.includes('8b')) { // Fallback model
        if (summary.status === 'completed') fallbackSuccessRate++;
        avgFallbackTime += summary.processingTime || 0;
      } else { // Primary model
        if (summary.status === 'error') primaryFailureRate++;
        avgPrimaryTime += summary.processingTime || 0;
      }
    });

    const totalSummaries = recentSummaries.length;
    fallbackSuccessRate = fallbackSuccessRate / totalSummaries;
    primaryFailureRate = primaryFailureRate / totalSummaries;
    avgFallbackTime = avgFallbackTime / totalSummaries;
    avgPrimaryTime = avgPrimaryTime / totalSummaries;

    return {
      suggestFallback: (
        fallbackSuccessRate > 0.8 && 
        (primaryFailureRate > 0.3 || avgPrimaryTime > this.config.latencyThresholds.maxPrimaryLatency)
      ),
      metrics: {
        fallbackSuccessRate,
        primaryFailureRate,
        avgFallbackTime,
        avgPrimaryTime
      }
    };
  }

  /**
   * Check if we should consider session history
   */
  shouldConsiderHistory(history) {
    return history && history.length >= 3; // Need at least 3 data points
  }

  /**
   * Determine if error is retryable
   */
  isRetryableError(error) {
    const errorType = this.categorizeError(error);
    return this.config.retryConfig.retryableErrors.includes(errorType);
  }

  /**
   * Categorize error for retry logic
   */
  categorizeError(error) {
    if (error.status === 429) return 'RATE_LIMIT_EXCEEDED';
    if (error.status >= 500) return 'SERVICE_UNAVAILABLE';
    if (error.message?.includes('timeout')) return 'TIMEOUT';
    if (error.message?.includes('network')) return 'NETWORK_ERROR';
    if (error.message?.includes('temporary')) return 'TEMPORARY_FAILURE';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attemptNumber) {
    const baseDelay = this.config.retryConfig.retryDelay;
    const multiplier = this.config.retryConfig.backoffMultiplier;
    return Math.min(baseDelay * Math.pow(multiplier, attemptNumber - 1), 30000); // Max 30 seconds
  }

  /**
   * Get fallback configuration summary
   */
  getConfigSummary() {
    return {
      strategy: this.config.strategies.defaultStrategy,
      costThresholds: this.config.costThresholds,
      latencyThresholds: this.config.latencyThresholds,
      retryConfig: {
        maxRetries: this.config.retryConfig.maxRetries,
        retryDelay: this.config.retryConfig.retryDelay
      },
      triggers: this.config.triggers.autoFallbackConditions
    };
  }
}

module.exports = {
  fallbackConfig,
  FallbackDecisionEngine
};
