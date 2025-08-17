module.exports = (sequelize, DataTypes) => {
  const EmailRecord = sequelize.define('EmailRecord', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    summaryId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    recipients: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidRecipients(value) {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error('Recipients must be a non-empty array');
          }
          
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          for (const email of value) {
            if (!emailRegex.test(email)) {
              throw new Error(`Invalid email address: ${email}`);
            }
          }
        }
      }
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    emailFormat: {
      type: DataTypes.ENUM,
      values: ['html', 'text', 'both'],
      defaultValue: 'html',
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM,
      values: ['pending', 'sending', 'sent', 'failed', 'partially_sent'],
      defaultValue: 'pending',
      allowNull: false
    },
    emailService: {
      type: DataTypes.ENUM,
      values: ['sendgrid', 'aws-ses', 'mailgun', 'nodemailer'],
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
      allowNull: false,
      validate: {
        min: 0,
        max: 3
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'email_records',
    timestamps: true,
    indexes: [
      {
        fields: ['summaryId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['emailService']
      },
      {
        fields: ['sentAt']
      },
      {
        fields: ['createdAt']
      }
    ],
    hooks: {
      beforeCreate: (emailRecord) => {
        // Normalize email addresses
        if (emailRecord.recipients) {
          emailRecord.recipients = emailRecord.recipients.map(email => 
            email.toLowerCase().trim()
          );
        }
      },
      afterUpdate: (emailRecord) => {
        if (emailRecord.changed('status') && emailRecord.status === 'sent') {
          emailRecord.sentAt = new Date();
        }
      }
    }
  });

  // Instance methods
  EmailRecord.prototype.markSending = async function() {
    this.status = 'sending';
    return await this.save();
  };

  EmailRecord.prototype.markSent = async function(serviceMessageId, deliveryStatus = {}) {
    this.status = 'sent';
    this.sentAt = new Date();
    this.serviceMessageId = serviceMessageId;
    this.deliveryStatus = deliveryStatus;
    return await this.save();
  };

  EmailRecord.prototype.markFailed = async function(reason) {
    this.status = 'failed';
    this.failureReason = reason;
    this.retryCount += 1;
    return await this.save();
  };

  EmailRecord.prototype.markDelivered = async function(deliveryInfo = {}) {
    this.deliveredAt = new Date();
    this.deliveryStatus = { ...this.deliveryStatus, ...deliveryInfo };
    return await this.save();
  };

  EmailRecord.prototype.canRetry = function() {
    return this.status === 'failed' && this.retryCount < 3;
  };

  // Class methods
  EmailRecord.findBySummary = function(summaryId) {
    return this.findAll({
      where: { summaryId },
      order: [['createdAt', 'DESC']],
      include: ['summary']
    });
  };

  EmailRecord.findByStatus = function(status) {
    return this.findAll({
      where: { status },
      order: [['createdAt', 'ASC']],
      include: ['summary']
    });
  };

  EmailRecord.findPendingRetries = function() {
    return this.findAll({
      where: {
        status: 'failed',
        retryCount: { [sequelize.Op.lt]: 3 }
      },
      order: [['createdAt', 'ASC']]
    });
  };

  EmailRecord.getDeliveryStatistics = async function() {
    const stats = await this.findAll({
      attributes: [
        'status',
        'emailService',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('retryCount')), 'avgRetries']
      ],
      group: ['status', 'emailService'],
      raw: true
    });
    
    return stats;
  };

  return EmailRecord;
};
