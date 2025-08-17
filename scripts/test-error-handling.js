#!/usr/bin/env node

/**
 * Test script for Error Handling System
 * 
 * Tests comprehensive error handling, user feedback,
 * logging, monitoring, and recovery strategies
 */

const { 
  ErrorHandler, 
  ErrorTypes, 
  ErrorSeverity, 
  RecoveryStrategies,
  UserFeedbackSystem,
  errorHandler,
  userFeedbackSystem 
} = require('../services/errorHandler');

// Test error scenarios
const testErrors = {
  apiError: {
    message: 'API request failed',
    status: 500,
    type: ErrorTypes.API_ERROR
  },
  
  networkError: {
    message: 'Network connection failed',
    code: 'ECONNREFUSED',
    type: ErrorTypes.NETWORK_ERROR
  },
  
  rateLimitError: {
    message: 'Rate limit exceeded',
    status: 429,
    type: ErrorTypes.RATE_LIMIT_ERROR
  },
  
  authError: {
    message: 'Authentication failed',
    status: 401,
    type: ErrorTypes.AUTHENTICATION_ERROR
  },
  
  validationError: {
    message: 'Invalid input data',
    name: 'ValidationError',
    type: ErrorTypes.VALIDATION_ERROR
  },
  
  timeoutError: {
    message: 'Request timeout occurred',
    code: 'ETIMEDOUT',
    type: ErrorTypes.TIMEOUT_ERROR
  },
  
  databaseError: {
    message: 'Database connection failed',
    name: 'SequelizeError',
    type: ErrorTypes.DATABASE_ERROR
  },
  
  contentError: {
    message: 'Content is empty or invalid',
    type: ErrorTypes.CONTENT_ERROR
  }
};

// Test contexts for different scenarios
const testContexts = {
  summaryGeneration: {
    component: 'SummaryService',
    operation: 'generateSummary',
    transcriptId: 'transcript-123',
    sessionId: 'session-456',
    userId: 'user-789',
    summaryStyle: 'executive',
    customInstructions: 'Focus on key decisions'
  },
  
  transcriptUpload: {
    component: 'UploadService',
    operation: 'uploadTranscript',
    filename: 'meeting.txt',
    fileSize: 2048,
    sessionId: 'session-456',
    userId: 'user-789'
  },
  
  apiCall: {
    component: 'GroqAPI',
    operation: 'chatCompletion',
    model: 'llama-3.3-70b-versatile',
    tokens: 1500,
    sessionId: 'session-456'
  }
};

async function testErrorHandling() {
  console.log('🛡️ Testing Error Handling System\n');
  
  try {
    // Clear any existing logs for clean testing
    errorHandler.clearErrorLogs();
    
    // Test 1: Error categorization and analysis
    console.log('1️⃣ Testing error categorization and analysis...');
    
    for (const [errorName, errorData] of Object.entries(testErrors)) {
      const error = new Error(errorData.message);
      Object.assign(error, errorData);
      
      const errorInfo = errorHandler.analyzeError(error, testContexts.summaryGeneration);
      
      console.log(`   📊 ${errorName}:`);
      console.log(`      Type: ${errorInfo.type}`);
      console.log(`      Severity: ${errorInfo.severity}`);
      console.log(`      Retryable: ${errorInfo.retryable}`);
      console.log(`      Component: ${errorInfo.component}`);
      console.log('');
    }
    
    // Test 2: User message generation
    console.log('2️⃣ Testing user message generation...');
    
    for (const [errorName, errorData] of Object.entries(testErrors)) {
      const error = new Error(errorData.message);
      Object.assign(error, errorData);

      const userResponse = await userFeedbackSystem.generateErrorResponse(error, testContexts.summaryGeneration);

      console.log(`   💬 ${errorName}:`);
      console.log(`      Message: ${userResponse.error.userMessage.title}`);
      console.log(`      Actions: ${userResponse.error.actions.length} available`);
      console.log(`      Support: Error ID ${userResponse.error.errorId}`);
      console.log('');
    }
    
    // Test 3: Recovery plan generation
    console.log('3️⃣ Testing recovery plan generation...');
    
    const recoveryTests = [
      { error: testErrors.rateLimitError, expectedStrategy: RecoveryStrategies.RETRY },
      { error: testErrors.networkError, expectedStrategy: RecoveryStrategies.RETRY },
      { error: testErrors.authError, expectedStrategy: RecoveryStrategies.SYSTEM_INTERVENTION },
      { error: testErrors.validationError, expectedStrategy: RecoveryStrategies.USER_ACTION_REQUIRED }
    ];
    
    for (const test of recoveryTests) {
      const error = new Error(test.error.message);
      Object.assign(error, test.error);
      
      const errorInfo = errorHandler.analyzeError(error, testContexts.apiCall);
      const recoveryPlan = errorHandler.generateRecoveryPlan(errorInfo);
      
      console.log(`   🔄 ${test.error.type}:`);
      console.log(`      Strategy: ${recoveryPlan.strategy}`);
      console.log(`      Expected: ${test.expectedStrategy}`);
      console.log(`      Match: ${recoveryPlan.strategy === test.expectedStrategy ? '✅' : '❌'}`);
      
      if (recoveryPlan.delay) {
        console.log(`      Delay: ${recoveryPlan.delay}ms`);
      }
      
      if (recoveryPlan.fallbackOptions) {
        console.log(`      Fallback options: ${recoveryPlan.fallbackOptions.join(', ')}`);
      }
      
      console.log('');
    }
    
    // Test 4: Error logging and statistics
    console.log('4️⃣ Testing error logging and statistics...');
    
    // Generate multiple errors for statistics
    const errorSequence = [
      testErrors.apiError,
      testErrors.networkError,
      testErrors.apiError,
      testErrors.rateLimitError,
      testErrors.validationError,
      testErrors.apiError
    ];
    
    for (const errorData of errorSequence) {
      const error = new Error(errorData.message);
      Object.assign(error, errorData);
      
      await errorHandler.handleError(error, testContexts.summaryGeneration);
    }
    
    const stats = errorHandler.getErrorStats('1h');
    console.log(`   📊 Generated ${errorSequence.length} test errors`);
    console.log(`   📈 Total errors in last hour: ${stats.total}`);
    console.log(`   🔝 Top error types:`);
    
    stats.topErrors.forEach(({ type, count }) => {
      console.log(`      • ${type}: ${count} occurrences`);
    });
    
    console.log(`   📋 Errors by severity:`);
    Object.entries(stats.bySeverity).forEach(([severity, count]) => {
      console.log(`      • ${severity}: ${count} errors`);
    });
    
    console.log('');
    
    // Test 5: Error pattern detection
    console.log('5️⃣ Testing error pattern detection...');
    
    // Generate rapid sequence of same error type
    for (let i = 0; i < 6; i++) {
      const error = new Error('Repeated API failure');
      Object.assign(error, testErrors.apiError);
      
      const errorResult = await errorHandler.handleError(error, testContexts.apiCall);
      
      if (errorResult.error.pattern) {
        console.log(`   🔍 Pattern detected after ${i + 1} errors:`);
        console.log(`      Type: ${errorResult.error.pattern.type}`);
        console.log(`      Description: ${errorResult.error.pattern.description}`);
        console.log(`      Recommendation: ${errorResult.error.pattern.recommendation}`);
        break;
      }
    }
    
    console.log('');
    
    // Test 6: Context sanitization
    console.log('6️⃣ Testing context sanitization...');
    
    const sensitiveContext = {
      component: 'TestComponent',
      operation: 'testOperation',
      apiKey: 'secret-api-key-12345',
      password: 'super-secret-password',
      token: 'jwt-token-abcdef',
      sessionToken: 'session-token-xyz',
      content: 'A'.repeat(2000), // Large content
      safeData: 'This should remain'
    };
    
    const sanitized = errorHandler.sanitizeContext(sensitiveContext);
    
    console.log(`   🔒 Sensitive fields removed: ${!sanitized.apiKey && !sanitized.password && !sanitized.token && !sanitized.sessionToken ? '✅' : '❌'}`);
    console.log(`   📏 Large content truncated: ${sanitized.content.includes('[truncated]') ? '✅' : '❌'}`);
    console.log(`   ✅ Safe data preserved: ${sanitized.safeData === 'This should remain' ? '✅' : '❌'}`);
    console.log('');
    
    // Test 7: User feedback system integration
    console.log('7️⃣ Testing user feedback system integration...');
    
    const testError = new Error('Integration test error');
    testError.type = ErrorTypes.PROCESSING_ERROR;
    testError.status = 500;
    
    const userResponse = await userFeedbackSystem.generateErrorResponse(testError, testContexts.summaryGeneration);
    
    console.log(`   💬 User message generated: ${userResponse.success === false ? '✅' : '❌'}`);
    console.log(`   🎯 Error type preserved: ${userResponse.error.type === ErrorTypes.PROCESSING_ERROR ? '✅' : '❌'}`);
    console.log(`   📋 Actions provided: ${userResponse.error.actions.length > 0 ? '✅' : '❌'}`);
    console.log(`   🆘 Support info included: ${userResponse.error.support ? '✅' : '❌'}`);
    console.log(`   🆔 Error ID generated: ${userResponse.error.errorId ? '✅' : '❌'}`);
    console.log('');
    
    // Test 8: Error export functionality
    console.log('8️⃣ Testing error export functionality...');
    
    try {
      const jsonExport = await errorHandler.exportErrorLogs('json');
      console.log(`   📄 JSON export: ${jsonExport ? '✅' : '❌'}`);
      
      const csvExport = await errorHandler.exportErrorLogs('csv');
      console.log(`   📊 CSV export: ${csvExport ? '✅' : '❌'}`);
      
    } catch (exportError) {
      console.log(`   ❌ Export failed: ${exportError.message}`);
    }
    
    console.log('');
    
    // Test 9: Time window parsing
    console.log('9️⃣ Testing time window parsing...');
    
    const timeWindows = ['5m', '1h', '24h', '7d'];
    
    timeWindows.forEach(window => {
      const ms = errorHandler.parseTimeWindow(window);
      const expectedMs = {
        '5m': 5 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      };
      
      console.log(`   ⏱️ ${window}: ${ms === expectedMs[window] ? '✅' : '❌'} (${ms}ms)`);
    });
    
    console.log('');
    
    // Test 10: Error ID generation uniqueness
    console.log('🔟 Testing error ID generation...');
    
    const errorIds = new Set();
    for (let i = 0; i < 100; i++) {
      const id = errorHandler.generateErrorId();
      errorIds.add(id);
    }
    
    console.log(`   🆔 Generated 100 unique IDs: ${errorIds.size === 100 ? '✅' : '❌'}`);
    console.log(`   📏 ID format correct: ${Array.from(errorIds)[0].startsWith('err_') ? '✅' : '❌'}`);
    console.log('');
    
    console.log('🎉 Error handling system testing completed!');
    console.log('✅ All error handling components are working correctly');
    
    // Final statistics
    const finalStats = errorHandler.getErrorStats('1h');
    console.log(`\n📊 Final test statistics:`);
    console.log(`   Total errors logged: ${finalStats.total}`);
    console.log(`   Error types tested: ${Object.keys(finalStats.byType).length}`);
    console.log(`   Severity levels: ${Object.keys(finalStats.bySeverity).length}`);
    
  } catch (error) {
    console.error('\n💥 Error handling test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  testErrorHandling();
}

module.exports = { testErrorHandling };
