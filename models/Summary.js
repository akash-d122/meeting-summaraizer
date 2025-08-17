module.exports = (sequelize, DataTypes) => {
  const Summary = sequelize.define('Summary', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    transcriptId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true, // Allow null during generation, will be updated when complete
      defaultValue: '',
      validate: {
        len: [0, 50000] // Reasonable summary length limits
      }
    },
    summaryStyle: {
      type: DataTypes.ENUM,
      values: ['executive', 'action-items', 'technical', 'detailed', 'custom'],
      allowNull: false,
      defaultValue: 'executive'
    },
    customInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    aiModel: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'llama-3.3-70b-versatile',
      validate: {
        isIn: [['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']]
      }
    },
    processingTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0
      }
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
      allowNull: true,
      validate: {
        min: 0
      }
    },
    status: {
      type: DataTypes.ENUM,
      values: ['generating', 'completed', 'error', 'edited'],
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
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'summaries',
    timestamps: true,
    indexes: [
      {
        fields: ['transcriptId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['summaryStyle']
      },
      {
        fields: ['createdAt']
      }
    ],
    hooks: {
      beforeUpdate: (summary) => {
        // Track edit history when content is modified
        if (summary.changed('content') && summary.status === 'completed') {
          const editHistory = summary.editHistory || [];
          editHistory.push({
            timestamp: new Date(),
            previousContent: summary._previousDataValues.content,
            editType: 'manual_edit'
          });
          summary.editHistory = editHistory;
          summary.status = 'edited';
        }
      },
      afterCreate: (summary) => {
        console.log(`📝 New summary created for transcript: ${summary.transcriptId}`);
      }
    }
  });

  // Instance methods
  Summary.prototype.updateContent = async function(newContent, editType = 'manual_edit') {
    const editHistory = this.editHistory || [];
    editHistory.push({
      timestamp: new Date(),
      previousContent: this.content,
      editType: editType
    });
    
    this.content = newContent;
    this.editHistory = editHistory;
    this.status = 'edited';
    
    return await this.save();
  };

  Summary.prototype.markCompleted = async function(processingTime, tokenUsage, cost) {
    this.status = 'completed';
    this.processingTime = processingTime;
    this.tokenUsage = tokenUsage;
    this.cost = cost;
    
    return await this.save();
  };

  Summary.prototype.markError = async function(error) {
    this.status = 'error';
    this.generationError = error;
    
    return await this.save();
  };

  // Class methods
  Summary.findByTranscript = function(transcriptId) {
    return this.findAll({
      where: { transcriptId },
      order: [['createdAt', 'DESC']],
      include: ['transcript']
    });
  };

  Summary.findByStatus = function(status) {
    return this.findAll({
      where: { status },
      order: [['createdAt', 'DESC']],
      include: ['transcript']
    });
  };

  Summary.getStatistics = async function() {
    const stats = await this.findAll({
      attributes: [
        'summaryStyle',
        'aiModel',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('processingTime')), 'avgProcessingTime'],
        [sequelize.fn('SUM', sequelize.col('cost')), 'totalCost']
      ],
      group: ['summaryStyle', 'aiModel'],
      raw: true
    });
    
    return stats;
  };

  return Summary;
};
