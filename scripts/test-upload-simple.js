#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:3000';
const TEST_FILES_DIR = './test-files';

// Create test files
const createTestFiles = async () => {
  try {
    await fs.mkdir(TEST_FILES_DIR, { recursive: true });

    const testContent = `Meeting Notes - Weekly Team Standup
Date: August 17, 2025
Attendees: Alice, Bob, Charlie, Diana

Agenda:
1. Project Updates
2. Budget Review
3. Next Steps

Discussion:
- Alice reported 80% completion on the frontend redesign
- Bob mentioned database optimization is complete
- Charlie raised concerns about the deployment timeline
- Diana suggested additional testing phases

Action Items:
- Alice: Complete frontend by Friday
- Bob: Prepare deployment scripts
- Charlie: Update project timeline
- Diana: Schedule testing sessions

Next Meeting: August 24, 2025`;

    await fs.writeFile(path.join(TEST_FILES_DIR, 'sample-meeting.txt'), testContent);
    console.log('✅ Test file created: sample-meeting.txt');
  } catch (error) {
    console.error('❌ Failed to create test files:', error);
    throw error;
  }
};

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

// Test file upload
const testFileUpload = async () => {
  try {
    console.log('📤 Testing file upload...');
    
    const filePath = path.join(TEST_FILES_DIR, 'sample-meeting.txt');
    const curlArgs = [
      '-X', 'POST',
      '-F', `transcript=@${filePath}`,
      '-H', 'Accept: application/json',
      `${BASE_URL}/api/upload`
    ];

    const response = await executeCurl(curlArgs);
    const result = JSON.parse(response);
    
    console.log('✅ Upload successful!');
    console.log(`   Transcript ID: ${result.transcript.id}`);
    console.log(`   Session Token: ${result.session.token.substring(0, 16)}...`);
    console.log(`   Status: ${result.transcript.status}`);
    console.log(`   Content Length: ${result.transcript.contentLength}`);
    
    return result;
  } catch (error) {
    console.error('❌ Upload test failed:', error.message);
    return null;
  }
};

// Test get transcript
const testGetTranscript = async (transcriptId) => {
  try {
    console.log('📋 Testing get transcript...');
    
    const curlArgs = [
      '-X', 'GET',
      '-H', 'Accept: application/json',
      `${BASE_URL}/api/upload/${transcriptId}`
    ];

    const response = await executeCurl(curlArgs);
    const result = JSON.parse(response);
    
    console.log('✅ Get transcript successful!');
    console.log(`   Filename: ${result.transcript.filename}`);
    console.log(`   Status: ${result.transcript.status}`);
    
    return result;
  } catch (error) {
    console.error('❌ Get transcript test failed:', error.message);
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
    console.log('🧹 Test files cleaned up');
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error.message);
  }
};

// Main test function
const runTests = async () => {
  console.log('🧪 Starting Simple Upload API Tests...\n');

  try {
    // Check if server is running
    const serverRunning = await testHealthCheck();
    if (!serverRunning) {
      throw new Error('Server is not running. Please start with: npm start');
    }

    // Create test files
    await createTestFiles();

    // Test upload
    const uploadResult = await testFileUpload();
    if (!uploadResult) {
      throw new Error('Upload test failed');
    }

    // Test get transcript
    await testGetTranscript(uploadResult.transcript.id);

    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ File upload API is working correctly');

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
