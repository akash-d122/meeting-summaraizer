module.exports = (sequelize, DataTypes) => {
  const MeetingTranscript = sequelize.define('MeetingTranscript', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    originalName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10485760 // 10MB in bytes
      }
    },
    mimeType: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['text/plain', 'text/markdown', 'application/msword', 
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document']]
      }
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true // Will be populated after file processing
    },
    contentLength: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0
      }
    },
    tokenCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        max: 131072 // Groq context limit
      }
    },
    status: {
      type: DataTypes.ENUM,
      values: ['uploaded', 'processing', 'processed', 'error'],
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
      allowNull: true
    }
  }, {
    tableName: 'meeting_transcripts',
    timestamps: true,
    indexes: [
      {
        fields: ['status']
      },
      {
        fields: ['sessionId']
      },
      {
        fields: ['createdAt']
      }
    ],
    hooks: {
      beforeValidate: (transcript) => {
        // Ensure filename is properly formatted
        if (transcript.filename) {
          transcript.filename = transcript.filename.trim();
        }
        if (transcript.originalName) {
          transcript.originalName = transcript.originalName.trim();
        }
      },
      afterCreate: (transcript) => {
        console.log(`📄 New transcript created: ${transcript.originalName} (${transcript.id})`);
      }
    }
  });

  // Instance methods
  MeetingTranscript.prototype.updateStatus = async function(status, error = null) {
    this.status = status;
    if (error) {
      this.processingError = error;
    }
    return await this.save();
  };

  MeetingTranscript.prototype.setContent = async function(content) {
    this.content = content;
    this.contentLength = content ? content.length : 0;
    this.status = 'processed';
    return await this.save();
  };

  // Class methods
  MeetingTranscript.findByStatus = function(status) {
    return this.findAll({
      where: { status },
      order: [['createdAt', 'DESC']]
    });
  };

  MeetingTranscript.findBySession = function(sessionId) {
    return this.findAll({
      where: { sessionId },
      order: [['createdAt', 'DESC']],
      include: ['summaries']
    });
  };

  return MeetingTranscript;
};
