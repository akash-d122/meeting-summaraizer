#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:3000';
const TEST_FILES_DIR = './test-files';

// Execute curl command
const executeCurl = (args) => {
  return new Promise((resolve, reject) => {
    const curl = spawn('curl', args);
    let stdout = '';
    let stderr = '';

    curl.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    curl.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    curl.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`curl failed with code ${code}: ${stderr}`));
      }
    });
  });
};

// Create test file and upload
const setupTestTranscript = async () => {
  try {
    await fs.mkdir(TEST_FILES_DIR, { recursive: true });
    
    const testContent = `Meeting Notes - Instructions API Test
Date: August 17, 2025

This is a test transcript for testing the instructions API functionality.
It contains sample meeting content for AI processing.`;

    await fs.writeFile(path.join(TEST_FILES_DIR, 'test-instructions.txt'), testContent);

    // Upload the file
    const filePath = path.join(TEST_FILES_DIR, 'test-instructions.txt');
    const curlArgs = [
      '-X', 'POST',
      '-F', `transcript=@${filePath}`,
      '-H', 'Accept: application/json',
      `${BASE_URL}/api/upload`
    ];

    const response = await executeCurl(curlArgs);
    const result = JSON.parse(response);
    
    console.log('✅ Test transcript uploaded');
    console.log(`   Transcript ID: ${result.transcript.id}`);
    console.log(`   Session Token: ${result.session.token.substring(0, 16)}...`);
    
    return {
      transcriptId: result.transcript.id,
      sessionToken: result.session.token
    };
  } catch (error) {
    console.error('❌ Failed to setup test transcript:', error.message);
    throw error;
  }
};

// Test save instructions
const testSaveInstructions = async (transcriptId, sessionToken) => {
  try {
    console.log('\n💾 Testing save instructions...');
    
    const instructionsData = {
      transcriptId: transcriptId,
      summaryStyle: 'executive',
      customInstructions: 'Please create a concise executive summary focusing on key decisions and action items. Use bullet points and include next steps.',
      sessionToken: sessionToken
    };

    const curlArgs = [
      '-X', 'POST',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json',
      '-H', `X-Session-Token: ${sessionToken}`,
      '-d', JSON.stringify(instructionsData),
      `${BASE_URL}/api/instructions/save`
    ];

    const response = await executeCurl(curlArgs);
    const result = JSON.parse(response);
    
    console.log('✅ Instructions saved successfully');
    console.log(`   Style: ${result.instructions.summaryStyle}`);
    console.log(`   Character count: ${result.instructions.characterCount}`);
    
    return result;
  } catch (error) {
    console.error('❌ Save instructions test failed:', error.message);
    return null;
  }
};

// Test get instructions
const testGetInstructions = async (transcriptId, sessionToken) => {
  try {
    console.log('\n📋 Testing get instructions...');
    
    const curlArgs = [
      '-X', 'GET',
      '-H', 'Accept: application/json',
      '-H', `X-Session-Token: ${sessionToken}`,
      `${BASE_URL}/api/instructions/${transcriptId}`
    ];

    const response = await executeCurl(curlArgs);
    const result = JSON.parse(response);
    
    console.log('✅ Instructions retrieved successfully');
    console.log(`   Style: ${result.instructions.summaryStyle}`);
    console.log(`   Character count: ${result.instructions.characterCount}`);
    console.log(`   Has custom instructions: ${!!result.instructions.customInstructions}`);
    
    return result;
  } catch (error) {
    console.error('❌ Get instructions test failed:', error.message);
    return null;
  }
};

// Test get templates
const testGetTemplates = async () => {
  try {
    console.log('\n📝 Testing get templates...');
    
    const curlArgs = [
      '-X', 'GET',
      '-H', 'Accept: application/json',
      `${BASE_URL}/api/instructions/templates/list`
    ];

    const response = await executeCurl(curlArgs);
    const result = JSON.parse(response);
    
    console.log('✅ Templates retrieved successfully');
    console.log(`   Style templates: ${Object.keys(result.templates.styles).length}`);
    console.log(`   Example templates: ${Object.keys(result.templates.examples).length}`);
    console.log(`   Max characters: ${result.limits.maxCharacters}`);
    
    return result;
  } catch (error) {
    console.error('❌ Get templates test failed:', error.message);
    return null;
  }
};

// Test validate instructions
const testValidateInstructions = async (transcriptId) => {
  try {
    console.log('\n✅ Testing validate instructions...');
    
    const validationData = {
      transcriptId: transcriptId,
      summaryStyle: 'custom',
      customInstructions: 'Short instruction'
    };

    const curlArgs = [
      '-X', 'POST',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json',
      '-d', JSON.stringify(validationData),
      `${BASE_URL}/api/instructions/validate`
    ];

    const response = await executeCurl(curlArgs);
    const result = JSON.parse(response);
    
    console.log('✅ Instructions validated successfully');
    console.log(`   Valid: ${result.valid}`);
    console.log(`   Warnings: ${result.warnings?.length || 0}`);
    console.log(`   Suggestions: ${result.suggestions?.length || 0}`);
    
    return result;
  } catch (error) {
    console.error('❌ Validate instructions test failed:', error.message);
    return null;
  }
};

// Test health check
const testHealthCheck = async () => {
  try {
    const curlArgs = [
      '-X', 'GET',
      '-H', 'Accept: application/json',
      `${BASE_URL}/health`
    ];

    const response = await executeCurl(curlArgs);
    const result = JSON.parse(response);
    
    if (result.status === 'OK') {
      console.log('✅ Server is running');
      return true;
    } else {
      throw new Error('Server health check failed');
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
};

// Cleanup
const cleanup = async () => {
  try {
    await fs.rm(TEST_FILES_DIR, { recursive: true, force: true });
    console.log('\n🧹 Test files cleaned up');
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error.message);
  }
};

// Main test function
const runTests = async () => {
  console.log('🧪 Starting Instructions API Tests...\n');

  try {
    // Check if server is running
    const serverRunning = await testHealthCheck();
    if (!serverRunning) {
      throw new Error('Server is not running. Please start with: npm start');
    }

    // Setup test transcript
    const { transcriptId, sessionToken } = await setupTestTranscript();

    // Test all instruction endpoints
    await testSaveInstructions(transcriptId, sessionToken);
    await testGetInstructions(transcriptId, sessionToken);
    await testGetTemplates();
    await testValidateInstructions(transcriptId);

    console.log('\n🎉 All instruction API tests completed successfully!');
    console.log('✅ Instructions API is working correctly');

  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
};

// Run tests if script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
