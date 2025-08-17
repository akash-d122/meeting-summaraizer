#!/usr/bin/env node

/**
 * Prompt Integration Example
 * 
 * Demonstrates how the prompt engine integrates with:
 * - Custom instruction system
 * - Database transcript data
 * - Groq API preparation
 */

const PromptEngine = require('../services/promptEngine');
const PromptTemplates = require('../services/promptTemplates');

// Simulate database transcript data
const mockTranscriptData = {
  id: 'transcript-123',
  content: `Meeting: Product Planning Session
Date: August 17, 2025
Attendees: Sarah (Product Manager), Mike (Engineering Lead), Lisa (Designer), Tom (Marketing)

Sarah: Let's review our Q4 product roadmap. Mike, what's the status on the new API features?

Mike: We've completed the authentication overhaul and the rate limiting system. The new GraphQL endpoints are 80% done. I estimate we'll finish by September 15th.

Sarah: That's great progress. Any technical challenges?

Mike: The main challenge is the database migration for existing users. We need to be careful not to disrupt service. I recommend a phased rollout over two weeks.

Lisa: From a UX perspective, I've completed the mockups for the new dashboard. User testing showed a 40% improvement in task completion time. The feedback was very positive.

Sarah: Excellent. When can we start implementation?

Lisa: The designs are ready now. I just need to coordinate with Mike on the technical constraints.

Mike: Let's schedule a design-dev sync for Monday. I can start frontend work once the API is stable.

Tom: Marketing-wise, we should plan the announcement for October. I'll need at least two weeks lead time for the campaign materials.

Sarah: Perfect timing. Let's target October 1st for the public announcement. Mike, can we have a beta ready by September 20th?

Mike: Yes, that's achievable. I'll need Lisa's final designs by September 10th.

Lisa: No problem. I'll have everything ready by September 8th to give us buffer time.

Tom: I'll start working on the messaging and prepare the beta user communications.

Sarah: Great collaboration, everyone. Let's document these commitments and schedule weekly check-ins.`,
  
  metadata: {
    uploadedAt: '2025-08-17T10:30:00Z',
    originalName: 'Product Planning Q4.txt',
    fileSize: 1456,
    tokenCount: 364,
    sessionId: 'session-456'
  }
};

// Simulate instruction data from database
const mockInstructionData = {
  transcriptId: 'transcript-123',
  summaryStyle: 'action-items',
  customInstructions: 'Focus on deliverables and deadlines. Include dependencies between tasks. Use priority levels (High/Medium/Low) based on discussion urgency.',
  savedAt: '2025-08-17T10:35:00Z'
};

async function demonstratePromptIntegration() {
  console.log('🔗 Prompt Integration Example\n');
  console.log('Demonstrating integration between:');
  console.log('• Database transcript data');
  console.log('• Custom instruction system');
  console.log('• Prompt engineering logic');
  console.log('• Groq API preparation\n');

  const promptEngine = new PromptEngine();

  // Step 1: Load transcript and instructions (simulated from database)
  console.log('1️⃣ Loading data from database...');
  console.log(`   📄 Transcript: ${mockTranscriptData.metadata.originalName}`);
  console.log(`   📊 Size: ${mockTranscriptData.metadata.tokenCount} tokens`);
  console.log(`   🎯 Style: ${mockInstructionData.summaryStyle}`);
  console.log(`   ✏️ Custom instructions: ${mockInstructionData.customInstructions.length} characters\n`);

  // Step 2: Build prompt using the engine
  console.log('2️⃣ Building optimized prompt...');
  
  const promptData = promptEngine.buildSummaryPrompt(
    mockTranscriptData.content,
    {
      summaryStyle: mockInstructionData.summaryStyle,
      customInstructions: mockInstructionData.customInstructions,
      transcriptMetadata: {
        date: 'August 17, 2025',
        attendees: 'Sarah, Mike, Lisa, Tom',
        duration: '30 minutes',
        meetingType: 'Product Planning'
      }
    }
  );

  console.log(`   ✅ Prompt generated successfully`);
  console.log(`   📊 Total tokens: ${promptData.estimatedTokens}`);
  console.log(`   🎛️ Max output: ${promptData.maxTokens} tokens`);
  console.log(`   🌡️ Temperature: ${promptData.temperature}\n`);

  // Step 3: Validate prompt
  console.log('3️⃣ Validating prompt...');
  
  const validation = promptEngine.validatePrompt(promptData);
  console.log(`   ✅ Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
  console.log(`   📈 Context utilization: ${validation.tokenUtilization}`);
  
  if (validation.warnings.length > 0) {
    console.log(`   ⚠️ Warnings: ${validation.warnings.join(', ')}`);
  }
  
  if (validation.errors.length > 0) {
    console.log(`   ❌ Errors: ${validation.errors.join(', ')}`);
  }
  console.log('');

  // Step 4: Get detailed statistics
  console.log('4️⃣ Analyzing prompt statistics...');
  
  const stats = promptEngine.getPromptStats(promptData);
  console.log(`   📊 System prompt: ${stats.systemPromptTokens} tokens`);
  console.log(`   📄 User content: ${stats.userPromptTokens} tokens`);
  console.log(`   💰 Estimated cost: $${stats.estimatedCost.toFixed(6)}`);
  console.log(`   📈 Context utilization: ${stats.contextUtilization}`);
  console.log(`   📤 Output utilization: ${stats.outputUtilization}\n`);

  // Step 5: Show the actual prompt structure
  console.log('5️⃣ Prompt structure preview...');
  
  const systemPrompt = promptData.messages.find(m => m.role === 'system').content;
  const userPrompt = promptData.messages.find(m => m.role === 'user').content;
  
  console.log('   📋 System Prompt (first 200 chars):');
  console.log(`   "${systemPrompt.substring(0, 200)}..."\n`);
  
  console.log('   📄 User Prompt (first 200 chars):');
  console.log(`   "${userPrompt.substring(0, 200)}..."\n`);

  // Step 6: Demonstrate template usage
  console.log('6️⃣ Template system demonstration...');
  
  const templatePrompt = PromptTemplates.buildPromptFromTemplate('action-items', {
    meetingType: 'planning',
    length: 'standard'
  });
  
  console.log(`   📝 Template prompt generated: ${templatePrompt.length} characters`);
  console.log(`   🎯 Optimized for: Action items + Planning meeting + Standard length\n`);

  // Step 7: Show Groq API ready format
  console.log('7️⃣ Groq API ready format...');
  
  const groqApiCall = {
    model: "llama-3.3-70b-versatile",
    messages: promptData.messages,
    max_tokens: promptData.maxTokens,
    temperature: promptData.temperature,
    stream: false
  };
  
  console.log('   🚀 Ready for Groq API:');
  console.log(`   Model: ${groqApiCall.model}`);
  console.log(`   Messages: ${groqApiCall.messages.length} (system + user)`);
  console.log(`   Max tokens: ${groqApiCall.max_tokens}`);
  console.log(`   Temperature: ${groqApiCall.temperature}`);
  console.log(`   Streaming: ${groqApiCall.stream}\n`);

  // Step 8: Cost and performance analysis
  console.log('8️⃣ Cost and performance analysis...');
  
  const costBreakdown = {
    inputCost: (promptData.estimatedTokens / 1000) * 0.00059,
    outputCost: (promptData.maxTokens / 1000) * 0.00079,
    totalCost: stats.estimatedCost
  };
  
  console.log(`   💰 Input cost: $${costBreakdown.inputCost.toFixed(6)}`);
  console.log(`   💰 Output cost (max): $${costBreakdown.outputCost.toFixed(6)}`);
  console.log(`   💰 Total estimated: $${costBreakdown.totalCost.toFixed(6)}`);
  
  const processingTime = Math.ceil(promptData.estimatedTokens / 1000) * 2; // ~2 seconds per 1K tokens
  console.log(`   ⏱️ Estimated processing: ${processingTime} seconds\n`);

  // Step 9: Quality optimization suggestions
  console.log('9️⃣ Quality optimization suggestions...');
  
  const suggestions = [];
  
  if (promptData.estimatedTokens < 500) {
    suggestions.push('Consider adding more context for better summary quality');
  }
  
  if (promptData.estimatedTokens > 50000) {
    suggestions.push('Large transcript - consider chunking for better performance');
  }
  
  if (mockInstructionData.customInstructions.length < 50) {
    suggestions.push('More detailed custom instructions could improve output quality');
  }
  
  if (promptData.temperature > 0.2) {
    suggestions.push('Lower temperature recommended for factual meeting summaries');
  }
  
  if (suggestions.length > 0) {
    suggestions.forEach(suggestion => {
      console.log(`   💡 ${suggestion}`);
    });
  } else {
    console.log('   ✅ Prompt is well-optimized for quality and performance');
  }

  console.log('\n🎉 Prompt integration demonstration complete!');
  console.log('✅ System is ready for full Groq API integration');
  console.log('🔗 All components working together seamlessly');
}

// Run demonstration if executed directly
if (require.main === module) {
  demonstratePromptIntegration().catch(console.error);
}

module.exports = { demonstratePromptIntegration };
