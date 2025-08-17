const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Import all models
const MeetingTranscript = require('./MeetingTranscript')(sequelize, DataTypes);
const Summary = require('./Summary')(sequelize, DataTypes);
const EmailRecord = require('./EmailRecord')(sequelize, DataTypes);
const UserSession = require('./UserSession')(sequelize, DataTypes);

// Define associations (will be set up after sync)
const defineAssociations = () => {
  // MeetingTranscript has many Summaries
  MeetingTranscript.hasMany(Summary, {
    foreignKey: 'transcriptId',
    as: 'summaries'
  });

  Summary.belongsTo(MeetingTranscript, {
    foreignKey: 'transcriptId',
    as: 'transcript'
  });

  // Summary has many EmailRecords
  Summary.hasMany(EmailRecord, {
    foreignKey: 'summaryId',
    as: 'emailRecords'
  });

  EmailRecord.belongsTo(Summary, {
    foreignKey: 'summaryId',
    as: 'summary'
  });

  // UserSession can be associated with MeetingTranscripts (optional)
  UserSession.hasMany(MeetingTranscript, {
    foreignKey: 'sessionId',
    as: 'transcripts'
  });

  MeetingTranscript.belongsTo(UserSession, {
    foreignKey: 'sessionId',
    as: 'session'
  });
};

// Don't initialize associations immediately - do it after sync

// Database synchronization
const syncDatabase = async (options = {}) => {
  try {
    // Force sync for development to ensure clean schema
    const syncOptions = process.env.NODE_ENV === 'development'
      ? { force: true, ...options }
      : options;

    await sequelize.sync(syncOptions);
    console.log('✅ Database synchronized successfully.');
    return true;
  } catch (error) {
    console.error('❌ Database synchronization failed:', error.message);
    return false;
  }
};

// Database initialization
const initializeDatabase = async () => {
  try {
    const { testConnection } = require('../config/database');
    
    // Test connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Sync models
    const synced = await syncDatabase({ force: true });
    if (!synced) {
      throw new Error('Database synchronization failed');
    }

    // Set up associations after sync
    defineAssociations();

    console.log('🚀 Database initialized successfully.');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return false;
  }
};

module.exports = {
  sequelize,
  MeetingTranscript,
  Summary,
  EmailRecord,
  UserSession,
  syncDatabase,
  initializeDatabase
};
