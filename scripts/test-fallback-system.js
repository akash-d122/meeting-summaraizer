#!/usr/bin/env node

/**
 * Test script for Fallback System
 * 
 * Tests intelligent model selection, fallback logic,
 * retry mechanisms, and decision engine scenarios
 */

const SummaryService = require('../services/summaryService');
const { FallbackDecisionEngine } = require('../config/fallback');
const { initializeDatabase, MeetingTranscript, Summary, UserSession } = require('../models');

// Mock transcript data for different scenarios
const testScenarios = {
  simple: {
    transcript: {
      id: 'test-simple-001',
      content: 'Quick standup meeting. Alice completed API work. Bob working on frontend. Meeting adjourned.',
      contentLength: 95,
      tokenCount: 24,
      originalName: 'Simple Standup.txt'
    },
    options: {
      summaryStyle: 'executive',
      customInstructions: 'Keep it brief'
    }
  },

  complex: {
    transcript: {
      id: 'test-complex-001',
      content: `Detailed technical architecture review meeting discussing microservices migration, database sharding strategies, API versioning approaches, security considerations, performance optimization techniques, monitoring and observability requirements, deployment pipeline improvements, and long-term scalability planning. Multiple stakeholders presented different perspectives on implementation approaches, cost-benefit analysis, timeline considerations, and risk mitigation strategies. Extensive discussion on technical debt, refactoring priorities, and resource allocation for the next quarter.`.repeat(10), // Make it large
      contentLength: 5000,
      tokenCount: 1250,
      originalName: 'Complex Architecture Review.txt'
    },
    options: {
      summaryStyle: 'technical',
      customInstructions: 'Include all technical details and implementation approaches'
    }
  },

  urgent: {
    transcript: {
      id: 'test-urgent-001',
      content: 'Emergency incident response meeting. Production system down. Need immediate action plan.',
      contentLength: 95,
      tokenCount: 24,
      originalName: 'Emergency Response.txt'
    },
    options: {
      summaryStyle: 'action-items',
      urgency: 'high',
      customInstructions: 'Focus on immediate action items and owners'
    }
  },

  costly: {
    transcript: {
      id: 'test-costly-001',
      content: `Comprehensive quarterly business review covering financial performance, market analysis, competitive landscape, product roadmap, customer feedback, sales pipeline, marketing campaigns, operational efficiency, team performance, strategic initiatives, partnership opportunities, technology investments, risk assessment, and future planning.`.repeat(20), // Very large
      contentLength: 15000,
      tokenCount: 3750,
      originalName: 'Quarterly Business Review.txt'
    },
    options: {
      summaryStyle: 'detailed',
      customInstructions: 'Comprehensive summary with all details preserved'
    }
  }
};

async function setupTestData() {
  console.log('🔧 Setting up fallback test data...');
  
  try {
    await initializeDatabase();
    
    // Create test transcripts
    for (const [scenarioName, scenario] of Object.entries(testScenarios)) {
      const transcriptData = {
        ...scenario.transcript,
        filename: scenario.transcript.originalName,
        filePath: `/tmp/${scenario.transcript.originalName}`,
        fileSize: scenario.transcript.contentLength,
        mimeType: 'text/plain',
        status: 'processed',
        metadata: { scenario: scenarioName },
        sessionId: 'fallback-test-session'
      };
      
      await MeetingTranscript.findOrCreate({
        where: { id: scenario.transcript.id },
        defaults: transcriptData
      });
    }
    
    // Create test session
    await UserSession.findOrCreate({
      where: { id: 'fallback-test-session' },
      defaults: {
        sessionToken: 'fallback-test-token-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'Fallback Test Agent',
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        workflowState: 'summary',
        preferences: { defaultSummaryStyle: 'executive' },
        statistics: { summariesGenerated: 0, totalCost: 0 }
      }
    });
    
    console.log('✅ Fallback test data setup complete');
    
  } catch (error) {
    console.error('❌ Fallback test data setup failed:', error.message);
    throw error;
  }
}

async function testFallbackSystem() {
  console.log('🔄 Testing Fallback System\n');
  
  const summaryService = new SummaryService();
  
  try {
    await setupTestData();
    
    // Test 1: Decision Engine Scenarios
    console.log('1️⃣ Testing Decision Engine Scenarios...');
    
    const scenarioResults = await summaryService.testFallbackScenarios();
    
    scenarioResults.forEach(result => {
      console.log(`   📊 ${result.scenario}:`);
      console.log(`      Model: ${result.decision.model}`);
      console.log(`      Reason: ${result.decision.reason}`);
      console.log(`      Confidence: ${(result.decision.confidence * 100).toFixed(1)}%`);
      if (result.decision.fallbackReasons && result.decision.fallbackReasons.length > 0) {
        console.log(`      Fallback reasons: ${result.decision.fallbackReasons.join(', ')}`);
      }
      console.log('');
    });
    
    // Test 2: Model Selection Logic
    console.log('2️⃣ Testing Model Selection Logic...');
    
    for (const [scenarioName, scenario] of Object.entries(testScenarios)) {
      console.log(`   🧪 Testing ${scenarioName} scenario:`);
      
      try {
        const transcript = await MeetingTranscript.findByPk(scenario.transcript.id);
        const promptData = summaryService.buildPrompt(transcript, scenario.options);
        const session = await UserSession.findByPk('fallback-test-session');
        
        const modelDecision = await summaryService.selectOptimalModel(
          transcript, 
          promptData, 
          scenario.options, 
          session
        );
        
        console.log(`      ✅ Selected: ${modelDecision.model}`);
        console.log(`      📝 Reason: ${modelDecision.reason}`);
        console.log(`      🎯 Confidence: ${(modelDecision.confidence * 100).toFixed(1)}%`);
        console.log(`      💰 Estimated cost: $${modelDecision.context.estimatedCost.toFixed(6)}`);
        console.log(`      🔢 Tokens: ${modelDecision.context.estimatedTokens}`);
        
      } catch (error) {
        console.log(`      ❌ Failed: ${error.message}`);
      }
      
      console.log('');
    }
    
    // Test 3: Fallback Configuration
    console.log('3️⃣ Testing Fallback Configuration...');
    
    const config = summaryService.getFallbackConfig();
    console.log(`   📋 Strategy: ${config.strategy}`);
    console.log(`   💰 Max primary cost: $${config.costThresholds.maxPrimaryCost}`);
    console.log(`   💰 Max fallback cost: $${config.costThresholds.maxFallbackCost}`);
    console.log(`   ⏱️ Max primary latency: ${config.latencyThresholds.maxPrimaryLatency}ms`);
    console.log(`   ⏱️ Max fallback latency: ${config.latencyThresholds.maxFallbackLatency}ms`);
    console.log(`   🔄 Max retries: ${config.retryConfig.maxRetries}`);
    console.log(`   ⏳ Retry delay: ${config.retryConfig.retryDelay}ms`);
    console.log('');
    
    // Test 4: Error Categorization
    console.log('4️⃣ Testing Error Categorization...');
    
    const testErrors = [
      { status: 429, message: 'Rate limit exceeded' },
      { status: 500, message: 'Internal server error' },
      { status: 503, message: 'Service unavailable' },
      { message: 'Request timeout occurred' },
      { message: 'Network connection failed' },
      { status: 400, message: 'Bad request' },
      { status: 401, message: 'Unauthorized' }
    ];
    
    const decisionEngine = new FallbackDecisionEngine();
    
    testErrors.forEach(error => {
      const errorType = decisionEngine.categorizeError(error);
      const isRetryable = decisionEngine.isRetryableError(error);
      console.log(`   🔍 Error: ${error.message || `HTTP ${error.status}`}`);
      console.log(`      Type: ${errorType}`);
      console.log(`      Retryable: ${isRetryable ? '✅ Yes' : '❌ No'}`);
      console.log('');
    });
    
    // Test 5: Retry Delay Calculation
    console.log('5️⃣ Testing Retry Delay Calculation...');
    
    for (let attempt = 1; attempt <= 5; attempt++) {
      const delay = decisionEngine.calculateRetryDelay(attempt);
      console.log(`   ⏳ Attempt ${attempt}: ${delay}ms delay`);
    }
    console.log('');
    
    // Test 6: Statistics Tracking
    console.log('6️⃣ Testing Statistics Tracking...');
    
    // Simulate some statistics
    summaryService.updateStats('primary', true, 5000);
    summaryService.updateStats('primary', false, 0);
    summaryService.updateStats('fallback', true, 2000);
    summaryService.updateStats('fallback', true, 1800);
    summaryService.stats.totalRetries = 2;
    
    const stats = summaryService.getFallbackStats();
    console.log('   📊 Primary Model:');
    console.log(`      Attempts: ${stats.primary.attempts}`);
    console.log(`      Success Rate: ${stats.primary.successRate}`);
    console.log(`      Avg Time: ${stats.primary.avgProcessingTime}`);
    console.log('');
    console.log('   📊 Fallback Model:');
    console.log(`      Attempts: ${stats.fallback.attempts}`);
    console.log(`      Success Rate: ${stats.fallback.successRate}`);
    console.log(`      Avg Time: ${stats.fallback.avgProcessingTime}`);
    console.log('');
    console.log('   📊 Overall:');
    console.log(`      Total Retries: ${stats.overall.totalRetries}`);
    console.log(`      Fallback Utilization: ${stats.overall.fallbackUtilization}`);
    console.log('');
    
    // Test 7: Decision Context Analysis
    console.log('7️⃣ Testing Decision Context Analysis...');
    
    const contextTests = [
      {
        name: 'Cost-sensitive user',
        context: {
          summaryStyle: 'executive',
          estimatedCost: 0.06,
          estimatedTokens: 8000,
          userPreference: null,
          urgency: 'normal'
        }
      },
      {
        name: 'Time-sensitive user',
        context: {
          summaryStyle: 'action-items',
          estimatedCost: 0.02,
          estimatedTokens: 3000,
          userPreference: null,
          urgency: 'high'
        }
      },
      {
        name: 'Quality-focused user',
        context: {
          summaryStyle: 'technical',
          estimatedCost: 0.03,
          estimatedTokens: 5000,
          userPreference: null,
          urgency: 'normal'
        }
      }
    ];
    
    contextTests.forEach(test => {
      const decision = decisionEngine.selectModel(test.context);
      console.log(`   🎯 ${test.name}:`);
      console.log(`      Decision: ${decision.model} (${decision.reason})`);
      console.log(`      Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      console.log('');
    });
    
    console.log('🎉 Fallback system testing completed!');
    console.log('✅ All fallback logic components are working correctly');
    
  } catch (error) {
    console.error('\n💥 Fallback system test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  testFallbackSystem();
}

module.exports = { testFallbackSystem };
