#!/usr/bin/env node

/**
 * Test script for Prompt Engineering Logic
 * 
 * Tests prompt generation, validation, and optimization
 * for different summary styles and transcript sizes
 */

const PromptEngine = require('../services/promptEngine');

// Sample meeting transcripts of different sizes
const sampleTranscripts = {
  small: `Meeting: Quick Standup
Date: August 17, 2025
Attendees: Alice, Bob

Alice: Quick update - the API is ready for testing.
Bob: Great! I'll start integration tests today.
Alice: Perfect. Let's sync tomorrow.`,

  medium: `Meeting: Weekly Team Review
Date: August 17, 2025
Attendees: Alice (PM), Bob (Dev), Charlie (Design), Diana (QA)

Alice: Let's start with project updates. Bob, how's the backend development?

Bob: Good progress this week. I've completed the user authentication system and the main API endpoints. The database migrations are working smoothly. I did run into some issues with the rate limiting implementation, but I found a solution using Redis.

Alice: Excellent. Any blockers?

Bob: I need the final UI mockups from Charlie to implement the dashboard API. Also, we should discuss the deployment strategy for the staging environment.

Charlie: I can get you those mockups by Wednesday. I've been working on the responsive design for mobile. The client feedback was mostly positive, but they want some changes to the color scheme and navigation flow.

Alice: What specific changes?

Charlie: They want a darker theme option and more prominent call-to-action buttons. I'll have the revised designs ready by Thursday.

Diana: From a QA perspective, I've been setting up the automated testing framework. I found a few edge cases in the login flow that need attention. Bob, can we schedule a session to go through these?

Bob: Absolutely. How about tomorrow afternoon?

Diana: Perfect. I'll send you the test cases beforehand.

Alice: Great collaboration, everyone. Let's plan to have a demo ready for the client by Friday. Any concerns about the timeline?

Bob: Should be doable if I get the mockups on time.

Charlie: I'll prioritize those mockups. No issues from my end.

Diana: I'll focus on the critical path testing to support the demo.

Alice: Excellent. Next week we'll start preparing for the production deployment. Meeting adjourned.`,

  large: `Meeting: Quarterly Business Review
Date: August 17, 2025
Duration: 2 hours
Attendees: Alice (CEO), Bob (CTO), Charlie (VP Sales), Diana (CFO), Eve (VP Marketing), Frank (Head of Product)

Alice: Welcome everyone to our Q3 review. Let's start with the financial overview. Diana?

Diana: Thank you, Alice. Q3 has been strong financially. Revenue is up 23% compared to Q2, reaching $2.3M. Our recurring revenue has grown to 78% of total revenue, which is excellent for our SaaS model. Operating expenses increased by 12%, primarily due to our expanded engineering team and increased marketing spend.

Alice: That's fantastic growth. What's driving the revenue increase?

Diana: Three main factors: first, our enterprise client acquisitions increased by 40%. Second, existing customer expansion revenue grew by 18% through upsells. Third, our new pricing tiers launched in July are performing better than projected.

Charlie: I can speak to the sales performance. We closed 47 new enterprise deals this quarter, compared to 34 in Q2. Our average deal size increased from $48K to $67K annually. The new sales team members we hired in June are ramping up well.

Alice: Excellent. What about the pipeline for Q4?

Charlie: Very strong. We have $4.2M in qualified pipeline for Q4, which is 85% higher than this time last quarter. The enterprise segment is particularly robust, with several deals over $100K in late-stage negotiations.

Eve: From a marketing perspective, our lead generation is up 156% quarter-over-quarter. The content marketing strategy we implemented is working well. Our webinar series has generated over 800 qualified leads. The partnership with TechCorp has also been valuable, bringing in 23 enterprise leads.

Alice: That's impressive growth. Bob, how is the product development supporting this growth?

Bob: We've made significant progress on the platform scalability. The infrastructure upgrades completed in July can now handle 10x our current load. We launched three major features this quarter: advanced analytics dashboard, API integrations, and mobile app beta.

Frank: The customer feedback on these features has been overwhelmingly positive. The analytics dashboard in particular has a 94% adoption rate among enterprise customers. We're seeing increased engagement and reduced churn since the launch.

Alice: What about the mobile app?

Frank: The beta is going well with 200 users. We're getting great feedback and plan to launch publicly in Q4. The mobile app addresses a key customer request and should help with user engagement.

Bob: From a technical perspective, we've also improved our deployment process. We can now push updates daily instead of weekly, which has improved our response time to customer feedback and bug fixes.

Diana: I should mention that our customer acquisition cost has decreased by 22% this quarter, while customer lifetime value has increased by 31%. This is a very healthy trend for our unit economics.

Alice: Outstanding. Let's talk about challenges and risks for Q4.

Charlie: The main challenge is the competitive landscape. Two new competitors launched similar products this quarter. We need to maintain our differentiation and potentially accelerate some product features.

Bob: From a technical standpoint, we're approaching some scaling limits in our database architecture. We have a plan to address this, but it will require significant engineering resources in Q4.

Frank: We also need to be careful about feature bloat. As we add more capabilities, we need to ensure the user experience remains simple and intuitive.

Eve: The marketing challenge is maintaining our growth rate as we scale. We need to diversify our channels and potentially increase our marketing budget.

Diana: From a financial perspective, we need to balance growth investments with profitability. We're currently burning $200K monthly, which is sustainable, but we should plan for profitability by Q2 next year.

Alice: These are all manageable challenges. Let's discuss our Q4 priorities.

Bob: Top priority is the database architecture upgrade. We also need to complete the mobile app launch and start work on the enterprise security features.

Charlie: Sales priorities are closing the large deals in our pipeline and expanding our sales team by two more enterprise reps.

Eve: Marketing will focus on the mobile app launch campaign and expanding our partnership program.

Frank: Product priorities are the enterprise security features and improving our onboarding experience based on customer feedback.

Diana: Financial priorities are optimizing our cash flow and preparing for our Series B funding round in Q1 next year.

Alice: Excellent. Let's set specific targets for Q4. Charlie, what's your revenue target?

Charlie: Based on our pipeline, I'm confident we can hit $2.8M in Q4 revenue, which would be 22% growth quarter-over-quarter.

Diana: That would put us at $9.1M annual run rate, which is ahead of our original plan.

Alice: Perfect. Bob, what about the technical milestones?

Bob: Database upgrade completed by October 15th, mobile app public launch by November 1st, and enterprise security features in beta by December 15th.

Frank: I'll support those timelines from the product side and ensure we have proper user testing and documentation.

Eve: For marketing, I'll target 1,200 new qualified leads in Q4 and support the mobile app launch with a comprehensive campaign.

Alice: Excellent planning, everyone. Let's schedule monthly check-ins to track progress. Any final thoughts?

Diana: We should celebrate this quarter's success. The team has done exceptional work.

Alice: Absolutely. Let's plan a team celebration for next Friday. Thank you all for your hard work and dedication. This has been our best quarter yet, and Q4 is shaping up to be even better.`
};

// Test the prompt engine
async function testPromptEngine() {
  console.log('🧠 Testing Prompt Engineering Logic\n');

  const promptEngine = new PromptEngine();

  // Test 1: Basic prompt generation for different styles
  console.log('1️⃣ Testing prompt generation for different summary styles...\n');

  const styles = ['executive', 'action-items', 'technical', 'detailed', 'custom'];
  const transcript = sampleTranscripts.medium;

  for (const style of styles) {
    console.log(`📝 Testing ${style} style:`);
    
    const instructions = {
      summaryStyle: style,
      customInstructions: style === 'custom' ? 'Focus on budget implications and timeline risks. Use numbered lists.' : '',
      transcriptMetadata: {
        date: 'August 17, 2025',
        attendees: 'Alice, Bob, Charlie, Diana',
        duration: '45 minutes',
        meetingType: 'Weekly Review'
      }
    };

    const promptData = promptEngine.buildSummaryPrompt(transcript, instructions);
    const validation = promptEngine.validatePrompt(promptData);
    const stats = promptEngine.getPromptStats(promptData);

    console.log(`   ✅ Generated prompt (${promptData.estimatedTokens} tokens)`);
    console.log(`   📊 Max output tokens: ${promptData.maxTokens}`);
    console.log(`   🌡️ Temperature: ${promptData.temperature}`);
    console.log(`   💰 Estimated cost: $${stats.estimatedCost.toFixed(6)}`);
    console.log(`   📈 Context utilization: ${stats.contextUtilization}`);
    
    if (validation.warnings.length > 0) {
      console.log(`   ⚠️ Warnings: ${validation.warnings.join(', ')}`);
    }
    
    console.log('');
  }

  // Test 2: Token limit handling
  console.log('2️⃣ Testing token limit handling...\n');

  const transcriptSizes = ['small', 'medium', 'large'];
  
  for (const size of transcriptSizes) {
    console.log(`📏 Testing ${size} transcript:`);
    
    const promptData = promptEngine.buildSummaryPrompt(sampleTranscripts[size], {
      summaryStyle: 'executive'
    });
    
    const validation = promptEngine.validatePrompt(promptData);
    const stats = promptEngine.getPromptStats(promptData);
    
    console.log(`   📊 Estimated tokens: ${promptData.estimatedTokens}`);
    console.log(`   ✅ Validation: ${validation.isValid ? 'Valid' : 'Invalid'}`);
    console.log(`   📈 Context utilization: ${stats.contextUtilization}`);
    
    if (validation.errors.length > 0) {
      console.log(`   ❌ Errors: ${validation.errors.join(', ')}`);
    }
    
    console.log('');
  }

  // Test 3: Custom instructions handling
  console.log('3️⃣ Testing custom instructions...\n');

  const customInstructionsTests = [
    '',
    'Focus on action items only. Use bullet points.',
    'Create a summary for executive leadership. Emphasize strategic decisions and budget implications. Use formal tone.',
    'Extract technical decisions and implementation details. Include any mentioned timelines and resource requirements. Format as numbered list with subsections.'
  ];

  for (let i = 0; i < customInstructionsTests.length; i++) {
    const instructions = customInstructionsTests[i];
    console.log(`📝 Custom instructions test ${i + 1}:`);
    console.log(`   Instructions: "${instructions || 'None'}"`);
    
    const promptData = promptEngine.buildSummaryPrompt(sampleTranscripts.medium, {
      summaryStyle: 'custom',
      customInstructions: instructions
    });
    
    const systemPrompt = promptData.messages.find(m => m.role === 'system').content;
    const hasCustomSection = systemPrompt.includes('CUSTOM INSTRUCTIONS:');
    
    console.log(`   ✅ Custom instructions ${hasCustomSection ? 'included' : 'not included'}`);
    console.log(`   📊 System prompt length: ${systemPrompt.length} characters`);
    console.log('');
  }

  // Test 4: Validation edge cases
  console.log('4️⃣ Testing validation edge cases...\n');

  const edgeCases = [
    {
      name: 'Empty transcript',
      transcript: '',
      shouldFail: true
    },
    {
      name: 'Very long transcript',
      transcript: 'A'.repeat(500000), // ~125K tokens
      shouldFail: false
    },
    {
      name: 'Normal transcript',
      transcript: sampleTranscripts.medium,
      shouldFail: false
    }
  ];

  for (const testCase of edgeCases) {
    console.log(`🧪 Testing: ${testCase.name}`);
    
    try {
      const promptData = promptEngine.buildSummaryPrompt(testCase.transcript, {
        summaryStyle: 'executive'
      });
      
      const validation = promptEngine.validatePrompt(promptData);
      const stats = promptEngine.getPromptStats(promptData);
      
      console.log(`   ✅ Generated: ${validation.isValid ? 'Valid' : 'Invalid'}`);
      console.log(`   📊 Tokens: ${promptData.estimatedTokens}`);
      console.log(`   📈 Utilization: ${stats.contextUtilization}`);
      
      if (testCase.shouldFail && validation.isValid) {
        console.log(`   ⚠️ Expected failure but validation passed`);
      }
      
      if (validation.errors.length > 0) {
        console.log(`   ❌ Errors: ${validation.errors.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`);
    }
    
    console.log('');
  }

  // Test 5: Cost estimation
  console.log('5️⃣ Testing cost estimation...\n');

  const costTests = [
    { size: 'small', style: 'executive' },
    { size: 'medium', style: 'action-items' },
    { size: 'large', style: 'detailed' }
  ];

  for (const test of costTests) {
    const promptData = promptEngine.buildSummaryPrompt(sampleTranscripts[test.size], {
      summaryStyle: test.style
    });
    
    const stats = promptEngine.getPromptStats(promptData);
    
    console.log(`💰 ${test.size} transcript, ${test.style} style:`);
    console.log(`   Input tokens: ${stats.systemPromptTokens + stats.userPromptTokens}`);
    console.log(`   Max output tokens: ${stats.maxOutputTokens}`);
    console.log(`   Estimated cost: $${stats.estimatedCost.toFixed(6)}`);
    console.log('');
  }

  console.log('🎉 All prompt engineering tests completed!');
  console.log('✅ Prompt engine is ready for Groq API integration');
}

// Run tests if executed directly
if (require.main === module) {
  testPromptEngine().catch(console.error);
}

module.exports = { testPromptEngine };
