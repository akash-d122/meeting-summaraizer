#!/usr/bin/env node

const { 
  validateGroqConfig, 
  testGroqConnection, 
  getAvailableModels,
  calculateCost 
} = require('../config/groq');

// Test Groq API credentials and configuration
const testGroqCredentials = async () => {
  console.log('🔑 Testing Groq API Credentials and Configuration (Modern SDK)...\n');

  try {
    // Step 1: Validate configuration
    console.log('1️⃣ Validating Groq configuration...');
    const validation = validateGroqConfig();

    console.log(`   Configuration status: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`   API Key: ${validation.config.apiKey}`);
    console.log(`   Primary Model: ${validation.config.primaryModel}`);
    console.log(`   Fallback Model: ${validation.config.fallbackModel}`);
    console.log(`   SDK Version: ${validation.config.sdkVersion}`);
    console.log(`   Timeout: ${validation.config.timeout}ms`);

    if (validation.errors.length > 0) {
      console.log('\n❌ Configuration Errors:');
      validation.errors.forEach(error => console.log(`   • ${error}`));
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️ Configuration Warnings:');
      validation.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    if (!validation.isValid) {
      console.log('\n💡 To fix configuration issues:');
      console.log('   1. Get your API key from: https://console.groq.com/keys');
      console.log('   2. Copy .env.meeting-summarizer to .env');
      console.log('   3. Replace "your_groq_api_key_here" with your actual API key');
      console.log('   4. Restart the application');
      return false;
    }

    // Step 2: Test API connection
    console.log('\n2️⃣ Testing API connection...');
    const connectionTest = await testGroqConnection();
    
    if (connectionTest.success) {
      console.log('   ✅ API connection successful (modern SDK)');
      console.log(`   📝 Response: "${connectionTest.response}"`);
      console.log(`   🤖 Model: ${connectionTest.model}`);
      console.log(`   🆔 Request ID: ${connectionTest.id}`);

      if (connectionTest.usage) {
        console.log(`   🔢 Token usage:`);
        console.log(`      • Input tokens: ${connectionTest.usage.prompt_tokens}`);
        console.log(`      • Output tokens: ${connectionTest.usage.completion_tokens}`);
        console.log(`      • Total tokens: ${connectionTest.usage.total_tokens}`);

        const cost = calculateCost(connectionTest.usage, 'primary');
        console.log(`      • Estimated cost: $${cost.toFixed(6)}`);
      }
    } else {
      console.log('   ❌ API connection failed');
      console.log(`   Error: ${connectionTest.error}`);

      if (connectionTest.status) {
        console.log(`   HTTP Status: ${connectionTest.status}`);
      }

      if (connectionTest.details) {
        console.log(`   Details: ${JSON.stringify(connectionTest.details, null, 2)}`);
      }

      return false;
    }

    // Step 3: Display model information
    console.log('\n3️⃣ Available models information...');
    const models = getAvailableModels();
    
    Object.entries(models).forEach(([type, model]) => {
      console.log(`   ${type.toUpperCase()} Model: ${model.name}`);
      console.log(`      • Context window: ${model.contextWindow.toLocaleString()} tokens`);
      console.log(`      • Max output: ${model.maxTokens.toLocaleString()} tokens`);
      console.log(`      • Temperature: ${model.temperature}`);
      console.log(`      • Input cost: $${model.costPer1KTokens.input}/1K tokens`);
      console.log(`      • Output cost: $${model.costPer1KTokens.output}/1K tokens`);
    });

    // Step 4: Cost estimation examples
    console.log('\n4️⃣ Cost estimation examples...');
    const exampleUsages = [
      { prompt_tokens: 1000, completion_tokens: 500, description: 'Small meeting (1K input, 500 output)' },
      { prompt_tokens: 5000, completion_tokens: 1000, description: 'Medium meeting (5K input, 1K output)' },
      { prompt_tokens: 20000, completion_tokens: 2000, description: 'Large meeting (20K input, 2K output)' }
    ];

    exampleUsages.forEach(usage => {
      const primaryCost = calculateCost(usage, 'primary');
      const fallbackCost = calculateCost(usage, 'fallback');
      console.log(`   ${usage.description}:`);
      console.log(`      • Primary model cost: $${primaryCost.toFixed(6)}`);
      console.log(`      • Fallback model cost: $${fallbackCost.toFixed(6)}`);
    });

    console.log('\n🎉 All Groq API credential tests passed!');
    console.log('✅ Your Groq integration is ready for use');
    
    return true;

  } catch (error) {
    console.error('\n💥 Groq credential test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
};

// Environment setup guide
const showSetupGuide = () => {
  console.log('\n📋 Groq API Setup Guide:');
  console.log('');
  console.log('1. 🌐 Visit https://console.groq.com/keys');
  console.log('2. 📝 Sign up or log in to your Groq account');
  console.log('3. 🔑 Create a new API key');
  console.log('4. 📄 Copy .env.meeting-summarizer to .env');
  console.log('5. ✏️ Replace "your_groq_api_key_here" with your actual API key');
  console.log('6. 🚀 Run this test again: npm run test:groq');
  console.log('');
  console.log('💡 Your API key should start with "gsk_" and be about 56 characters long');
  console.log('');
};

// Main execution
const main = async () => {
  const success = await testGroqCredentials();
  
  if (!success) {
    showSetupGuide();
    process.exit(1);
  }
  
  console.log('\n🏁 Groq credentials test completed successfully!');
  process.exit(0);
};

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { testGroqCredentials, showSetupGuide };
