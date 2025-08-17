/**
 * Centralized Error Handling System
 * 
 * Provides comprehensive error management, user-friendly messaging,
 * logging, monitoring, and recovery strategies for the Meeting Summarizer
 */

const fs = require('fs').promises;
const path = require('path');

// Error categories and types
const ErrorTypes = {
  // API and Network Errors
  API_ERROR: 'API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Validation and Processing Errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  CONTENT_ERROR: 'CONTENT_ERROR',
  FORMAT_ERROR: 'FORMAT_ERROR',
  
  // Database and Storage Errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  SESSION_ERROR: 'SESSION_ERROR',
  
  // Business Logic Errors
  TRANSCRIPT_ERROR: 'TRANSCRIPT_ERROR',
  SUMMARY_ERROR: 'SUMMARY_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  QUOTA_ERROR: 'QUOTA_ERROR',
  
  // System Errors
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR'
};

// Error severity levels
const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Recovery strategies
const RecoveryStrategies = {
  RETRY: 'retry',
  FALLBACK: 'fallback',
  GRACEFUL_DEGRADATION: 'graceful_degradation',
  USER_ACTION_REQUIRED: 'user_action_required',
  SYSTEM_INTERVENTION: 'system_intervention'
};

class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.errorCounts = new Map();
    this.lastErrors = new Map();
    this.logDirectory = path.join(process.cwd(), 'logs');
    this.maxLogSize = 1000; // Maximum number of errors to keep in memory
    
    // Ensure log directory exists
    this.initializeLogging();
  }

  /**
   * Initialize logging system
   */
  async initializeLogging() {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
      console.log('✅ Error logging system initialized');
    } catch (error) {
      console.error('❌ Failed to initialize error logging:', error.message);
    }
  }

  /**
   * Handle and process errors with comprehensive context
   */
  async handleError(error, context = {}) {
    const errorInfo = this.analyzeError(error, context);
    const userMessage = this.generateUserMessage(errorInfo);
    const recoveryPlan = this.generateRecoveryPlan(errorInfo);
    
    // Log the error
    await this.logError(errorInfo);
    
    // Update error statistics
    this.updateErrorStats(errorInfo);
    
    // Check for error patterns
    const pattern = this.detectErrorPattern(errorInfo);
    
    return {
      success: false,
      error: {
        type: errorInfo.type,
        severity: errorInfo.severity,
        message: userMessage.message,
        details: userMessage.details,
        suggestions: userMessage.suggestions,
        recoveryPlan: recoveryPlan,
        pattern: pattern,
        errorId: errorInfo.id,
        timestamp: errorInfo.timestamp,
        retryable: errorInfo.retryable,
        context: this.sanitizeContext(context)
      }
    };
  }

  /**
   * Analyze error and categorize it
   */
  analyzeError(error, context) {
    const errorInfo = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      originalError: error,
      message: error.message || 'Unknown error',
      stack: error.stack,
      context: context,
      type: this.categorizeError(error),
      severity: this.determineSeverity(error, context),
      retryable: this.isRetryable(error),
      component: context.component || 'unknown',
      operation: context.operation || 'unknown',
      userId: context.userId || 'anonymous',
      sessionId: context.sessionId || null,
      transcriptId: context.transcriptId || null
    };

    return errorInfo;
  }

  /**
   * Categorize error based on type and context
   */
  categorizeError(error) {
    // HTTP/API errors
    if (error.status) {
      if (error.status === 401) return ErrorTypes.AUTHENTICATION_ERROR;
      if (error.status === 403) return ErrorTypes.PERMISSION_ERROR;
      if (error.status === 429) return ErrorTypes.RATE_LIMIT_ERROR;
      if (error.status >= 500) return ErrorTypes.SERVICE_UNAVAILABLE;
      if (error.status >= 400) return ErrorTypes.API_ERROR;
    }

    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return ErrorTypes.NETWORK_ERROR;
    }

    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return ErrorTypes.TIMEOUT_ERROR;
    }

    // Database errors
    if (error.name === 'SequelizeError' || error.message?.includes('database')) {
      return ErrorTypes.DATABASE_ERROR;
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.message?.includes('validation')) {
      return ErrorTypes.VALIDATION_ERROR;
    }

    // Processing errors
    if (error.message?.includes('processing') || error.message?.includes('format')) {
      return ErrorTypes.PROCESSING_ERROR;
    }

    // Content errors
    if (error.message?.includes('content') || error.message?.includes('empty')) {
      return ErrorTypes.CONTENT_ERROR;
    }

    // Default to system error
    return ErrorTypes.SYSTEM_ERROR;
  }

  /**
   * Determine error severity
   */
  determineSeverity(error, context) {
    const errorType = this.categorizeError(error);

    // Critical errors that break core functionality
    if ([
      ErrorTypes.DATABASE_ERROR,
      ErrorTypes.CONFIGURATION_ERROR,
      ErrorTypes.AUTHENTICATION_ERROR
    ].includes(errorType)) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors that significantly impact user experience
    if ([
      ErrorTypes.SERVICE_UNAVAILABLE,
      ErrorTypes.PROCESSING_ERROR,
      ErrorTypes.SYSTEM_ERROR
    ].includes(errorType)) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors that cause inconvenience
    if ([
      ErrorTypes.API_ERROR,
      ErrorTypes.NETWORK_ERROR,
      ErrorTypes.TIMEOUT_ERROR,
      ErrorTypes.RATE_LIMIT_ERROR
    ].includes(errorType)) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity errors that are recoverable
    return ErrorSeverity.LOW;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error) {
    const retryableTypes = [
      ErrorTypes.NETWORK_ERROR,
      ErrorTypes.TIMEOUT_ERROR,
      ErrorTypes.RATE_LIMIT_ERROR,
      ErrorTypes.SERVICE_UNAVAILABLE
    ];

    const errorType = this.categorizeError(error);
    return retryableTypes.includes(errorType);
  }

  /**
   * Generate user-friendly error messages
   */
  generateUserMessage(errorInfo) {
    const messages = {
      [ErrorTypes.API_ERROR]: {
        message: 'AI service encountered an issue',
        details: 'The AI summarization service returned an unexpected response.',
        suggestions: [
          'Try generating the summary again',
          'Check if your transcript content is valid',
          'Contact support if the issue persists'
        ]
      },
      
      [ErrorTypes.NETWORK_ERROR]: {
        message: 'Network connection issue',
        details: 'Unable to connect to the AI service due to network problems.',
        suggestions: [
          'Check your internet connection',
          'Try again in a few moments',
          'Contact your network administrator if issues persist'
        ]
      },
      
      [ErrorTypes.RATE_LIMIT_ERROR]: {
        message: 'Too many requests',
        details: 'You have exceeded the rate limit for AI summary generation.',
        suggestions: [
          'Wait a few minutes before trying again',
          'Consider upgrading your plan for higher limits',
          'Batch your requests to avoid hitting limits'
        ]
      },
      
      [ErrorTypes.AUTHENTICATION_ERROR]: {
        message: 'Authentication failed',
        details: 'The AI service authentication credentials are invalid or expired.',
        suggestions: [
          'Contact your administrator',
          'Check if your account is still active',
          'Try logging out and back in'
        ]
      },
      
      [ErrorTypes.SERVICE_UNAVAILABLE]: {
        message: 'AI service temporarily unavailable',
        details: 'The AI summarization service is currently experiencing issues.',
        suggestions: [
          'Try again in a few minutes',
          'Check the service status page',
          'Use a different summary style if available'
        ]
      },
      
      [ErrorTypes.TIMEOUT_ERROR]: {
        message: 'Request timed out',
        details: 'The AI service took too long to respond.',
        suggestions: [
          'Try with a shorter transcript',
          'Use a faster summary style (executive)',
          'Try again with better network conditions'
        ]
      },
      
      [ErrorTypes.VALIDATION_ERROR]: {
        message: 'Invalid input data',
        details: 'The provided data does not meet the required format or constraints.',
        suggestions: [
          'Check your transcript content',
          'Ensure all required fields are filled',
          'Verify the file format is supported'
        ]
      },
      
      [ErrorTypes.PROCESSING_ERROR]: {
        message: 'Processing failed',
        details: 'An error occurred while processing your summary request.',
        suggestions: [
          'Try generating the summary again',
          'Use a different summary style',
          'Check if your transcript is complete'
        ]
      },
      
      [ErrorTypes.CONTENT_ERROR]: {
        message: 'Content issue detected',
        details: 'The transcript content appears to be empty or invalid.',
        suggestions: [
          'Upload a valid transcript file',
          'Check that the file contains readable text',
          'Ensure the transcript is not corrupted'
        ]
      },
      
      [ErrorTypes.DATABASE_ERROR]: {
        message: 'Data storage issue',
        details: 'Unable to save or retrieve data from the database.',
        suggestions: [
          'Try your request again',
          'Contact support if the issue persists',
          'Check if you have sufficient storage quota'
        ]
      },
      
      [ErrorTypes.SESSION_ERROR]: {
        message: 'Session expired',
        details: 'Your session has expired or is invalid.',
        suggestions: [
          'Refresh the page and try again',
          'Log out and log back in',
          'Clear your browser cache and cookies'
        ]
      },
      
      [ErrorTypes.PERMISSION_ERROR]: {
        message: 'Access denied',
        details: 'You do not have permission to perform this action.',
        suggestions: [
          'Contact your administrator for access',
          'Check if your account has the required permissions',
          'Verify you are accessing the correct resource'
        ]
      },
      
      [ErrorTypes.QUOTA_ERROR]: {
        message: 'Usage quota exceeded',
        details: 'You have reached your usage limit for summary generation.',
        suggestions: [
          'Wait until your quota resets',
          'Consider upgrading your plan',
          'Contact support for quota increase'
        ]
      }
    };

    const defaultMessage = {
      message: 'An unexpected error occurred',
      details: 'Something went wrong while processing your request.',
      suggestions: [
        'Try your request again',
        'Contact support if the issue persists',
        'Check the system status page'
      ]
    };

    return messages[errorInfo.type] || defaultMessage;
  }

  /**
   * Generate recovery plan based on error type
   */
  generateRecoveryPlan(errorInfo) {
    const recoveryPlans = {
      [ErrorTypes.RATE_LIMIT_ERROR]: {
        strategy: RecoveryStrategies.RETRY,
        delay: 60000, // 1 minute
        maxRetries: 3,
        backoff: 'exponential'
      },
      
      [ErrorTypes.NETWORK_ERROR]: {
        strategy: RecoveryStrategies.RETRY,
        delay: 5000, // 5 seconds
        maxRetries: 3,
        backoff: 'linear'
      },
      
      [ErrorTypes.SERVICE_UNAVAILABLE]: {
        strategy: RecoveryStrategies.FALLBACK,
        fallbackOptions: ['use_fallback_model', 'retry_later'],
        delay: 30000 // 30 seconds
      },
      
      [ErrorTypes.TIMEOUT_ERROR]: {
        strategy: RecoveryStrategies.FALLBACK,
        fallbackOptions: ['use_fallback_model', 'reduce_content_size'],
        delay: 10000 // 10 seconds
      },
      
      [ErrorTypes.PROCESSING_ERROR]: {
        strategy: RecoveryStrategies.GRACEFUL_DEGRADATION,
        degradationOptions: ['simplified_processing', 'basic_summary'],
        fallbackContent: 'Unable to generate full summary. Please try again.'
      },
      
      [ErrorTypes.AUTHENTICATION_ERROR]: {
        strategy: RecoveryStrategies.SYSTEM_INTERVENTION,
        interventionRequired: 'admin_action',
        userAction: 'contact_support'
      },
      
      [ErrorTypes.VALIDATION_ERROR]: {
        strategy: RecoveryStrategies.USER_ACTION_REQUIRED,
        requiredActions: ['fix_input_data', 'check_format'],
        validationRules: errorInfo.context.validationRules || []
      }
    };

    const defaultPlan = {
      strategy: RecoveryStrategies.USER_ACTION_REQUIRED,
      requiredActions: ['retry_request', 'contact_support'],
      delay: 5000
    };

    return recoveryPlans[errorInfo.type] || defaultPlan;
  }

  /**
   * Log error to file and memory
   */
  async logError(errorInfo) {
    // Add to memory log
    this.errorLog.push(errorInfo);
    
    // Keep memory log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Write to file
    try {
      const logEntry = {
        timestamp: errorInfo.timestamp,
        id: errorInfo.id,
        type: errorInfo.type,
        severity: errorInfo.severity,
        message: errorInfo.message,
        component: errorInfo.component,
        operation: errorInfo.operation,
        userId: errorInfo.userId,
        sessionId: errorInfo.sessionId,
        transcriptId: errorInfo.transcriptId,
        retryable: errorInfo.retryable,
        context: this.sanitizeContext(errorInfo.context)
      };

      const logFile = path.join(this.logDirectory, `errors-${new Date().toISOString().split('T')[0]}.log`);
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
      
    } catch (logError) {
      console.error('Failed to write error log:', logError.message);
    }
  }

  /**
   * Update error statistics
   */
  updateErrorStats(errorInfo) {
    const key = `${errorInfo.type}:${errorInfo.component}`;
    
    if (!this.errorCounts.has(key)) {
      this.errorCounts.set(key, { count: 0, lastOccurrence: null });
    }
    
    const stats = this.errorCounts.get(key);
    stats.count++;
    stats.lastOccurrence = errorInfo.timestamp;
    
    this.lastErrors.set(errorInfo.type, errorInfo);
  }

  /**
   * Detect error patterns
   */
  detectErrorPattern(errorInfo) {
    const recentErrors = this.errorLog
      .filter(e => Date.now() - new Date(e.timestamp).getTime() < 300000) // Last 5 minutes
      .filter(e => e.type === errorInfo.type);

    if (recentErrors.length >= 5) {
      return {
        type: 'high_frequency',
        description: `${errorInfo.type} occurring frequently`,
        count: recentErrors.length,
        timeWindow: '5 minutes',
        recommendation: 'investigate_root_cause'
      };
    }

    const sameComponentErrors = this.errorLog
      .filter(e => e.component === errorInfo.component && e.type === errorInfo.type)
      .slice(-10);

    if (sameComponentErrors.length >= 3) {
      return {
        type: 'component_specific',
        description: `Recurring ${errorInfo.type} in ${errorInfo.component}`,
        count: sameComponentErrors.length,
        recommendation: 'check_component_health'
      };
    }

    return null;
  }

  /**
   * Sanitize context for logging (remove sensitive data)
   */
  sanitizeContext(context) {
    const sanitized = { ...context };
    
    // Remove sensitive fields
    delete sanitized.apiKey;
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.sessionToken;
    
    // Truncate large content
    if (sanitized.content && sanitized.content.length > 1000) {
      sanitized.content = sanitized.content.substring(0, 1000) + '... [truncated]';
    }
    
    return sanitized;
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeWindow = '24h') {
    const windowMs = this.parseTimeWindow(timeWindow);
    const cutoff = Date.now() - windowMs;
    
    const recentErrors = this.errorLog.filter(e => 
      new Date(e.timestamp).getTime() > cutoff
    );

    const stats = {
      total: recentErrors.length,
      byType: {},
      bySeverity: {},
      byComponent: {},
      patterns: [],
      topErrors: []
    };

    // Group by type
    recentErrors.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      stats.byComponent[error.component] = (stats.byComponent[error.component] || 0) + 1;
    });

    // Find top errors
    stats.topErrors = Object.entries(stats.byType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return stats;
  }

  /**
   * Parse time window string to milliseconds
   */
  parseTimeWindow(timeWindow) {
    const units = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
    
    const match = timeWindow.match(/^(\d+)([mhd])$/);
    if (!match) return 24 * 60 * 60 * 1000; // Default to 24 hours
    
    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }

  /**
   * Clear error logs (for testing or maintenance)
   */
  clearErrorLogs() {
    this.errorLog = [];
    this.errorCounts.clear();
    this.lastErrors.clear();
  }

  /**
   * Export error logs for analysis
   */
  async exportErrorLogs(format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `error-export-${timestamp}.${format}`;
    const filepath = path.join(this.logDirectory, filename);
    
    try {
      if (format === 'json') {
        await fs.writeFile(filepath, JSON.stringify(this.errorLog, null, 2));
      } else if (format === 'csv') {
        const csv = this.convertToCSV(this.errorLog);
        await fs.writeFile(filepath, csv);
      }
      
      return filepath;
    } catch (error) {
      throw new Error(`Failed to export error logs: ${error.message}`);
    }
  }

  /**
   * Convert error logs to CSV format
   */
  convertToCSV(errors) {
    if (errors.length === 0) return '';
    
    const headers = ['timestamp', 'id', 'type', 'severity', 'message', 'component', 'operation'];
    const rows = errors.map(error => 
      headers.map(header => `"${(error[header] || '').toString().replace(/"/g, '""')}"`).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }
}

// Export singleton instance
const errorHandler = new ErrorHandler();

/**
 * User Feedback System
 *
 * Provides user-friendly error communication and recovery guidance
 */
class UserFeedbackSystem {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
  }

  /**
   * Generate user-friendly error response
   */
  async generateErrorResponse(error, context = {}) {
    const errorResult = await this.errorHandler.handleError(error, context);

    return {
      success: false,
      error: {
        message: errorResult.error.message,
        type: errorResult.error.type,
        severity: errorResult.error.severity,
        userMessage: this.formatUserMessage(errorResult.error),
        actions: this.generateUserActions(errorResult.error),
        support: this.generateSupportInfo(errorResult.error),
        errorId: errorResult.error.errorId,
        timestamp: errorResult.error.timestamp
      }
    };
  }

  /**
   * Format user message with appropriate tone and detail
   */
  formatUserMessage(errorInfo) {
    const severityEmojis = {
      low: '⚠️',
      medium: '❌',
      high: '🚨',
      critical: '🔥'
    };

    return {
      title: `${severityEmojis[errorInfo.severity]} ${errorInfo.message}`,
      description: errorInfo.details,
      technical: process.env.NODE_ENV === 'development' ? errorInfo.context : undefined
    };
  }

  /**
   * Generate actionable steps for users
   */
  generateUserActions(errorInfo) {
    const actions = [];

    // Add retry action if retryable
    if (errorInfo.retryable) {
      actions.push({
        type: 'retry',
        label: 'Try Again',
        description: 'Retry your request',
        primary: true,
        delay: errorInfo.recoveryPlan.delay || 5000
      });
    }

    // Add fallback actions
    if (errorInfo.recoveryPlan.fallbackOptions) {
      errorInfo.recoveryPlan.fallbackOptions.forEach(option => {
        actions.push({
          type: 'fallback',
          label: this.getFallbackLabel(option),
          description: this.getFallbackDescription(option),
          primary: false
        });
      });
    }

    // Add user-specific actions
    errorInfo.suggestions.forEach((suggestion, index) => {
      actions.push({
        type: 'suggestion',
        label: `Step ${index + 1}`,
        description: suggestion,
        primary: false
      });
    });

    return actions;
  }

  /**
   * Generate support information
   */
  generateSupportInfo(errorInfo) {
    return {
      errorId: errorInfo.errorId,
      reportUrl: `/api/errors/report/${errorInfo.errorId}`,
      contactEmail: process.env.SUPPORT_EMAIL || 'support@meetingsummarizer.com',
      statusPage: process.env.STATUS_PAGE_URL || 'https://status.meetingsummarizer.com',
      documentation: this.getRelevantDocumentation(errorInfo.type)
    };
  }

  /**
   * Get fallback action labels
   */
  getFallbackLabel(option) {
    const labels = {
      use_fallback_model: 'Use Fast Model',
      retry_later: 'Try Later',
      reduce_content_size: 'Shorten Content',
      simplified_processing: 'Basic Summary',
      basic_summary: 'Simple Format'
    };
    return labels[option] || 'Alternative Option';
  }

  /**
   * Get fallback action descriptions
   */
  getFallbackDescription(option) {
    const descriptions = {
      use_fallback_model: 'Use a faster model that may provide a simpler summary',
      retry_later: 'Wait a few minutes and try your request again',
      reduce_content_size: 'Try with a shorter transcript or fewer custom instructions',
      simplified_processing: 'Generate a basic summary without advanced formatting',
      basic_summary: 'Create a simple text summary without structure analysis'
    };
    return descriptions[option] || 'Try an alternative approach';
  }

  /**
   * Get relevant documentation links
   */
  getRelevantDocumentation(errorType) {
    const docs = {
      [ErrorTypes.API_ERROR]: '/docs/api-troubleshooting',
      [ErrorTypes.NETWORK_ERROR]: '/docs/network-issues',
      [ErrorTypes.RATE_LIMIT_ERROR]: '/docs/rate-limits',
      [ErrorTypes.AUTHENTICATION_ERROR]: '/docs/authentication',
      [ErrorTypes.VALIDATION_ERROR]: '/docs/input-validation',
      [ErrorTypes.PROCESSING_ERROR]: '/docs/processing-issues'
    };
    return docs[errorType] || '/docs/general-troubleshooting';
  }
}

// Create feedback system instance
const userFeedbackSystem = new UserFeedbackSystem(errorHandler);

module.exports = {
  ErrorHandler,
  ErrorTypes,
  ErrorSeverity,
  RecoveryStrategies,
  UserFeedbackSystem,
  errorHandler,
  userFeedbackSystem
};
