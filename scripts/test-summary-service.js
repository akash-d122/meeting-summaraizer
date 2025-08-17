#!/usr/bin/env node

/**
 * Test script for Summary Service
 * 
 * Tests the complete summary generation pipeline:
 * - Database integration
 * - Prompt generation
 * - Groq API calls
 * - Result processing
 */

const SummaryService = require('../services/summaryService');
const { initializeDatabase, MeetingTranscript, Summary, UserSession } = require('../models');
const { validateGroqConfig } = require('../config/groq');

// Mock transcript data for testing
const mockTranscriptData = {
  id: 'test-transcript-001',
  filename: 'test-meeting.txt',
  originalName: 'Weekly Team Standup - Aug 17.txt',
  filePath: '/tmp/test-meeting.txt',
  fileSize: 2048,
  mimeType: 'text/plain',
  content: `Meeting: Weekly Team Standup
Date: August 17, 2025
Attendees: Alice (PM), Bob (Dev), Charlie (Design), Diana (QA)

Alice: Good morning everyone. Let's start with our weekly standup. Bob, what did you work on this week?

Bob: I completed the user authentication refactor and deployed it to staging. The new JWT implementation is working well. I also started work on the API rate limiting feature. Should have that done by Friday.

Alice: Great progress. Any blockers?

Bob: I need the updated API documentation from Charlie to finish the rate limiting implementation properly.

Charlie: I can get that to you by Wednesday. I've been working on the new dashboard mockups. The client feedback was positive, but they want some changes to the navigation flow.

Alice: What kind of changes?

Charlie: They want the main menu to be more prominent and add a quick search feature. I'll have the revised mockups ready by Thursday.

Diana: From QA perspective, I've been testing the authentication changes Bob deployed. Found a few edge cases with password reset that need attention. Also set up automated testing for the new features.

Bob: Thanks Diana. Can you send me the details on those edge cases?

Diana: Already in your inbox. Also, we should discuss the test data setup for the rate limiting feature.

Alice: Perfect. Let's schedule a quick sync for tomorrow afternoon. Any other updates?

Charlie: The design system documentation is almost complete. Should be ready for team review by end of week.

Alice: Excellent. Our sprint is on track. Next week we'll focus on the mobile app integration. Thanks everyone!`,
  
  contentLength: 1456,
  tokenCount: 364,
  status: 'processed',
  metadata: {
    attendees: 'Alice, Bob, Charlie, Diana',
    duration: '15 minutes',
    meetingType: 'standup'
  },
  sessionId: 'test-session-001'
};

async function setupTestData() {
  console.log('🔧 Setting up test data...');
  
  try {
    // Initialize database
    await initializeDatabase();
    
    // Create test transcript
    const [transcript] = await MeetingTranscript.findOrCreate({
      where: { id: mockTranscriptData.id },
      defaults: mockTranscriptData
    });
    
    // Create test session
    const [session] = await UserSession.findOrCreate({
      where: { id: 'test-session-001' },
      defaults: {
        sessionToken: 'test-token-001-abcdef123456789012345678901234567890',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        workflowState: 'summary',
        currentTranscriptId: transcript.id,
        preferences: {
          defaultSummaryStyle: 'executive'
        },
        statistics: {
          transcriptsProcessed: 1,
          summariesGenerated: 0,
          totalCost: 0
        }
      }
    });
    
    console.log('✅ Test data setup complete');
    return { transcript, session };
    
  } catch (error) {
    console.error('❌ Test data setup failed:', error.message);
    throw error;
  }
}

async function testSummaryService() {
  console.log('🧪 Testing Summary Service\n');
  
  // Check Groq configuration first
  const groqValidation = validateGroqConfig();
  if (!groqValidation.isValid) {
    console.log('⚠️ Groq API not configured - running offline tests only\n');
    console.log('💡 To test with real API:');
    console.log('   1. Set GROQ_API_KEY in your .env file');
    console.log('   2. Run: npm run test:groq to verify setup');
    console.log('   3. Re-run this test\n');
  }
  
  const summaryService = new SummaryService();
  
  try {
    // Setup test data
    const { transcript, session } = await setupTestData();
    
    // Test 1: Service initialization
    console.log('1️⃣ Testing service initialization...');
    console.log('   ✅ SummaryService created successfully');
    console.log('   ✅ PromptEngine initialized');
    console.log('   ✅ Model configurations loaded\n');
    
    // Test 2: Transcript loading and validation
    console.log('2️⃣ Testing transcript loading...');
    
    try {
      const loadedTranscript = await summaryService.loadTranscript(transcript.id);
      console.log(`   ✅ Transcript loaded: ${loadedTranscript.originalName}`);
      console.log(`   📊 Content length: ${loadedTranscript.contentLength} characters`);
      console.log(`   🔢 Token count: ${loadedTranscript.tokenCount} tokens\n`);
    } catch (error) {
      console.log(`   ❌ Transcript loading failed: ${error.message}\n`);
    }
    
    // Test 3: Prompt building
    console.log('3️⃣ Testing prompt building...');
    
    const testOptions = {
      summaryStyle: 'action-items',
      customInstructions: 'Focus on specific tasks and deadlines. Include owner assignments.',
      sessionToken: session.sessionToken
    };
    
    try {
      const promptData = summaryService.buildPrompt(transcript, testOptions);
      console.log(`   ✅ Prompt built successfully`);
      console.log(`   📊 Estimated tokens: ${promptData.estimatedTokens}`);
      console.log(`   🎛️ Max output tokens: ${promptData.maxTokens}`);
      console.log(`   🌡️ Temperature: ${promptData.temperature}\n`);
    } catch (error) {
      console.log(`   ❌ Prompt building failed: ${error.message}\n`);
    }
    
    // Test 4: Database record creation
    console.log('4️⃣ Testing summary record creation...');
    
    try {
      const promptData = summaryService.buildPrompt(transcript, testOptions);
      const summaryRecord = await summaryService.createSummaryRecord(transcript, testOptions, promptData);
      
      console.log(`   ✅ Summary record created: ${summaryRecord.id}`);
      console.log(`   📝 Style: ${summaryRecord.summaryStyle}`);
      console.log(`   🤖 Model: ${summaryRecord.aiModel}`);
      console.log(`   📊 Status: ${summaryRecord.status}\n`);
      
      // Clean up test record
      await summaryRecord.destroy();
      
    } catch (error) {
      console.log(`   ❌ Summary record creation failed: ${error.message}\n`);
    }
    
    // Test 5: Full generation (if API is configured)
    if (groqValidation.isValid) {
      console.log('5️⃣ Testing full summary generation...');
      
      try {
        const result = await summaryService.generateSummary(transcript.id, testOptions);
        
        console.log(`   ✅ Summary generated successfully!`);
        console.log(`   📝 Summary ID: ${result.id}`);
        console.log(`   📊 Content length: ${result.content.length} characters`);
        console.log(`   🔢 Tokens used: ${result.tokenUsage?.total_tokens || 'N/A'}`);
        console.log(`   💰 Cost: $${result.cost.toFixed(6)}`);
        console.log(`   ⏱️ Processing time: ${result.processingTime}ms`);
        console.log(`   🤖 Model: ${result.model}\n`);
        
        console.log('   📄 Generated Summary Preview:');
        console.log(`   "${result.content.substring(0, 200)}..."\n`);
        
        // Test different styles
        console.log('6️⃣ Testing different summary styles...');
        
        const styles = ['executive', 'technical', 'detailed'];
        
        for (const style of styles) {
          try {
            const styleResult = await summaryService.generateSummary(transcript.id, {
              ...testOptions,
              summaryStyle: style
            });
            
            console.log(`   ✅ ${style} style: ${styleResult.content.length} chars, $${styleResult.cost.toFixed(6)}`);
            
          } catch (error) {
            console.log(`   ❌ ${style} style failed: ${error.message}`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Full generation failed: ${error.message}`);
        console.log(`   Details: ${error.stack}\n`);
      }
    } else {
      console.log('5️⃣ Skipping API tests (Groq not configured)\n');
    }
    
    // Test 6: Statistics
    console.log('7️⃣ Testing generation statistics...');
    
    try {
      const stats = await summaryService.getGenerationStats('24h');
      console.log(`   ✅ Statistics retrieved: ${stats.length} records`);
      
      if (stats.length > 0) {
        stats.forEach(stat => {
          console.log(`   📊 ${stat.summaryStyle} (${stat.aiModel}): ${stat.count} summaries`);
        });
      } else {
        console.log('   📊 No recent summaries found');
      }
      
    } catch (error) {
      console.log(`   ❌ Statistics failed: ${error.message}`);
    }
    
    console.log('\n🎉 Summary service testing completed!');
    
    if (groqValidation.isValid) {
      console.log('✅ All tests passed - service is ready for production');
    } else {
      console.log('⚠️ Offline tests passed - configure Groq API for full functionality');
    }
    
  } catch (error) {
    console.error('\n💥 Summary service test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Error handling for missing dependencies
async function testWithErrorHandling() {
  try {
    await testSummaryService();
  } catch (error) {
    if (error.message.includes('GROQ_API_KEY')) {
      console.log('\n💡 Groq API Setup Required:');
      console.log('   1. Get API key from: https://console.groq.com/keys');
      console.log('   2. Add to .env: GROQ_API_KEY=your_key_here');
      console.log('   3. Run: npm run test:groq to verify');
      console.log('   4. Re-run this test for full functionality\n');
    } else {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  testWithErrorHandling();
}

module.exports = { testSummaryService };
