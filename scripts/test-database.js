#!/usr/bin/env node

const {
  MeetingTranscript,
  Summary,
  EmailRecord,
  UserSession,
  sequelize,
  initializeDatabase
} = require('../models');

async function testDatabase() {
  console.log('🧪 Testing database models and operations...');

  try {
    // Initialize database first
    await initializeDatabase();
    // Test 1: Create a user session
    console.log('1️⃣ Testing UserSession model...');
    const session = await UserSession.create({
      sessionToken: 'test-session-token-' + Date.now() + '-abcdef123456',
      ipAddress: '127.0.0.1',
      userAgent: 'Test User Agent',
      workflowState: 'upload',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    });
    console.log(`   ✅ Created session: ${session.id}`);

    // Test 2: Create a meeting transcript
    console.log('2️⃣ Testing MeetingTranscript model...');
    const transcript = await MeetingTranscript.create({
      filename: 'test-transcript.txt',
      originalName: 'Test Meeting Transcript.txt',
      filePath: '/uploads/test-transcript.txt',
      fileSize: 1024,
      mimeType: 'text/plain',
      content: 'This is a test meeting transcript for database testing.',
      contentLength: 55,
      tokenCount: 15,
      status: 'processed',
      sessionId: session.id
    });
    console.log(`   ✅ Created transcript: ${transcript.id}`);

    // Test 3: Create a summary
    console.log('3️⃣ Testing Summary model...');
    const summary = await Summary.create({
      transcriptId: transcript.id,
      content: '## Test Summary\n\nThis is a test summary for database testing.',
      summaryStyle: 'executive',
      aiModel: 'llama-3.3-70b-versatile',
      processingTime: 3000,
      tokenUsage: {
        inputTokens: 15,
        outputTokens: 25,
        totalTokens: 40
      },
      cost: 0.02,
      status: 'completed'
    });
    console.log(`   ✅ Created summary: ${summary.id}`);

    // Test 4: Create an email record
    console.log('4️⃣ Testing EmailRecord model...');
    const emailRecord = await EmailRecord.create({
      summaryId: summary.id,
      recipients: ['test@example.com'],
      subject: 'Test Meeting Summary',
      content: summary.content,
      emailFormat: 'html',
      status: 'sent',
      emailService: 'sendgrid',
      serviceMessageId: 'test-message-123'
    });
    console.log(`   ✅ Created email record: ${emailRecord.id}`);

    // Test 5: Test associations
    console.log('5️⃣ Testing model associations...');
    
    // Get transcript with summaries
    const transcriptWithSummaries = await MeetingTranscript.findByPk(transcript.id, {
      include: ['summaries']
    });
    console.log(`   ✅ Transcript has ${transcriptWithSummaries.summaries.length} summaries`);

    // Get summary with email records
    const summaryWithEmails = await Summary.findByPk(summary.id, {
      include: ['emailRecords']
    });
    console.log(`   ✅ Summary has ${summaryWithEmails.emailRecords.length} email records`);

    // Get session with transcripts
    const sessionWithTranscripts = await UserSession.findByPk(session.id, {
      include: ['transcripts']
    });
    console.log(`   ✅ Session has ${sessionWithTranscripts.transcripts.length} transcripts`);

    // Test 6: Test model methods
    console.log('6️⃣ Testing model methods...');
    
    // Update transcript status
    await transcript.updateStatus('processed');
    console.log('   ✅ Updated transcript status');

    // Update summary content
    await summary.updateContent('Updated test summary content');
    console.log('   ✅ Updated summary content');

    // Mark email as delivered
    await emailRecord.markDelivered({ deliveredAt: new Date() });
    console.log('   ✅ Marked email as delivered');

    // Update session statistics
    await session.incrementStat('transcriptsProcessed', 1);
    console.log('   ✅ Updated session statistics');

    // Test 7: Test queries
    console.log('7️⃣ Testing query methods...');
    
    const pendingTranscripts = await MeetingTranscript.findByStatus('processed');
    console.log(`   ✅ Found ${pendingTranscripts.length} processed transcripts`);

    const completedSummaries = await Summary.findByStatus('edited');
    console.log(`   ✅ Found ${completedSummaries.length} edited summaries`);

    const sentEmails = await EmailRecord.findByStatus('sent');
    console.log(`   ✅ Found ${sentEmails.length} sent emails`);

    // Test 8: Cleanup test data
    console.log('8️⃣ Cleaning up test data...');
    await emailRecord.destroy();
    await summary.destroy();
    await transcript.destroy();
    await session.destroy();
    console.log('   ✅ Test data cleaned up');

    console.log('');
    console.log('🎉 All database tests passed successfully!');
    console.log('✅ Database schema is working correctly');
    console.log('✅ All models and associations are functional');
    console.log('✅ CRUD operations are working');
    console.log('✅ Custom methods are working');

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    // Close database connection
    await sequelize.close();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testDatabase()
    .then(() => {
      console.log('🏁 Database test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testDatabase };
