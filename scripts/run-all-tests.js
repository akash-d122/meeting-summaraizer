#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * 
 * Executes all test suites in the correct order and provides
 * a comprehensive report of system health and functionality
 */

const { spawn } = require('child_process');
const path = require('path');

// Test suites in execution order
const testSuites = [
  {
    name: 'Groq Configuration',
    script: 'test-groq-config.js',
    description: 'Tests Groq API configuration and connectivity',
    critical: true
  },
  {
    name: 'Prompt Engineering',
    script: 'test-prompt-engine.js',
    description: 'Tests prompt generation and optimization logic',
    critical: true
  },
  {
    name: 'Response Processing',
    script: 'test-response-processor.js',
    description: 'Tests AI response validation, analysis, and formatting',
    critical: true
  },
  {
    name: 'Fallback System',
    script: 'test-fallback-system.js',
    description: 'Tests intelligent model selection and retry logic',
    critical: true
  },
  {
    name: 'Summary Service',
    script: 'test-summary-service.js',
    description: 'Tests core summary generation service',
    critical: true
  },
  {
    name: 'Error Handling',
    script: 'test-error-handling.js',
    description: 'Tests comprehensive error management and user feedback',
    critical: true
  },
  {
    name: 'Integration Tests',
    script: 'test-integration.js',
    description: 'Tests complete end-to-end workflow',
    critical: true
  }
];

class TestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.totalTests = testSuites.length;
    this.passedTests = 0;
    this.failedTests = 0;
    this.skippedTests = 0;
  }

  /**
   * Run a single test suite
   */
  async runTest(testSuite) {
    return new Promise((resolve) => {
      console.log(`\n🧪 Running ${testSuite.name}...`);
      console.log(`   📝 ${testSuite.description}`);
      
      const scriptPath = path.join(__dirname, testSuite.script);
      const startTime = Date.now();
      
      const testProcess = spawn('node', [scriptPath], {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: process.cwd()
      });
      
      let stdout = '';
      let stderr = '';
      
      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      testProcess.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const result = {
          name: testSuite.name,
          script: testSuite.script,
          description: testSuite.description,
          critical: testSuite.critical,
          passed: code === 0,
          duration: duration,
          stdout: stdout,
          stderr: stderr,
          exitCode: code
        };
        
        if (code === 0) {
          console.log(`   ✅ ${testSuite.name} passed (${duration}ms)`);
          this.passedTests++;
        } else {
          console.log(`   ❌ ${testSuite.name} failed (${duration}ms)`);
          if (stderr) {
            console.log(`   🚨 Error output: ${stderr.substring(0, 200)}...`);
          }
          this.failedTests++;
        }
        
        this.results.push(result);
        resolve(result);
      });
      
      testProcess.on('error', (error) => {
        console.log(`   💥 ${testSuite.name} crashed: ${error.message}`);
        
        const result = {
          name: testSuite.name,
          script: testSuite.script,
          description: testSuite.description,
          critical: testSuite.critical,
          passed: false,
          duration: Date.now() - startTime,
          stdout: '',
          stderr: error.message,
          exitCode: -1,
          crashed: true
        };
        
        this.results.push(result);
        this.failedTests++;
        resolve(result);
      });
    });
  }

  /**
   * Run all test suites
   */
  async runAllTests() {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log('=====================================\n');
    
    console.log(`📊 Test Plan:`);
    testSuites.forEach((suite, index) => {
      console.log(`   ${index + 1}. ${suite.name} ${suite.critical ? '(Critical)' : ''}`);
    });
    
    console.log(`\n⏱️ Starting execution at ${new Date().toLocaleTimeString()}`);
    
    // Run tests sequentially
    for (const testSuite of testSuites) {
      await this.runTest(testSuite);
      
      // Add small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Generate comprehensive report
    this.generateReport();
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    
    console.log('\n\n📋 COMPREHENSIVE TEST REPORT');
    console.log('============================\n');
    
    // Overall statistics
    console.log('📊 Overall Statistics:');
    console.log(`   Total tests: ${this.totalTests}`);
    console.log(`   Passed: ${this.passedTests} ✅`);
    console.log(`   Failed: ${this.failedTests} ❌`);
    console.log(`   Success rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    console.log(`   Total duration: ${(totalDuration / 1000).toFixed(1)} seconds`);
    console.log('');
    
    // Detailed results
    console.log('📝 Detailed Results:');
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const critical = result.critical ? ' (CRITICAL)' : '';
      const duration = `${result.duration}ms`;
      
      console.log(`   ${index + 1}. ${result.name}: ${status}${critical} - ${duration}`);
      
      if (!result.passed && result.stderr) {
        const errorPreview = result.stderr.split('\n')[0].substring(0, 80);
        console.log(`      Error: ${errorPreview}...`);
      }
    });
    console.log('');
    
    // Critical failures
    const criticalFailures = this.results.filter(r => !r.passed && r.critical);
    if (criticalFailures.length > 0) {
      console.log('🚨 Critical Failures:');
      criticalFailures.forEach(failure => {
        console.log(`   • ${failure.name}: ${failure.stderr.split('\n')[0]}`);
      });
      console.log('');
    }
    
    // Performance analysis
    console.log('⚡ Performance Analysis:');
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    const slowestTest = this.results.reduce((prev, current) => 
      (prev.duration > current.duration) ? prev : current
    );
    const fastestTest = this.results.reduce((prev, current) => 
      (prev.duration < current.duration) ? prev : current
    );
    
    console.log(`   Average test duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`   Slowest test: ${slowestTest.name} (${slowestTest.duration}ms)`);
    console.log(`   Fastest test: ${fastestTest.name} (${fastestTest.duration}ms)`);
    console.log('');
    
    // System health assessment
    console.log('🏥 System Health Assessment:');
    
    const healthScore = this.calculateHealthScore();
    const healthLevel = this.getHealthLevel(healthScore);
    
    console.log(`   Health Score: ${healthScore}/100`);
    console.log(`   Health Level: ${healthLevel.emoji} ${healthLevel.label}`);
    console.log(`   Assessment: ${healthLevel.description}`);
    console.log('');
    
    // Recommendations
    console.log('💡 Recommendations:');
    const recommendations = this.generateRecommendations();
    recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });
    console.log('');
    
    // Final verdict
    console.log('🎯 Final Verdict:');
    if (this.passedTests === this.totalTests) {
      console.log('   🎉 ALL TESTS PASSED! System is ready for production.');
    } else if (criticalFailures.length === 0) {
      console.log('   ⚠️ Some tests failed, but no critical failures. System is functional.');
    } else {
      console.log('   🚨 CRITICAL FAILURES DETECTED! System requires attention before production.');
    }
    
    console.log(`\n⏱️ Test execution completed at ${new Date().toLocaleTimeString()}`);
    console.log('=====================================');
    
    // Exit with appropriate code
    process.exit(this.failedTests > 0 ? 1 : 0);
  }

  /**
   * Calculate overall system health score
   */
  calculateHealthScore() {
    let score = 100;
    
    // Deduct points for failures
    this.results.forEach(result => {
      if (!result.passed) {
        if (result.critical) {
          score -= 20; // Critical failures are heavily penalized
        } else {
          score -= 10; // Non-critical failures
        }
      }
    });
    
    // Deduct points for slow performance
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    if (avgDuration > 10000) { // More than 10 seconds average
      score -= 5;
    }
    
    // Deduct points for crashes
    const crashes = this.results.filter(r => r.crashed).length;
    score -= crashes * 15;
    
    return Math.max(0, score);
  }

  /**
   * Get health level description
   */
  getHealthLevel(score) {
    if (score >= 95) {
      return {
        emoji: '🟢',
        label: 'EXCELLENT',
        description: 'System is in excellent condition and ready for production'
      };
    } else if (score >= 80) {
      return {
        emoji: '🟡',
        label: 'GOOD',
        description: 'System is in good condition with minor issues'
      };
    } else if (score >= 60) {
      return {
        emoji: '🟠',
        label: 'FAIR',
        description: 'System has some issues that should be addressed'
      };
    } else {
      return {
        emoji: '🔴',
        label: 'POOR',
        description: 'System has significant issues requiring immediate attention'
      };
    }
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check for critical failures
    const criticalFailures = this.results.filter(r => !r.passed && r.critical);
    if (criticalFailures.length > 0) {
      recommendations.push('Address critical test failures before production deployment');
    }
    
    // Check for Groq API configuration
    const groqTest = this.results.find(r => r.name === 'Groq Configuration');
    if (groqTest && !groqTest.passed) {
      recommendations.push('Configure Groq API key for full functionality');
    }
    
    // Check for slow tests
    const slowTests = this.results.filter(r => r.duration > 15000);
    if (slowTests.length > 0) {
      recommendations.push('Investigate performance issues in slow-running tests');
    }
    
    // Check for crashes
    const crashes = this.results.filter(r => r.crashed);
    if (crashes.length > 0) {
      recommendations.push('Fix test crashes to ensure system stability');
    }
    
    // Success recommendations
    if (this.passedTests === this.totalTests) {
      recommendations.push('System is ready for production deployment');
      recommendations.push('Consider setting up continuous integration for ongoing testing');
      recommendations.push('Monitor system performance and error rates in production');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring system health and performance');
    }
    
    return recommendations;
  }
}

// Run all tests if executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { TestRunner };
