#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3000';
const TEST_FILES_DIR = './test-files';

// Create test files
const createTestFiles = async () => {
  try {
    await fs.mkdir(TEST_FILES_DIR, { recursive: true });

    // Create valid test files
    const validFiles = {
      'sample-meeting.txt': `Meeting Notes - Weekly Team Standup
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

Next Meeting: August 24, 2025`,

      'project-notes.md': `# Project Meeting Summary

## Overview
This meeting covered the quarterly review and planning for Q4.

## Key Points
- Revenue targets exceeded by 15%
- Team expansion approved for development
- New product features prioritized

## Decisions Made
1. Hire 2 additional developers
2. Implement new feature set by December
3. Increase marketing budget by 20%

## Action Items
- [ ] Post job listings (HR)
- [ ] Create feature specifications (Product)
- [ ] Update budget allocations (Finance)`,

      'large-transcript.txt': 'A'.repeat(1024 * 1024), // 1MB file
      'invalid-file.pdf': 'This is not a valid PDF but has PDF extension',
      'oversized-file.txt': 'X'.repeat(11 * 1024 * 1024) // 11MB file (over limit)
    };

    for (const [filename, content] of Object.entries(validFiles)) {
      await fs.writeFile(path.join(TEST_FILES_DIR, filename), content);
    }

    console.log('✅ Test files created successfully');
  } catch (error) {
    console.error('❌ Failed to create test files:', error);
    throw error;
  }
};

// Test file upload
const testFileUpload = async (filename, expectedStatus = 201) => {
  try {
    const filePath = path.join(TEST_FILES_DIR, filename);
    const fileBuffer = await fs.readFile(filePath);
    
    const formData = new FormData();
    formData.append('transcript', fileBuffer, filename);

    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    console.log(`📁 Testing ${filename}:`);
    console.log(`   Status: ${response.status} (expected: ${expectedStatus})`);
    
    if (response.status === expectedStatus) {
      console.log('   ✅ Status matches expectation');
      if (response.status === 201) {
        console.log(`   📄 Transcript ID: ${result.transcript?.id}`);
        console.log(`   🔗 Session Token: ${result.session?.token?.substring(0, 16)}...`);
        return result;
      }
    } else {
      console.log('   ❌ Status mismatch');
      console.log(`   Error: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Upload test failed for ${filename}:`, error.message);
    return null;
  }
};

// Test API endpoints
const testApiEndpoints = async (transcriptId, sessionToken) => {
  try {
    console.log('\n🔍 Testing API endpoints...');

    // Test get transcript
    console.log('1️⃣ Testing GET /api/upload/:id');
    const getResponse = await fetch(`${BASE_URL}/api/upload/${transcriptId}`);
    const getResult = await getResponse.json();
    console.log(`   Status: ${getResponse.status}`);
    console.log(`   Filename: ${getResult.transcript?.filename}`);

    // Test get content
    console.log('2️⃣ Testing GET /api/upload/:id/content');
    const contentResponse = await fetch(`${BASE_URL}/api/upload/${transcriptId}/content`);
    const contentResult = await contentResponse.json();
    console.log(`   Status: ${contentResponse.status}`);
    console.log(`   Content length: ${contentResult.contentLength}`);

    // Test list transcripts
    console.log('3️⃣ Testing GET /api/upload/session/:token');
    const listResponse = await fetch(`${BASE_URL}/api/upload/session/${sessionToken}`);
    const listResult = await listResponse.json();
    console.log(`   Status: ${listResponse.status}`);
    console.log(`   Transcripts count: ${listResult.transcripts?.length}`);

    return { transcriptId, sessionToken };
  } catch (error) {
    console.error('❌ API endpoint tests failed:', error.message);
    return null;
  }
};

// Test error handling
const testErrorHandling = async () => {
  try {
    console.log('\n🚨 Testing error handling...');

    // Test invalid file type
    console.log('1️⃣ Testing invalid file type (.pdf)');
    await testFileUpload('invalid-file.pdf', 400);

    // Test oversized file
    console.log('2️⃣ Testing oversized file (11MB)');
    await testFileUpload('oversized-file.txt', 400);

    // Test missing file
    console.log('3️⃣ Testing missing file');
    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: new FormData()
    });
    console.log(`   Status: ${response.status} (expected: 400)`);

    // Test invalid transcript ID
    console.log('4️⃣ Testing invalid transcript ID');
    const invalidResponse = await fetch(`${BASE_URL}/api/upload/invalid-id`);
    console.log(`   Status: ${invalidResponse.status} (expected: 404)`);

  } catch (error) {
    console.error('❌ Error handling tests failed:', error.message);
  }
};

// Cleanup test files
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
  console.log('🧪 Starting File Upload API Tests...\n');

  try {
    // Check if server is running
    const healthResponse = await fetch(`${BASE_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error('Server is not running. Please start with: npm start');
    }
    console.log('✅ Server is running\n');

    // Create test files
    await createTestFiles();

    // Test valid uploads
    console.log('📤 Testing valid file uploads...');
    const result1 = await testFileUpload('sample-meeting.txt');
    const result2 = await testFileUpload('project-notes.md');
    const result3 = await testFileUpload('large-transcript.txt');

    if (result1 && result1.transcript) {
      // Test API endpoints
      await testApiEndpoints(result1.transcript.id, result1.session.token);
    }

    // Test error handling
    await testErrorHandling();

    console.log('\n🎉 All tests completed!');
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

module.exports = { runTests, testFileUpload, testApiEndpoints };
