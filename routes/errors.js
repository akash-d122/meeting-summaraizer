/**
 * Error Handling and Reporting API Routes
 * 
 * Endpoints for error reporting, monitoring, and user feedback
 */

const express = require('express');
const router = express.Router();
const { errorHandler, userFeedbackSystem, ErrorTypes } = require('../services/errorHandler');
const { validateSession } = require('../middleware/sessionMiddleware');

/**
 * Report an error for debugging and improvement
 * POST /api/errors/report
 */
router.post('/report', validateSession, async (req, res) => {
  try {
    const {
      errorId,
      userFeedback,
      reproductionSteps,
      expectedBehavior,
      actualBehavior,
      browserInfo,
      additionalContext
    } = req.body;

    // Create error report
    const errorReport = {
      errorId: errorId,
      reportedBy: req.session.id,
      reportedAt: new Date().toISOString(),
      userFeedback: userFeedback,
      reproductionSteps: reproductionSteps,
      expectedBehavior: expectedBehavior,
      actualBehavior: actualBehavior,
      browserInfo: browserInfo,
      additionalContext: additionalContext,
      sessionInfo: {
        sessionId: req.session.id,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        referer: req.headers.referer
      }
    };

    // Log the error report
    await errorHandler.logError({
      id: `report_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'USER_REPORT',
      severity: 'medium',
      message: 'User error report',
      component: 'ErrorReporting',
      operation: 'reportError',
      userId: req.session.id,
      context: errorReport
    });

    res.json({
      success: true,
      message: 'Error report submitted successfully',
      reportId: errorReport.errorId,
      thankYou: 'Thank you for helping us improve the service!'
    });

  } catch (error) {
    console.error('Error report submission failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit error report',
      message: 'Please try again or contact support directly'
    });
  }
});

/**
 * Get error details by ID
 * GET /api/errors/:errorId
 */
router.get('/:errorId', validateSession, async (req, res) => {
  try {
    const { errorId } = req.params;
    
    // Find error in logs
    const error = errorHandler.errorLog.find(e => e.id === errorId);
    
    if (!error) {
      return res.status(404).json({
        success: false,
        error: 'Error not found',
        message: 'The requested error details could not be found'
      });
    }

    // Only return error details for the same session (privacy)
    if (error.sessionId !== req.session.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only view your own error details'
      });
    }

    // Generate user-friendly error information
    const userError = userFeedbackSystem.generateErrorResponse(
      { message: error.message, type: error.type, status: error.status },
      error.context
    );

    res.json({
      success: true,
      error: {
        id: error.id,
        timestamp: error.timestamp,
        type: error.type,
        severity: error.severity,
        component: error.component,
        operation: error.operation,
        userMessage: userError.error.userMessage,
        actions: userError.error.actions,
        support: userError.error.support,
        retryable: error.retryable
      }
    });

  } catch (error) {
    console.error('Get error details failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error details'
    });
  }
});

/**
 * Get error statistics for monitoring
 * GET /api/errors/stats
 */
router.get('/stats/overview', validateSession, async (req, res) => {
  try {
    const { timeWindow = '24h' } = req.query;
    
    // Get error statistics
    const stats = errorHandler.getErrorStats(timeWindow);
    
    // Filter to only show session-specific stats for privacy
    const sessionErrors = errorHandler.errorLog.filter(e => e.sessionId === req.session.id);
    const sessionStats = {
      total: sessionErrors.length,
      byType: {},
      bySeverity: {},
      recent: sessionErrors.slice(-5).map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        type: e.type,
        severity: e.severity,
        component: e.component,
        retryable: e.retryable
      }))
    };

    // Group session errors
    sessionErrors.forEach(error => {
      sessionStats.byType[error.type] = (sessionStats.byType[error.type] || 0) + 1;
      sessionStats.bySeverity[error.severity] = (sessionStats.bySeverity[error.severity] || 0) + 1;
    });

    res.json({
      success: true,
      timeWindow: timeWindow,
      systemStats: {
        total: stats.total,
        topErrors: stats.topErrors,
        healthScore: Math.max(0, 100 - (stats.total * 2)) // Simple health score
      },
      yourStats: sessionStats
    });

  } catch (error) {
    console.error('Get error stats failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error statistics'
    });
  }
});

/**
 * Test error handling (development only)
 * POST /api/errors/test
 */
router.post('/test', validateSession, async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      error: 'Test endpoints only available in development mode'
    });
  }

  try {
    const { errorType = 'API_ERROR', message = 'Test error' } = req.body;
    
    // Create test error
    const testError = new Error(message);
    testError.type = ErrorTypes[errorType] || ErrorTypes.SYSTEM_ERROR;
    testError.status = 500;

    // Handle the test error
    const errorResult = await errorHandler.handleError(testError, {
      component: 'ErrorTesting',
      operation: 'testError',
      sessionId: req.session.id,
      userId: 'test-user'
    });

    // Generate user feedback
    const userResponse = userFeedbackSystem.generateErrorResponse(testError, {
      component: 'ErrorTesting',
      operation: 'testError'
    });

    res.json({
      success: true,
      message: 'Test error generated successfully',
      errorResult: errorResult,
      userResponse: userResponse
    });

  } catch (error) {
    console.error('Test error generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate test error'
    });
  }
});

/**
 * Get system health status
 * GET /api/errors/health
 */
router.get('/health/status', async (req, res) => {
  try {
    const stats = errorHandler.getErrorStats('1h');
    const criticalErrors = errorHandler.errorLog.filter(e => 
      e.severity === 'critical' && 
      Date.now() - new Date(e.timestamp).getTime() < 3600000 // Last hour
    );

    const healthStatus = {
      status: criticalErrors.length === 0 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      metrics: {
        errorsLastHour: stats.total,
        criticalErrors: criticalErrors.length,
        errorRate: stats.total > 0 ? (stats.total / 60).toFixed(2) : '0.00', // errors per minute
        topErrorTypes: stats.topErrors.slice(0, 3)
      },
      services: {
        errorHandling: 'operational',
        logging: 'operational',
        userFeedback: 'operational'
      }
    };

    // Determine overall health
    if (criticalErrors.length > 0) {
      healthStatus.status = 'critical';
    } else if (stats.total > 50) {
      healthStatus.status = 'degraded';
    } else if (stats.total > 20) {
      healthStatus.status = 'warning';
    }

    res.json({
      success: true,
      health: healthStatus
    });

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      health: {
        status: 'critical',
        timestamp: new Date().toISOString(),
        error: 'Health check system failure'
      }
    });
  }
});

/**
 * Clear error logs (admin only, development)
 * DELETE /api/errors/logs
 */
router.delete('/logs', validateSession, async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      error: 'Log management only available in development mode'
    });
  }

  try {
    const beforeCount = errorHandler.errorLog.length;
    errorHandler.clearErrorLogs();
    const afterCount = errorHandler.errorLog.length;

    res.json({
      success: true,
      message: 'Error logs cleared successfully',
      cleared: beforeCount - afterCount,
      remaining: afterCount
    });

  } catch (error) {
    console.error('Clear error logs failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear error logs'
    });
  }
});

module.exports = router;
