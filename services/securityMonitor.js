/**
 * Security Monitoring Service
 * 
 * Centralized security event monitoring and alerting:
 * - Security event logging
 * - Threat detection and alerting
 * - Security metrics and reporting
 * - Incident response coordination
 */

const fs = require('fs').promises;
const path = require('path');

class SecurityMonitor {
  constructor() {
    this.logPath = path.join(process.cwd(), 'logs', 'security.log');
    this.alertThresholds = {
      rateLimitViolations: 10, // per hour
      maliciousFileAttempts: 5, // per hour
      sqlInjectionAttempts: 3, // per hour
      xssAttempts: 5, // per hour
    };
    this.eventCounts = new Map();
    this.initializeLogging();
  }

  /**
   * Initialize security logging
   */
  async initializeLogging() {
    try {
      const logsDir = path.dirname(this.logPath);
      await fs.mkdir(logsDir, { recursive: true });
      console.log('✅ Security monitoring initialized');
    } catch (error) {
      console.error('❌ Failed to initialize security monitoring:', error);
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventType, details) {
    const event = {
      timestamp: new Date().toISOString(),
      type: eventType,
      severity: this.getSeverity(eventType),
      details: details,
      source: 'meeting-summarizer'
    };

    try {
      // Write to security log
      await fs.appendFile(this.logPath, JSON.stringify(event) + '\n');
      
      // Update event counts for alerting
      this.updateEventCounts(eventType);
      
      // Check for alert conditions
      await this.checkAlertConditions(eventType, event);
      
      // Console logging based on severity
      if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
        console.error('🚨 SECURITY ALERT:', event);
      } else if (event.severity === 'MEDIUM') {
        console.warn('⚠️ Security Warning:', event);
      } else {
        console.log('🔒 Security Event:', event);
      }

    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Get event severity level
   */
  getSeverity(eventType) {
    const severityMap = {
      'rate_limit_exceeded': 'MEDIUM',
      'malicious_file_detected': 'HIGH',
      'sql_injection_attempt': 'HIGH',
      'xss_attempt': 'HIGH',
      'file_quarantined': 'HIGH',
      'suspicious_request': 'MEDIUM',
      'authentication_failure': 'MEDIUM',
      'unauthorized_access': 'HIGH',
      'security_check_failed': 'HIGH',
      'input_validation_failed': 'LOW',
      'file_upload_rejected': 'MEDIUM'
    };
    
    return severityMap[eventType] || 'LOW';
  }

  /**
   * Update event counts for alerting
   */
  updateEventCounts(eventType) {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    if (!this.eventCounts.has(eventType)) {
      this.eventCounts.set(eventType, []);
    }
    
    const events = this.eventCounts.get(eventType);
    
    // Add current event
    events.push(now);
    
    // Remove events older than 1 hour
    const recentEvents = events.filter(timestamp => timestamp > hourAgo);
    this.eventCounts.set(eventType, recentEvents);
  }

  /**
   * Check for alert conditions
   */
  async checkAlertConditions(eventType, event) {
    const recentEvents = this.eventCounts.get(eventType) || [];
    const threshold = this.alertThresholds[eventType];
    
    if (threshold && recentEvents.length >= threshold) {
      await this.triggerAlert(eventType, recentEvents.length, event);
    }
  }

  /**
   * Trigger security alert
   */
  async triggerAlert(eventType, count, lastEvent) {
    const alert = {
      timestamp: new Date().toISOString(),
      type: 'SECURITY_ALERT',
      severity: 'CRITICAL',
      eventType: eventType,
      count: count,
      threshold: this.alertThresholds[eventType],
      lastEvent: lastEvent,
      message: `Security threshold exceeded: ${count} ${eventType} events in the last hour`
    };

    try {
      // Log the alert
      await fs.appendFile(this.logPath, JSON.stringify(alert) + '\n');
      
      // Console alert
      console.error('🚨🚨🚨 CRITICAL SECURITY ALERT 🚨🚨🚨');
      console.error(alert);
      
      // In production, this would trigger:
      // - Email notifications to security team
      // - Slack/Teams alerts
      // - SIEM integration
      // - Automated response actions
      
    } catch (error) {
      console.error('Failed to trigger security alert:', error);
    }
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(timeframe = '24h') {
    try {
      const logContent = await fs.readFile(this.logPath, 'utf8');
      const events = logContent.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      const now = Date.now();
      const timeframeMs = timeframe === '24h' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
      const cutoff = now - timeframeMs;

      const recentEvents = events.filter(event => 
        new Date(event.timestamp).getTime() > cutoff
      );

      const metrics = {
        totalEvents: recentEvents.length,
        eventsByType: {},
        eventsBySeverity: {},
        timeframe: timeframe,
        generatedAt: new Date().toISOString()
      };

      // Count events by type and severity
      recentEvents.forEach(event => {
        metrics.eventsByType[event.type] = (metrics.eventsByType[event.type] || 0) + 1;
        metrics.eventsBySeverity[event.severity] = (metrics.eventsBySeverity[event.severity] || 0) + 1;
      });

      return metrics;
    } catch (error) {
      console.error('Failed to get security metrics:', error);
      return {
        error: 'Failed to retrieve security metrics',
        generatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Security event types for easy reference
   */
  static get EVENT_TYPES() {
    return {
      RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
      MALICIOUS_FILE_DETECTED: 'malicious_file_detected',
      SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
      XSS_ATTEMPT: 'xss_attempt',
      FILE_QUARANTINED: 'file_quarantined',
      SUSPICIOUS_REQUEST: 'suspicious_request',
      AUTHENTICATION_FAILURE: 'authentication_failure',
      UNAUTHORIZED_ACCESS: 'unauthorized_access',
      SECURITY_CHECK_FAILED: 'security_check_failed',
      INPUT_VALIDATION_FAILED: 'input_validation_failed',
      FILE_UPLOAD_REJECTED: 'file_upload_rejected'
    };
  }
}

// Export singleton instance
module.exports = new SecurityMonitor();
