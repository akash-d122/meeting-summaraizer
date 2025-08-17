#!/usr/bin/env node

const { initializeDatabase, sequelize } = require('../models');
const { testConnection } = require('../config/database');

async function initDatabase() {
  console.log('🚀 Starting database initialization...');
  
  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('❌ Database connection failed. Please check your configuration.');
      process.exit(1);
    }

    // Initialize database (sync models)
    console.log('🔄 Synchronizing database models...');
    const initialized = await initializeDatabase();
    
    if (!initialized) {
      console.error('❌ Database initialization failed.');
      process.exit(1);
    }

    // Create some sample data for testing (optional)
    if (process.argv.includes('--with-sample-data')) {
      console.log('📝 Creating sample data...');
      await createSampleData();
    }

    console.log('✅ Database initialization completed successfully!');
    console.log('');
    console.log('📊 Database is ready for use.');
    console.log('🔗 You can now start the application with: npm start');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    await sequelize.close();
  }
}

async function createSampleData() {
  const { UserSession, MeetingTranscript, Summary, EmailRecord } = require('../models');
  
  try {
    // Create a sample user session
    const session = await UserSession.create({
      sessionToken: 'sample-session-token-' + Date.now(),
      ipAddress: '127.0.0.1',
      userAgent: 'Sample User Agent',
      workflowState: 'completed',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      preferences: {
        defaultSummaryStyle: 'executive',
        emailFormat: 'html',
        autoSave: true
      },
      statistics: {
        transcriptsProcessed: 1,
        summariesGenerated: 1,
        emailsSent: 1,
        totalCost: 0.05
      }
    });

    // Create a sample meeting transcript
    const transcript = await MeetingTranscript.create({
      filename: 'sample-meeting-transcript.txt',
      originalName: 'Weekly Team Meeting - 2025-08-17.txt',
      filePath: '/uploads/sample-meeting-transcript.txt',
      fileSize: 2048,
      mimeType: 'text/plain',
      content: 'This is a sample meeting transcript content for testing purposes. The meeting covered project updates, budget discussions, and next steps for the quarter.',
      contentLength: 150,
      tokenCount: 45,
      status: 'processed',
      sessionId: session.id,
      metadata: {
        uploadedBy: 'sample-user',
        meetingDate: '2025-08-17',
        participants: ['Alice', 'Bob', 'Charlie']
      }
    });

    // Create a sample summary
    const summary = await Summary.create({
      transcriptId: transcript.id,
      content: '## Executive Summary\n\n• Project updates were discussed\n• Budget allocation reviewed\n• Q4 planning initiated\n\n## Key Decisions\n\n• Approved budget increase for development\n• Scheduled follow-up meeting for next week',
      summaryStyle: 'executive',
      aiModel: 'llama-3.3-70b-versatile',
      processingTime: 5000,
      tokenUsage: {
        inputTokens: 45,
        outputTokens: 85,
        totalTokens: 130
      },
      cost: 0.05,
      status: 'completed',
      quality: 4,
      metadata: {
        generatedAt: new Date(),
        version: '1.0'
      }
    });

    // Create a sample email record
    await EmailRecord.create({
      summaryId: summary.id,
      recipients: ['team@example.com', 'manager@example.com'],
      subject: 'Meeting Summary - Weekly Team Meeting - 2025-08-17',
      content: summary.content,
      emailFormat: 'html',
      status: 'sent',
      emailService: 'sendgrid',
      serviceMessageId: 'sample-message-id-123',
      sentAt: new Date(),
      deliveryStatus: {
        delivered: 2,
        failed: 0
      },
      metadata: {
        sentBy: 'system',
        template: 'default'
      }
    });

    console.log('✅ Sample data created successfully');
    console.log(`   - Session ID: ${session.id}`);
    console.log(`   - Transcript ID: ${transcript.id}`);
    console.log(`   - Summary ID: ${summary.id}`);
    
  } catch (error) {
    console.error('❌ Failed to create sample data:', error.message);
    throw error;
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase, createSampleData };
