module.exports = (sequelize, DataTypes) => {
  const UserSession = sequelize.define('UserSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    sessionToken: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [32, 128]
      }
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
      allowNull: false,
      validate: {
        isAfter: new Date().toISOString()
      }
    },
    workflowState: {
      type: DataTypes.ENUM,
      values: ['upload', 'instructions', 'processing', 'summary', 'email', 'completed'],
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
    }
  }, {
    tableName: 'user_sessions',
    timestamps: true,
    indexes: [
      {
        fields: ['sessionToken'],
        unique: true
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['lastActivity']
      },
      {
        fields: ['expiresAt']
      },
      {
        fields: ['workflowState']
      }
    ],
    hooks: {
      beforeCreate: (session) => {
        // Set default expiration to 24 hours from now
        if (!session.expiresAt) {
          session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
      },
      beforeUpdate: (session) => {
        // Update last activity when session is modified
        if (session.changed() && !session.changed('lastActivity')) {
          session.lastActivity = new Date();
        }
      }
    }
  });

  // Instance methods
  UserSession.prototype.updateActivity = async function() {
    this.lastActivity = new Date();
    return await this.save();
  };

  UserSession.prototype.updateWorkflowState = async function(state, transcriptId = null, summaryId = null) {
    this.workflowState = state;
    this.lastActivity = new Date();
    
    if (transcriptId) {
      this.currentTranscriptId = transcriptId;
    }
    
    if (summaryId) {
      this.currentSummaryId = summaryId;
    }
    
    return await this.save();
  };

  UserSession.prototype.updateStatistics = async function(updates) {
    const currentStats = this.statistics || {
      transcriptsProcessed: 0,
      summariesGenerated: 0,
      emailsSent: 0,
      totalCost: 0
    };
    
    this.statistics = { ...currentStats, ...updates };
    return await this.save();
  };

  UserSession.prototype.incrementStat = async function(statName, value = 1) {
    const currentStats = this.statistics || {};
    currentStats[statName] = (currentStats[statName] || 0) + value;
    this.statistics = currentStats;
    return await this.save();
  };

  UserSession.prototype.isExpired = function() {
    return new Date() > this.expiresAt;
  };

  UserSession.prototype.extend = async function(hours = 24) {
    this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    this.lastActivity = new Date();
    return await this.save();
  };

  UserSession.prototype.deactivate = async function() {
    this.isActive = false;
    return await this.save();
  };

  // Class methods
  UserSession.findByToken = function(sessionToken) {
    const { Op } = require('sequelize');
    return this.findOne({
      where: {
        sessionToken,
        isActive: true,
        expiresAt: { [Op.gt]: new Date() }
      },
      include: ['transcripts']
    });
  };

  UserSession.findActive = function() {
    const { Op } = require('sequelize');
    return this.findAll({
      where: {
        isActive: true,
        expiresAt: { [Op.gt]: new Date() }
      },
      order: [['lastActivity', 'DESC']]
    });
  };

  UserSession.cleanupExpired = async function() {
    const { Op } = require('sequelize');
    const expiredSessions = await this.findAll({
      where: {
        [Op.or]: [
          { expiresAt: { [Op.lt]: new Date() } },
          {
            isActive: true,
            lastActivity: { [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        ]
      }
    });

    for (const session of expiredSessions) {
      await session.deactivate();
    }

    return expiredSessions.length;
  };

  UserSession.getSessionStatistics = async function() {
    const stats = await this.findAll({
      attributes: [
        'workflowState',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.literal("(statistics->>'transcriptsProcessed')::int")), 'avgTranscripts'],
        [sequelize.fn('SUM', sequelize.literal("(statistics->>'totalCost')::decimal")), 'totalCost']
      ],
      where: { isActive: true },
      group: ['workflowState'],
      raw: true
    });
    
    return stats;
  };

  return UserSession;
};
