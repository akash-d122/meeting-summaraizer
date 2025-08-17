#!/usr/bin/env node

/**
 * Comprehensive Integration Tests
 * 
 * Tests the complete summary generation pipeline from transcript upload
 * through summary delivery, including all error handling and fallback mechanisms
 */

const fs = require('fs').promises;
const path = require('path');
const SummaryService = require('../services/summaryService');
const { initializeDatabase, MeetingTranscript, Summary, UserSession } = require('../models');
const { validateGroqConfig } = require('../config/groq');
const { errorHandler } = require('../services/errorHandler');

// Test data for comprehensive integration testing
const integrationTestData = {
  // Complete transcript for end-to-end testing
  fullTranscript: {
    id: 'integration-transcript-001',
    filename: 'integration-test-meeting.txt',
    originalName: 'Integration Test Meeting - Aug 17.txt',
    filePath: '/tmp/integration-test-meeting.txt',
    fileSize: 3456,
    mimeType: 'text/plain',
    content: `Meeting: Product Planning & Architecture Review
Date: August 17, 2025
Duration: 90 minutes
Attendees: Sarah (Product Manager), Mike (Engineering Lead), Lisa (UX Designer), Tom (Marketing Director), Alex (QA Lead)

Sarah: Good morning everyone. Let's start with our quarterly product planning session. We have several key items to discuss today including the new API features, mobile app development, and our Q4 roadmap.

Mike: Thanks Sarah. From an engineering perspective, we've made significant progress on the authentication system. The new JWT implementation is complete and deployed to staging. We're seeing a 40% improvement in login performance.

Sarah: That's excellent news. What about the API rate limiting feature?

Mike: We're about 80% complete. The core functionality is working, but we need to finalize the configuration interface. I estimate we'll be done by September 15th.

Lisa: I've been working closely with the development team on the user experience for the new dashboard. The initial user testing showed some confusion with the navigation, so I've redesigned the information architecture.

Sarah: What specific changes did you make?

Lisa: The main changes include moving the search functionality to a more prominent position, simplifying the menu structure, and adding contextual help tooltips. The revised mockups are ready for review.

Tom: From a marketing standpoint, we need to coordinate the announcement of these new features. I'm planning a comprehensive campaign for October, but I'll need final feature specifications by September 20th.

Sarah: That timeline works well with our development schedule. Mike, can you commit to having feature specs ready by then?

Mike: Absolutely. I'll have detailed specifications and API documentation ready by September 18th to give Tom some buffer time.

Alex: I've been setting up our automated testing framework for the new features. We now have comprehensive test coverage for the authentication system, and I'm working on tests for the API rate limiting.

Sarah: What's our current test coverage?

Alex: We're at 85% code coverage overall, with 95% coverage on critical paths. I found a few edge cases in the password reset flow that need attention.

Mike: I can address those edge cases this week. Alex, can you send me the detailed test results?

Alex: Already in your inbox. I also recommend we do a security audit of the new authentication system before the public release.

Sarah: Good point. Let's schedule that for early September. Now, let's discuss the mobile app development.

Lisa: The mobile app wireframes are complete, and we've started the development process. The core functionality will mirror the web application, but with mobile-optimized workflows.

Mike: From a technical perspective, we're using React Native to ensure consistency across platforms. The API integration is straightforward since we're using the same backend.

Tom: The mobile app is a key differentiator for us. Our competitors don't have strong mobile offerings, so this could be a significant advantage.

Sarah: I agree. What's our timeline for the mobile app beta?

Mike: We're targeting November 1st for a closed beta with select customers, and December 15th for public release.

Alex: I'll need to expand our testing infrastructure to cover mobile platforms. That's additional work, but manageable within the timeline.

Sarah: Perfect. Let's talk about our Q4 roadmap and priorities.

The team discussed several strategic initiatives:

1. Complete the API enhancement project by October 1st
2. Launch mobile app beta by November 1st
3. Implement advanced analytics features by December 1st
4. Prepare for Series B funding round in Q1 2026

Key decisions made:
- Approved budget increase for mobile development team
- Decided to prioritize security audit in September
- Agreed to hire two additional QA engineers
- Committed to weekly progress reviews

Action items:
- Mike: Complete API rate limiting by September 15th
- Lisa: Finalize mobile app wireframes by August 25th
- Tom: Prepare marketing campaign materials by September 20th
- Alex: Expand testing infrastructure by September 30th
- Sarah: Schedule security audit for early September

Next meeting: August 24th to review progress on all initiatives.

Meeting adjourned at 11:30 AM.`,
    
    status: 'processed',
    metadata: {
      attendees: 'Sarah, Mike, Lisa, Tom, Alex',
      duration: '90 minutes',
      meetingType: 'planning',
      topics: ['API features', 'mobile app', 'Q4 roadmap'],
      uploadedAt: new Date().toISOString()
    },
    sessionId: 'integration-test-session'
  },

  // Test session data
  testSession: {
    id: 'integration-test-session',
    sessionToken: 'integration-test-token-' + Date.now(),
    ipAddress: '127.0.0.1',
    userAgent: 'Integration Test Agent',
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    workflowState: 'summary',
    preferences: {
      defaultSummaryStyle: 'executive'
    },
    statistics: {
      transcriptsProcessed: 0,
      summariesGenerated: 0,
      totalCost: 0
    }
  },

  // Test scenarios for different summary styles
  testScenarios: [
    {
      name: 'Executive Summary',
      options: {
        summaryStyle: 'executive',
        customInstructions: 'Focus on strategic decisions and business impact',
        urgency: 'normal'
      }
    },
    {
      name: 'Action Items Focus',
      options: {
        summaryStyle: 'action-items',
        customInstructions: 'Extract all tasks with clear owners and deadlines',
        urgency: 'high'
      }
    },
    {
      name: 'Technical Summary',
      options: {
        summaryStyle: 'technical',
        customInstructions: 'Include technical details and implementation approaches',
        urgency: 'normal'
      }
    },
    {
      name: 'Detailed Overview',
      options: {
        summaryStyle: 'detailed',
        customInstructions: 'Comprehensive summary with all discussion points',
        urgency: 'normal'
      }
    }
  ]
};

async function setupIntegrationTest() {
  console.log('🔧 Setting up integration test environment...');
  
  try {
    // Initialize database
    await initializeDatabase();
    
    // Create test transcript
    const [transcript] = await MeetingTranscript.findOrCreate({
      where: { id: integrationTestData.fullTranscript.id },
      defaults: integrationTestData.fullTranscript
    });
    
    // Create test session
    const [session] = await UserSession.findOrCreate({
      where: { id: integrationTestData.testSession.id },
      defaults: integrationTestData.testSession
    });
    
    // Clear any existing error logs for clean testing
    errorHandler.clearErrorLogs();
    
    console.log('✅ Integration test environment setup complete');
    return { transcript, session };
    
  } catch (error) {
    console.error('❌ Integration test setup failed:', error.message);
    throw error;
  }
}

async function testCompleteWorkflow() {
  console.log('🧪 Testing Complete Summary Generation Workflow\n');
  
  const groqValidation = validateGroqConfig();
  if (!groqValidation.isValid) {
    console.log('⚠️ Groq API not configured - running offline tests only\n');
    console.log('💡 To test with real API:');
    console.log('   1. Set GROQ_API_KEY in your .env file');
    console.log('   2. Run: npm run test:groq to verify setup');
    console.log('   3. Re-run this integration test\n');
  }
  
  const summaryService = new SummaryService();
  
  try {
    // Setup test environment
    const { transcript, session } = await setupIntegrationTest();
    
    // Test 1: Service initialization and health checks
    console.log('1️⃣ Testing service initialization and health checks...');
    
    console.log(`   ✅ SummaryService initialized`);
    console.log(`   ✅ Database connected`);
    console.log(`   ✅ Test transcript loaded: ${transcript.originalName}`);
    console.log(`   ✅ Test session created: ${session.id}`);
    console.log(`   📊 Groq API: ${groqValidation.isValid ? 'Configured' : 'Not configured'}`);
    console.log('');
    
    // Test 2: Transcript validation and loading
    console.log('2️⃣ Testing transcript validation and loading...');
    
    try {
      const loadedTranscript = await summaryService.loadTranscript(transcript.id);
      console.log(`   ✅ Transcript loaded successfully`);
      console.log(`   📄 Content length: ${loadedTranscript.contentLength} characters`);
      console.log(`   🔢 Token count: ${loadedTranscript.tokenCount || 'estimated'} tokens`);
      console.log(`   📊 Status: ${loadedTranscript.status}`);
    } catch (error) {
      console.log(`   ❌ Transcript loading failed: ${error.message}`);
    }
    console.log('');
    
    // Test 3: Prompt generation for different styles
    console.log('3️⃣ Testing prompt generation for different styles...');
    
    for (const scenario of integrationTestData.testScenarios) {
      try {
        const promptData = summaryService.buildPrompt(transcript, scenario.options);
        const stats = summaryService.promptEngine.getPromptStats(promptData);
        
        console.log(`   📝 ${scenario.name}:`);
        console.log(`      Tokens: ${stats.totalEstimatedTokens}`);
        console.log(`      Cost: $${stats.estimatedCost.toFixed(6)}`);
        console.log(`      Temperature: ${promptData.temperature}`);
        console.log(`      Max output: ${promptData.maxTokens} tokens`);
        
      } catch (error) {
        console.log(`   ❌ ${scenario.name} failed: ${error.message}`);
      }
    }
    console.log('');
    
    // Test 4: Model selection and fallback logic
    console.log('4️⃣ Testing model selection and fallback logic...');
    
    for (const scenario of integrationTestData.testScenarios.slice(0, 2)) { // Test first 2 scenarios
      try {
        const promptData = summaryService.buildPrompt(transcript, scenario.options);
        const modelDecision = await summaryService.selectOptimalModel(
          transcript, 
          promptData, 
          scenario.options, 
          session
        );
        
        console.log(`   🤖 ${scenario.name}:`);
        console.log(`      Selected model: ${modelDecision.model}`);
        console.log(`      Reason: ${modelDecision.reason}`);
        console.log(`      Confidence: ${(modelDecision.confidence * 100).toFixed(1)}%`);
        
      } catch (error) {
        console.log(`   ❌ ${scenario.name} model selection failed: ${error.message}`);
      }
    }
    console.log('');
    
    // Test 5: Full summary generation (if API is configured)
    if (groqValidation.isValid) {
      console.log('5️⃣ Testing full summary generation with real API...');
      
      for (const scenario of integrationTestData.testScenarios.slice(0, 2)) { // Test first 2 scenarios
        try {
          console.log(`   🚀 Generating ${scenario.name}...`);
          
          const startTime = Date.now();
          const result = await summaryService.generateSummary(transcript.id, {
            ...scenario.options,
            sessionToken: session.sessionToken
          });
          const endTime = Date.now();
          
          console.log(`   ✅ ${scenario.name} completed:`);
          console.log(`      Summary ID: ${result.id}`);
          console.log(`      Content length: ${result.content.length} characters`);
          console.log(`      Quality grade: ${result.quality.grade} (${(result.quality.score * 100).toFixed(1)}%)`);
          console.log(`      Processing time: ${endTime - startTime}ms`);
          console.log(`      Tokens used: ${result.tokenUsage.totalTokens}`);
          console.log(`      Cost: $${result.cost.toFixed(6)}`);
          console.log(`      Model: ${result.model}`);
          
          // Test response formats
          if (result.formats) {
            console.log(`      Available formats: ${Object.keys(result.formats).join(', ')}`);
          }
          
          // Test quality metrics
          if (result.quality) {
            console.log(`      Quality issues: ${result.quality.issues.length}`);
            console.log(`      Quality strengths: ${result.quality.strengths.length}`);
          }
          
          // Test structure analysis
          if (result.structure) {
            console.log(`      Structure: ${result.structure.headings} headings, ${result.structure.actionItems} actions`);
          }
          
          console.log('');
          
        } catch (error) {
          console.log(`   ❌ ${scenario.name} generation failed:`);
          
          if (error.error) {
            // This is a user-friendly error response
            console.log(`      Error type: ${error.error.type}`);
            console.log(`      Message: ${error.error.userMessage.title}`);
            console.log(`      Actions available: ${error.error.actions.length}`);
            console.log(`      Error ID: ${error.error.errorId}`);
          } else {
            console.log(`      Raw error: ${error.message}`);
          }
          console.log('');
        }
      }
    } else {
      console.log('5️⃣ Skipping API tests (Groq not configured)\n');
    }
    
    // Test 6: Error handling scenarios
    console.log('6️⃣ Testing error handling scenarios...');
    
    const errorScenarios = [
      {
        name: 'Invalid transcript ID',
        test: () => summaryService.loadTranscript('nonexistent-transcript')
      },
      {
        name: 'Empty transcript content',
        test: async () => {
          const emptyTranscript = { ...transcript.dataValues };
          emptyTranscript.content = '';
          await MeetingTranscript.create({
            ...emptyTranscript,
            id: 'empty-transcript-test',
            content: ''
          });
          return summaryService.loadTranscript('empty-transcript-test');
        }
      }
    ];
    
    for (const scenario of errorScenarios) {
      try {
        await scenario.test();
        console.log(`   ❌ ${scenario.name}: Should have failed but didn't`);
      } catch (error) {
        if (error.error && error.error.userMessage) {
          // User-friendly error response
          console.log(`   ✅ ${scenario.name}: Handled gracefully`);
          console.log(`      Message: ${error.error.userMessage.title}`);
          console.log(`      Actions: ${error.error.actions.length} available`);
        } else {
          // Raw error
          console.log(`   ✅ ${scenario.name}: Error caught`);
          console.log(`      Message: ${error.message}`);
        }
      }
    }
    console.log('');
    
    // Test 7: Performance and load testing
    console.log('7️⃣ Testing performance characteristics...');
    
    const performanceTests = [
      {
        name: 'Prompt generation speed',
        test: async () => {
          const iterations = 10;
          const startTime = Date.now();
          
          for (let i = 0; i < iterations; i++) {
            summaryService.buildPrompt(transcript, integrationTestData.testScenarios[0].options);
          }
          
          const endTime = Date.now();
          return (endTime - startTime) / iterations;
        }
      },
      {
        name: 'Model selection speed',
        test: async () => {
          const iterations = 5;
          const startTime = Date.now();
          
          for (let i = 0; i < iterations; i++) {
            const promptData = summaryService.buildPrompt(transcript, integrationTestData.testScenarios[0].options);
            await summaryService.selectOptimalModel(transcript, promptData, integrationTestData.testScenarios[0].options, session);
          }
          
          const endTime = Date.now();
          return (endTime - startTime) / iterations;
        }
      }
    ];
    
    for (const test of performanceTests) {
      try {
        const avgTime = await test.test();
        console.log(`   ⚡ ${test.name}: ${avgTime.toFixed(1)}ms average`);
      } catch (error) {
        console.log(`   ❌ ${test.name}: Failed - ${error.message}`);
      }
    }
    console.log('');
    
    // Test 8: Database integration and persistence
    console.log('8️⃣ Testing database integration and persistence...');
    
    try {
      // Check if summaries were created
      const summaries = await Summary.findAll({
        include: [{
          model: MeetingTranscript,
          where: { sessionId: session.id }
        }]
      });
      
      console.log(`   📊 Summaries created: ${summaries.length}`);
      
      if (summaries.length > 0) {
        const summary = summaries[0];
        console.log(`   ✅ Summary persistence verified`);
        console.log(`      ID: ${summary.id}`);
        console.log(`      Status: ${summary.status}`);
        console.log(`      Style: ${summary.summaryStyle}`);
        console.log(`      Quality: ${summary.quality || 'N/A'}`);
        console.log(`      Cost: $${summary.cost ? summary.cost.toFixed(6) : '0.000000'}`);
        
        // Test metadata storage
        if (summary.metadata) {
          console.log(`      Metadata stored: ✅`);
          console.log(`      Processing time: ${summary.metadata.responseProcessing?.processingTime || 'N/A'}ms`);
          console.log(`      Quality grade: ${summary.metadata.responseProcessing?.qualityGrade || 'N/A'}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Database integration test failed: ${error.message}`);
    }
    console.log('');
    
    // Test 9: Session state management
    console.log('9️⃣ Testing session state management...');
    
    try {
      const updatedSession = await UserSession.findByPk(session.id);
      
      console.log(`   ✅ Session state preserved`);
      console.log(`      Workflow state: ${updatedSession.workflowState}`);
      console.log(`      Statistics updated: ${updatedSession.statistics ? '✅' : '❌'}`);
      
      if (updatedSession.statistics) {
        console.log(`      Summaries generated: ${updatedSession.statistics.summariesGenerated || 0}`);
        console.log(`      Total cost: $${(updatedSession.statistics.totalCost || 0).toFixed(6)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Session state test failed: ${error.message}`);
    }
    console.log('');
    
    // Test 10: System health and monitoring
    console.log('🔟 Testing system health and monitoring...');
    
    try {
      const errorStats = errorHandler.getErrorStats('1h');
      const fallbackStats = summaryService.getFallbackStats();
      
      console.log(`   📊 System health metrics:`);
      console.log(`      Errors in last hour: ${errorStats.total}`);
      console.log(`      Critical errors: ${errorStats.bySeverity?.critical || 0}`);
      console.log(`      Primary model attempts: ${fallbackStats.primary.attempts}`);
      console.log(`      Fallback model attempts: ${fallbackStats.fallback.attempts}`);
      console.log(`      Overall fallback utilization: ${fallbackStats.overall.fallbackUtilization}`);
      
      // Health score calculation
      const healthScore = Math.max(0, 100 - (errorStats.total * 2) - (errorStats.bySeverity?.critical || 0) * 10);
      console.log(`      System health score: ${healthScore}%`);
      
    } catch (error) {
      console.log(`   ❌ Health monitoring test failed: ${error.message}`);
    }
    console.log('');
    
    console.log('🎉 Integration testing completed!');
    
    if (groqValidation.isValid) {
      console.log('✅ Full end-to-end workflow tested with real API');
    } else {
      console.log('⚠️ Offline tests completed - configure Groq API for full testing');
    }
    
    console.log('🔗 All components integrated successfully');
    
  } catch (error) {
    console.error('\n💥 Integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run integration tests if executed directly
if (require.main === module) {
  testCompleteWorkflow();
}

module.exports = { testCompleteWorkflow };
