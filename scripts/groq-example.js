#!/usr/bin/env node

/**
 * Modern Groq SDK Example
 * 
 * This script demonstrates the official groq-sdk usage pattern
 * as documented at: https://console.groq.com/docs
 */

const Groq = require('groq-sdk');
require('dotenv').config();

// Initialize Groq client (modern approach)
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function basicExample() {
  console.log('🚀 Basic Groq SDK Example\n');
  
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: "Explain why fast inference is critical for reasoning models",
        },
      ],
    });
    
    console.log('✅ Response received:');
    console.log(completion.choices[0]?.message?.content);
    console.log('\n📊 Usage stats:');
    console.log(`   • Model: ${completion.model}`);
    console.log(`   • Input tokens: ${completion.usage?.prompt_tokens}`);
    console.log(`   • Output tokens: ${completion.usage?.completion_tokens}`);
    console.log(`   • Total tokens: ${completion.usage?.total_tokens}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.status) {
      console.error(`   HTTP Status: ${error.status}`);
    }
  }
}

async function meetingSummaryExample() {
  console.log('\n📝 Meeting Summary Example\n');
  
  const sampleTranscript = `
Meeting: Weekly Team Standup
Date: August 17, 2025
Attendees: Alice (PM), Bob (Dev), Charlie (Design)

Alice: Let's start with updates. Bob, how's the API development going?

Bob: Good progress on the authentication system. I've completed the user login and registration endpoints. Still working on the password reset functionality. Should be done by Friday.

Alice: Great. Any blockers?

Bob: Need the email templates from Charlie for the password reset emails.

Charlie: I can get those to you by Wednesday. I've been working on the new dashboard mockups. The client feedback was mostly positive, but they want some changes to the navigation.

Alice: What kind of changes?

Charlie: They want the main menu to be more prominent and add a search function. I'll have the revised mockups ready by Thursday.

Alice: Perfect. Let's plan to review those in Friday's meeting. Any other updates?

Bob: The database migration went smoothly yesterday. No issues to report.

Alice: Excellent. Next week we'll focus on the integration testing. Meeting adjourned.
  `;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Please create a concise meeting summary with action items from this transcript:

${sampleTranscript}

Format as:
## Meeting Summary
[Brief overview]

## Key Updates
[Main discussion points]

## Action Items
[Tasks with owners and deadlines]`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });
    
    console.log('✅ Meeting summary generated:');
    console.log(completion.choices[0]?.message?.content);
    console.log('\n📊 Usage stats:');
    console.log(`   • Model: ${completion.model}`);
    console.log(`   • Input tokens: ${completion.usage?.prompt_tokens}`);
    console.log(`   • Output tokens: ${completion.usage?.completion_tokens}`);
    console.log(`   • Total tokens: ${completion.usage?.total_tokens}`);
    
    // Calculate cost
    const inputCost = (completion.usage?.prompt_tokens / 1000) * 0.00059;
    const outputCost = (completion.usage?.completion_tokens / 1000) * 0.00079;
    const totalCost = inputCost + outputCost;
    console.log(`   • Estimated cost: $${totalCost.toFixed(6)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.status) {
      console.error(`   HTTP Status: ${error.status}`);
    }
  }
}

async function streamingExample() {
  console.log('\n🌊 Streaming Example\n');
  
  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: "Write a brief explanation of how AI can help with meeting summaries. Keep it under 100 words.",
        },
      ],
      stream: true,
      max_tokens: 150
    });
    
    console.log('✅ Streaming response:');
    process.stdout.write('   ');
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      process.stdout.write(content);
    }
    
    console.log('\n\n📊 Streaming completed successfully');
    
  } catch (error) {
    console.error('❌ Streaming error:', error.message);
  }
}

async function main() {
  // Check if API key is configured
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
    console.error('❌ Please set GROQ_API_KEY in your .env file');
    console.log('💡 Get your API key from: https://console.groq.com/keys');
    process.exit(1);
  }
  
  console.log('🔑 Modern Groq SDK Examples\n');
  console.log('Using official groq-sdk patterns from https://console.groq.com/docs\n');
  
  // Run examples
  await basicExample();
  await meetingSummaryExample();
  await streamingExample();
  
  console.log('\n🎉 All examples completed successfully!');
  console.log('✅ Your Groq integration is working with the modern SDK');
}

// Run examples
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { basicExample, meetingSummaryExample, streamingExample };
