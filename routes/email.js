/**
 * Email Distribution Routes
 *
 * API endpoints for email functionality:
 * - Send summary emails
 * - Check email status
 * - Manage email preferences
 * - Track email delivery
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { validateSession } = require('../middleware/sessionMiddleware');
const emailService = require('../services/emailService');
const { Summary, EmailRecord, MeetingTranscript } = require('../models');
const {
  validationRules,
  handleValidationErrors,
  sanitizeRequestBody,
  preventSQLInjection
} = require('../middleware/validation');

/**
 * @route POST /api/email/send-summary
 * @desc Send summary via email
 * @access Private
 */
// Email preview endpoint
router.post('/preview-summary',
  validateSession,
  preventSQLInjection,
  sanitizeRequestBody,
  validationRules.email,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { summaryId, recipients, customSubject, customMessage, templateStyle } = req.body;

      // Get summary data
      const summary = await Summary.findByPk(summaryId, {
        include: [{
          model: MeetingTranscript,
          as: 'transcript'
        }]
      });

      if (!summary) {
        return res.status(404).json({
          success: false,
          error: 'Summary not found'
        });
      }

      // Generate email preview
      const preview = emailService.generateEmailPreview(summary, {
        customSubject,
        customMessage,
        templateStyle,
        sessionId: req.session?.id
      });

      if (preview.success) {
        res.json({
          success: true,
          preview: preview.preview
        });
      } else {
        res.status(500).json({
          success: false,
          error: preview.error
        });
      }
    } catch (error) {
      console.error('❌ Email preview error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate email preview'
      });
    }
  }
);

router.post('/send-summary',
  validateSession,
  preventSQLInjection,
  sanitizeRequestBody,
  validationRules.email,
  handleValidationErrors,
  async (req, res) => {
    try {

      const { summaryId, recipients, customSubject, customMessage, templateStyle } = req.body;

      // Check if email service is available
      const emailStatus = await emailService.getStatus();
      if (!emailStatus.enabled || !emailStatus.configured) {
        return res.status(503).json({
          success: false,
          error: 'Email service not available',
          details: 'Email service is not configured or disabled'
        });
      }

      // Load summary with transcript data
      const summary = await Summary.findOne({
        where: { id: summaryId },
        include: [{
          model: MeetingTranscript,
          as: 'transcript'
        }]
      });

      if (!summary) {
        return res.status(404).json({
          success: false,
          error: 'Summary not found'
        });
      }

      // Check if summary belongs to current session
      if (summary.transcript.sessionId !== req.session.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Prepare email options
      const emailOptions = {
        customSubject: customSubject,
        customMessage: customMessage || `Generated on ${new Date().toLocaleDateString()}`,
        templateStyle: templateStyle || 'default',
        sessionId: req.session.id
      };

      // Send email
      const result = await emailService.sendSummaryEmail(summary, recipients, emailOptions);

      if (result.success) {
        // Update session statistics
        const currentStats = req.session.statistics || {};
        await req.session.update({
          statistics: {
            ...currentStats,
            emailsSent: (currentStats.emailsSent || 0) + 1
          }
        });

        res.json({
          success: true,
          message: 'Email sent successfully',
          data: {
            emailRecordId: result.emailRecordId,
            messageId: result.messageId,
            recipients: recipients.length,
            sentAt: new Date().toISOString()
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to send email',
          details: result.error
        });
      }

    } catch (error) {
      console.error('Email send error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route GET /api/email/status/:emailRecordId
 * @desc Get email delivery status
 * @access Private
 */
router.get('/status/:emailRecordId',
  validateSession,
  async (req, res) => {
    try {
      const { emailRecordId } = req.params;

      const emailRecord = await EmailRecord.findOne({
        where: { id: emailRecordId },
        include: [{
          model: Summary,
          include: [{
            model: MeetingTranscript,
            as: 'transcript'
          }]
        }]
      });

      if (!emailRecord) {
        return res.status(404).json({
          success: false,
          error: 'Email record not found'
        });
      }

      // Check access permissions
      if (emailRecord.Summary.transcript.sessionId !== req.session.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: {
          id: emailRecord.id,
          status: emailRecord.status,
          recipients: emailRecord.recipients,
          subject: emailRecord.subject,
          emailService: emailRecord.emailService,
          sentAt: emailRecord.sentAt,
          deliveredAt: emailRecord.deliveredAt,
          failureReason: emailRecord.failureReason,
          retryCount: emailRecord.retryCount,
          createdAt: emailRecord.createdAt
        }
      });

    } catch (error) {
      console.error('Email status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /api/email/service-status
 * @desc Get email service status
 * @access Private
 */
router.get('/service-status',
  validateSession,
  async (req, res) => {
    try {
      const status = await emailService.getStatus();

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Email service status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

module.exports = router;
