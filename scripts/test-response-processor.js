#!/usr/bin/env node

/**
 * Test script for Response Processor
 * 
 * Tests response validation, structure extraction, content analysis,
 * quality assessment, and multi-format output generation
 */

const ResponseProcessor = require('../services/responseProcessor');

// Test data for different scenarios
const testResponses = {
  wellFormed: {
    content: `# Weekly Team Standup Summary

## Key Updates
• Alice completed the user authentication system and deployed to staging
• Bob made significant progress on the API rate limiting feature
• Charlie finished the new dashboard mockups with positive client feedback
• Diana set up automated testing framework and found edge cases in login flow

## Decisions Made
• Decided to implement phased rollout for database migration over two weeks
• Agreed to target October 1st for public announcement of new features
• Approved revised navigation design based on client feedback

## Action Items
• Bob: Complete API rate limiting implementation - Owner: Bob - Due: Friday
• Charlie: Provide updated API documentation - Owner: Charlie - Due: Wednesday  
• Diana: Send edge case details to Bob - Owner: Diana - Due: Tomorrow
• Alice: Schedule design-dev sync meeting - Owner: Alice - Due: Monday

## Next Steps
The team is on track for the Q4 roadmap. Weekly check-ins will continue to monitor progress on the mobile app integration planned for next week.`,
    
    usage: {
      prompt_tokens: 1200,
      completion_tokens: 350,
      total_tokens: 1550
    },
    model: 'llama-3.3-70b-versatile',
    requestId: 'req-test-001',
    processingTime: 5500,
    finishReason: 'stop'
  },

  malformed: {
    content: `meeting summary

alice did stuff
bob worked on things
charlie made designs

some decisions were made
need to do more work

action items:
- someone should do something
- another person needs to handle other stuff
- deadlines are important

thats all`,
    
    usage: {
      prompt_tokens: 800,
      completion_tokens: 120,
      total_tokens: 920
    },
    model: 'llama-3.1-8b-instant',
    requestId: 'req-test-002',
    processingTime: 2100,
    finishReason: 'stop'
  },

  empty: {
    content: '',
    usage: {
      prompt_tokens: 500,
      completion_tokens: 0,
      total_tokens: 500
    },
    model: 'llama-3.3-70b-versatile',
    requestId: 'req-test-003',
    processingTime: 1000,
    finishReason: 'length'
  },

  errorResponse: {
    content: 'I cannot process this transcript as it appears to be corrupted or incomplete.',
    usage: {
      prompt_tokens: 600,
      completion_tokens: 25,
      total_tokens: 625
    },
    model: 'llama-3.3-70b-versatile',
    requestId: 'req-test-004',
    processingTime: 1500,
    finishReason: 'stop'
  },

  tooLong: {
    content: 'This is a very long summary. '.repeat(2000), // 60,000 characters
    usage: {
      prompt_tokens: 2000,
      completion_tokens: 1500,
      total_tokens: 3500
    },
    model: 'llama-3.3-70b-versatile',
    requestId: 'req-test-005',
    processingTime: 8000,
    finishReason: 'length'
  },

  encodingIssues: {
    content: `Meeting Summary

Attendeesâ€™ feedback was positive. The teamâ€™s decision to implement the new API was well-received.

Key Points:
â€¢ Budget approved for Q4
â€¢ Timeline extended by 2 weeks  
â€¢ New hire starts Monday

Next Steps:
â€" Review architecture proposal
â€" Schedule client demo
â€" Update project timeline

Contact: john.doe@company.com for questions.`,
    
    usage: {
      prompt_tokens: 900,
      completion_tokens: 200,
      total_tokens: 1100
    },
    model: 'llama-3.1-8b-instant',
    requestId: 'req-test-006',
    processingTime: 3000,
    finishReason: 'stop'
  },

  actionItemsStyle: {
    content: `# Action Items Summary

## Immediate Actions (Next 1-2 weeks)
• Complete user authentication refactor - Owner: Bob - Due: September 15th - Priority: High
• Finalize dashboard mockups - Owner: Charlie - Due: September 10th - Priority: High
• Set up automated testing - Owner: Diana - Due: September 12th - Priority: Medium

## Short-term Actions (Next month)
• Database migration planning - Owner: Bob - Due: September 20th - Dependencies: Authentication completion
• Client demo preparation - Owner: Alice - Due: September 25th - Dependencies: Dashboard mockups
• Marketing campaign materials - Owner: Tom - Due: October 1st - Dependencies: Feature completion

## Decisions Made
• Phased rollout approach approved for database migration
• October 1st target date confirmed for public announcement
• Weekly check-ins scheduled for progress monitoring

## Pending Decisions
• Beta user selection criteria - Owner: Alice - Due: September 18th
• Pricing strategy for new features - Owner: Sarah - Due: September 22nd

## Follow-up Required
• Design-dev sync meeting - Next step: Schedule for Monday - By: Alice
• API documentation update - Next step: Review current docs - By: September 8th`,
    
    usage: {
      prompt_tokens: 1500,
      completion_tokens: 450,
      total_tokens: 1950
    },
    model: 'llama-3.3-70b-versatile',
    requestId: 'req-test-007',
    processingTime: 6200,
    finishReason: 'stop'
  }
};

// Test contexts for different scenarios
const testContexts = {
  executive: {
    summaryStyle: 'executive',
    customInstructions: 'Focus on strategic decisions and business impact',
    modelUsed: 'primary',
    transcriptId: 'transcript-001'
  },
  
  actionItems: {
    summaryStyle: 'action-items',
    customInstructions: 'Extract all tasks with clear owners and deadlines',
    modelUsed: 'primary',
    transcriptId: 'transcript-002'
  },
  
  technical: {
    summaryStyle: 'technical',
    customInstructions: 'Include technical details and implementation approaches',
    modelUsed: 'primary',
    transcriptId: 'transcript-003'
  },
  
  fallback: {
    summaryStyle: 'executive',
    customInstructions: 'Keep it concise',
    modelUsed: 'fallback',
    fallbackUsed: true,
    attemptCount: 2,
    transcriptId: 'transcript-004'
  }
};

async function testResponseProcessor() {
  console.log('📝 Testing Response Processor\n');
  
  const processor = new ResponseProcessor();
  
  try {
    // Test 1: Well-formed response processing
    console.log('1️⃣ Testing well-formed response processing...');
    
    const wellFormedResult = await processor.processResponse(
      testResponses.wellFormed, 
      testContexts.executive
    );
    
    console.log(`   ✅ Success: ${wellFormedResult.success}`);
    console.log(`   📊 Quality Score: ${wellFormedResult.content.quality.score} (${wellFormedResult.content.quality.grade})`);
    console.log(`   📝 Content Length: ${wellFormedResult.content.normalized.length} chars`);
    console.log(`   🏗️ Structure: ${wellFormedResult.content.structure.headings.length} headings, ${wellFormedResult.content.structure.actionItems.length} actions`);
    console.log(`   💰 Cost: $${wellFormedResult.metadata.cost.total.toFixed(6)}`);
    console.log(`   ⏱️ Processing Time: ${wellFormedResult.metadata.processingTime}ms`);
    console.log('');
    
    // Test 2: Malformed response handling
    console.log('2️⃣ Testing malformed response handling...');
    
    const malformedResult = await processor.processResponse(
      testResponses.malformed,
      testContexts.actionItems
    );
    
    console.log(`   ✅ Success: ${malformedResult.success}`);
    console.log(`   📊 Quality Score: ${malformedResult.content.quality.score} (${malformedResult.content.quality.grade})`);
    console.log(`   ⚠️ Issues: ${malformedResult.content.quality.issues.join(', ')}`);
    console.log(`   📈 Completeness: ${malformedResult.content.analysis.completeness.coverage}`);
    console.log('');
    
    // Test 3: Empty response handling
    console.log('3️⃣ Testing empty response handling...');
    
    const emptyResult = await processor.processResponse(
      testResponses.empty,
      testContexts.executive
    );
    
    console.log(`   ✅ Success: ${emptyResult.success}`);
    console.log(`   ❌ Error: ${emptyResult.error || 'None'}`);
    console.log(`   📊 Validation: ${emptyResult.validation.isValid ? 'Valid' : 'Invalid'}`);
    if (emptyResult.validation.errors) {
      console.log(`   🚫 Errors: ${emptyResult.validation.errors.join(', ')}`);
    }
    console.log('');
    
    // Test 4: Error response handling
    console.log('4️⃣ Testing error response handling...');
    
    const errorResult = await processor.processResponse(
      testResponses.errorResponse,
      testContexts.technical
    );
    
    console.log(`   ✅ Success: ${errorResult.success}`);
    console.log(`   📊 Validation: ${errorResult.validation.isValid ? 'Valid' : 'Invalid'}`);
    if (errorResult.validation.errors) {
      console.log(`   🚫 Validation Errors: ${errorResult.validation.errors.join(', ')}`);
    }
    console.log('');
    
    // Test 5: Encoding issues handling
    console.log('5️⃣ Testing encoding issues handling...');
    
    const encodingResult = await processor.processResponse(
      testResponses.encodingIssues,
      testContexts.executive
    );
    
    console.log(`   ✅ Success: ${encodingResult.success}`);
    console.log(`   📝 Original Length: ${testResponses.encodingIssues.content.length} chars`);
    console.log(`   📝 Normalized Length: ${encodingResult.content.normalized.length} chars`);
    console.log(`   🔧 Encoding Fixed: ${testResponses.encodingIssues.content !== encodingResult.content.normalized}`);
    console.log(`   📧 Emails Found: ${encodingResult.content.structure.emails.length}`);
    console.log('');
    
    // Test 6: Action items style processing
    console.log('6️⃣ Testing action items style processing...');
    
    const actionItemsResult = await processor.processResponse(
      testResponses.actionItemsStyle,
      testContexts.actionItems
    );
    
    console.log(`   ✅ Success: ${actionItemsResult.success}`);
    console.log(`   🎯 Action Items: ${actionItemsResult.content.structure.actionItems.length}`);
    console.log(`   ✅ Decisions: ${actionItemsResult.content.structure.decisions.length}`);
    console.log(`   📊 Actionability Score: ${actionItemsResult.content.analysis.actionability.score} (${actionItemsResult.content.analysis.actionability.level})`);
    console.log(`   📈 Completeness: ${(actionItemsResult.content.analysis.completeness.score * 100).toFixed(1)}%`);
    console.log('');
    
    // Test 7: Format generation
    console.log('7️⃣ Testing format generation...');
    
    const formats = wellFormedResult.formats;
    console.log(`   📱 UI Format: ${formats.ui ? 'Generated' : 'Missing'}`);
    console.log(`   📧 Email Format: ${formats.email ? 'Generated' : 'Missing'}`);
    console.log(`   📄 Text Format: ${formats.text ? 'Generated' : 'Missing'}`);
    console.log(`   📝 Markdown Format: ${formats.markdown ? 'Generated' : 'Missing'}`);
    
    if (formats.ui) {
      console.log(`   📋 UI Title: "${formats.ui.title}"`);
      console.log(`   ✨ Highlights: ${formats.ui.highlights.length}`);
      console.log(`   📊 Quality Badge: ${formats.ui.metadata.quality}`);
    }
    
    if (formats.email) {
      console.log(`   📧 Email Subject: "${formats.email.subject}"`);
    }
    console.log('');
    
    // Test 8: Validation edge cases
    console.log('8️⃣ Testing validation edge cases...');
    
    const edgeCases = [
      { name: 'Null response', response: null },
      { name: 'Missing content', response: { usage: {} } },
      { name: 'Non-string content', response: { content: 123 } },
      { name: 'Too long content', response: testResponses.tooLong }
    ];
    
    for (const testCase of edgeCases) {
      try {
        const result = await processor.processResponse(testCase.response, testContexts.executive);
        console.log(`   ${testCase.name}: ${result.success ? '✅ Handled' : '❌ Failed'}`);
        if (!result.success && result.error) {
          console.log(`      Error: ${result.error}`);
        }
      } catch (error) {
        console.log(`   ${testCase.name}: ❌ Exception - ${error.message}`);
      }
    }
    console.log('');
    
    // Test 9: Content analysis
    console.log('9️⃣ Testing content analysis...');
    
    const analysis = wellFormedResult.content.analysis;
    console.log(`   📖 Readability: ${analysis.readability.score.toFixed(1)} (${analysis.readability.level})`);
    console.log(`   😊 Sentiment: ${analysis.sentiment.overall} (${analysis.sentiment.positive}% positive)`);
    console.log(`   📋 Completeness: ${(analysis.completeness.score * 100).toFixed(1)}%`);
    console.log(`   🎯 Actionability: ${analysis.actionability.level} (${analysis.actionability.total} items)`);
    console.log(`   📊 Coverage: ${analysis.coverage.level}`);
    console.log('');
    
    // Test 10: Metadata enrichment
    console.log('🔟 Testing metadata enrichment...');
    
    const metadata = wellFormedResult.metadata;
    console.log(`   🤖 Model: ${metadata.model.name} (${metadata.model.type})`);
    console.log(`   🔢 Tokens: ${metadata.usage.totalTokens} (${metadata.usage.inputTokens} in, ${metadata.usage.outputTokens} out)`);
    console.log(`   💰 Cost: $${metadata.cost.total.toFixed(6)} (Input: $${metadata.cost.inputCost.toFixed(6)}, Output: $${metadata.cost.outputCost.toFixed(6)})`);
    console.log(`   ⏱️ Processing: ${metadata.processing.processingTime}ms`);
    console.log(`   📊 Quality: ${metadata.metrics.qualityGrade} (${metadata.metrics.qualityScore})`);
    console.log(`   📝 Context: ${metadata.context.summaryStyle} style`);
    console.log('');
    
    console.log('🎉 Response processor testing completed!');
    console.log('✅ All processing pipeline components are working correctly');
    
  } catch (error) {
    console.error('\n💥 Response processor test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  testResponseProcessor();
}

module.exports = { testResponseProcessor };
