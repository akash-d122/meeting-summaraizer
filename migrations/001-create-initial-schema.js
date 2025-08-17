const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create UserSessions table first (referenced by other tables)
    await queryInterface.createTable('user_sessions', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      sessionToken: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      ipAddress: {
        type: DataTypes.INET,
        allowNull: true
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      sessionData: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      lastActivity: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      workflowState: {
        type: DataTypes.ENUM('upload', 'instructions', 'processing', 'summary', 'email', 'completed'),
        defaultValue: 'upload',
        allowNull: false
      },
      currentTranscriptId: {
        type: DataTypes.UUID,
        allowNull: true
      },
      currentSummaryId: {
        type: DataTypes.UUID,
        allowNull: true
      },
      preferences: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          defaultSummaryStyle: 'executive',
          emailFormat: 'html',
          autoSave: true
        }
      },
      statistics: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          transcriptsProcessed: 0,
          summariesGenerated: 0,
          emailsSent: 0,
          totalCost: 0
        }
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Create MeetingTranscripts table
    await queryInterface.createTable('meeting_transcripts', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      filename: {
        type: DataTypes.STRING,
        allowNull: false
      },
      originalName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      filePath: {
        type: DataTypes.STRING,
        allowNull: false
      },
      fileSize: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      mimeType: {
        type: DataTypes.STRING,
        allowNull: true
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      contentLength: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      tokenCount: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('uploaded', 'processing', 'processed', 'error'),
        defaultValue: 'uploaded',
        allowNull: false
      },
      processingError: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      sessionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'user_sessions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Create Summaries table
    await queryInterface.createTable('summaries', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      transcriptId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'meeting_transcripts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      summaryStyle: {
        type: DataTypes.ENUM('executive', 'action-items', 'technical', 'detailed', 'custom'),
        allowNull: false,
        defaultValue: 'executive'
      },
      customInstructions: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      aiModel: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'llama-3.3-70b-versatile'
      },
      processingTime: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      tokenUsage: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        }
      },
      cost: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('generating', 'completed', 'error', 'edited'),
        defaultValue: 'generating',
        allowNull: false
      },
      generationError: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      editHistory: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: []
      },
      quality: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Create EmailRecords table
    await queryInterface.createTable('email_records', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      summaryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'summaries',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      recipients: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      emailFormat: {
        type: DataTypes.ENUM('html', 'text', 'both'),
        defaultValue: 'html',
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('pending', 'sending', 'sent', 'failed', 'partially_sent'),
        defaultValue: 'pending',
        allowNull: false
      },
      emailService: {
        type: DataTypes.ENUM('sendgrid', 'aws-ses', 'mailgun', 'nodemailer'),
        allowNull: false
      },
      serviceMessageId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      deliveryStatus: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      failureReason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      retryCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('user_sessions', ['sessionToken'], { unique: true });
    await queryInterface.addIndex('user_sessions', ['isActive']);
    await queryInterface.addIndex('user_sessions', ['lastActivity']);
    await queryInterface.addIndex('user_sessions', ['expiresAt']);
    await queryInterface.addIndex('user_sessions', ['workflowState']);

    await queryInterface.addIndex('meeting_transcripts', ['status']);
    await queryInterface.addIndex('meeting_transcripts', ['sessionId']);
    await queryInterface.addIndex('meeting_transcripts', ['createdAt']);

    await queryInterface.addIndex('summaries', ['transcriptId']);
    await queryInterface.addIndex('summaries', ['status']);
    await queryInterface.addIndex('summaries', ['summaryStyle']);
    await queryInterface.addIndex('summaries', ['createdAt']);

    await queryInterface.addIndex('email_records', ['summaryId']);
    await queryInterface.addIndex('email_records', ['status']);
    await queryInterface.addIndex('email_records', ['emailService']);
    await queryInterface.addIndex('email_records', ['sentAt']);
    await queryInterface.addIndex('email_records', ['createdAt']);

    console.log('✅ Database schema created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order due to foreign key constraints
    await queryInterface.dropTable('email_records');
    await queryInterface.dropTable('summaries');
    await queryInterface.dropTable('meeting_transcripts');
    await queryInterface.dropTable('user_sessions');

    console.log('✅ Database schema dropped successfully');
  }
};
