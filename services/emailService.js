/**
 * Email Service
 * 
 * Comprehensive email service for sending meeting summaries and notifications:
 * - Template rendering with Handlebars
 * - Email delivery with retry logic
 * - Delivery tracking and status updates
 * - Rate limiting and queue management
 * - Multiple email service support
 */

const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const { getTransporter, getEmailConfig, verifyEmailConfig } = require('../config/email');
const { EmailRecord } = require('../models');

class EmailService {
  constructor() {
    this.transporter = null;
    this.config = getEmailConfig();
    this.templates = new Map();
    this.sendQueue = [];
    this.isProcessingQueue = false;
    
    // Initialize service
    this.initialize();
  }

  /**
   * Initialize email service
   */
  async initialize() {
    try {
      // Initialize transporter
      this.transporter = getTransporter();
      
      if (!this.transporter) {
        console.warn('⚠️ Email service not available - transporter not initialized');
        return;
      }

      // Verify configuration
      const verification = await verifyEmailConfig();
      if (!verification.success) {
        console.error('❌ Email configuration verification failed:', verification.error);
        return;
      }

      // Load email templates
      await this.loadTemplates();
      
      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }

  /**
   * Load email templates
   */
  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../templates/email');
      
      // Load base template
      const baseHtml = await fs.readFile(path.join(templatesDir, 'base.html'), 'utf8');
      this.templates.set('base', handlebars.compile(baseHtml));
      
      // Load summary templates
      const summaryHtml = await fs.readFile(path.join(templatesDir, 'summary.html'), 'utf8');
      const summaryText = await fs.readFile(path.join(templatesDir, 'summary.txt'), 'utf8');

      // Load additional template styles
      const professionalHtml = await fs.readFile(path.join(templatesDir, 'summary-professional.html'), 'utf8');
      const minimalHtml = await fs.readFile(path.join(templatesDir, 'summary-minimal.html'), 'utf8');

      this.templates.set('summary-html', handlebars.compile(summaryHtml));
      this.templates.set('summary-professional', handlebars.compile(professionalHtml));
      this.templates.set('summary-minimal', handlebars.compile(minimalHtml));
      this.templates.set('summary-text', handlebars.compile(summaryText));
      
      console.log('✅ Email templates loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load email templates:', error);
      throw error;
    }
  }

  /**
   * Send summary email
   */
  async sendSummaryEmail(summaryData, recipients, options = {}) {
    try {
      if (!this.transporter) {
        throw new Error('Email service not available');
      }

      if (!recipients || recipients.length === 0) {
        throw new Error('No recipients specified');
      }

      // Prepare email data
      const emailData = this.prepareSummaryEmailData(summaryData, options);
      
      // Create email record
      const emailRecord = await EmailRecord.create({
        summaryId: summaryData.id,
        recipients: recipients,
        subject: emailData.subject,
        content: emailData.html,
        emailFormat: 'html',
        status: 'pending',
        emailService: 'nodemailer',
        metadata: {
          summaryStyle: summaryData.summaryStyle,
          qualityGrade: summaryData.quality?.grade,
          processingTime: summaryData.processingTime,
          cost: summaryData.cost
        }
      });

      // Send email
      const result = await this.sendEmail({
        to: recipients,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        emailRecordId: emailRecord.id
      });

      // Update email record
      await emailRecord.update({
        status: result.success ? 'sent' : 'failed',
        serviceMessageId: result.messageId,
        sentAt: result.success ? new Date() : null,
        failureReason: result.success ? null : result.error
      });

      return {
        success: result.success,
        emailRecordId: emailRecord.id,
        messageId: result.messageId,
        error: result.error
      };

    } catch (error) {
      console.error('❌ Failed to send summary email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean and format summary content for email
   */
  cleanSummaryContent(content) {
    if (!content) return '';

    // Remove markdown artifacts and clean HTML
    let cleaned = content
      // First, handle headings properly - convert markdown headers to HTML headings
      .replace(/^#{1}\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#{2}\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{3}\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^#{4,6}\s+(.+)$/gm, '<h5>$1</h5>')
      // Remove bullet points from headings (common formatting issue)
      .replace(/<h([2-5])>•\s*(.+?)<\/h\1>/g, '<h$1>$2</h$1>')
      .replace(/<h([2-5])>[\*\-\+]\s*(.+?)<\/h\1>/g, '<h$1>$2</h$1>')
      // Remove extra whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Clean up HTML tags that might be malformed
      .replace(/<\/?(p|div|span)[^>]*>/gi, '')
      // Ensure proper paragraph breaks
      .replace(/\n\n/g, '</p><p>')
      // Wrap non-heading content in paragraph tags
      .replace(/^(?!<h[2-5]>)(.+)$/gm, '<p>$1</p>')
      // Clean up empty paragraphs
      .replace(/<p>\s*<\/p>/g, '')
      // IMPROVED: Only convert lines that are actually list items to bullet points
      // Look for lines that start with bullet markers and are clearly list items
      .replace(/<p>[\*\-\+•]\s*(.+?)<\/p>/g, '<li>$1</li>')
      // Also handle numbered lists
      .replace(/<p>\d+\.\s*(.+?)<\/p>/g, '<li>$1</li>')
      // Wrap consecutive list items in ul tags
      .replace(/(<li>.*?<\/li>)(\s*<li>.*?<\/li>)*/g, '<ul>$&</ul>')
      // Clean up any remaining issues
      .replace(/<\/li>\s*<li>/g, '</li><li>')
      // Remove any remaining markdown bold/italic that wasn't converted
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Clean up duplicate headings or action items sections
      .replace(/<h([2-5])>.*?action\s*items.*?<\/h\1>/gi, '')
      .replace(/<h([2-5])>.*?key\s*action\s*items.*?<\/h\1>/gi, '')
      // IMPORTANT: Do NOT add bullet points to regular paragraph content
      // Remove any bullet points that were incorrectly added to names, titles, or regular text
      .replace(/<p>•\s*([A-Z][a-z]+\s+[A-Z][a-z]+)\s*<\/p>/g, '<p>$1</p>') // Names
      .replace(/<p>•\s*([A-Z][^<]*?:)\s*<\/p>/g, '<p><strong>$1</strong></p>') // Titles/labels
      .trim();

    return cleaned;
  }

  /**
   * Extract meeting topic from content for better subject line
   */
  extractMeetingTopic(content, originalFileName) {
    if (!content) return 'Meeting';

    // Try to find meeting topic in first few lines
    const lines = content.split('\n').slice(0, 5);

    // Look for common meeting patterns
    const topicPatterns = [
      /(?:meeting|discussion|call|session)\s+(?:about|on|regarding|for)\s+(.+?)(?:\.|$)/i,
      /^(.+?)\s+(?:meeting|discussion|call|session)/i,
      /topic:\s*(.+?)(?:\.|$)/i,
      /subject:\s*(.+?)(?:\.|$)/i,
      /agenda:\s*(.+?)(?:\.|$)/i
    ];

    for (const line of lines) {
      for (const pattern of topicPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          return match[1].trim().substring(0, 50); // Limit length
        }
      }
    }

    // Fallback to filename without extension
    if (originalFileName) {
      return originalFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    }

    return 'Meeting';
  }

  /**
   * Generate intelligent email subject line
   */
  generateEmailSubject(summaryData, options = {}) {
    const topic = this.extractMeetingTopic(
      summaryData.content,
      summaryData.transcript?.originalName
    );

    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const style = this.formatSummaryStyle(summaryData.summaryStyle || 'executive');

    // Custom subject if provided
    if (options.customSubject) {
      return options.customSubject;
    }

    // Generate intelligent subject
    return `${topic} - ${style} Summary (${date})`;
  }

  /**
   * Prepare summary email data
   */
  prepareSummaryEmailData(summaryData, options = {}) {
    const date = new Date().toLocaleDateString();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    
    // Prepare template data
    const numericProcessingTimeSec = Number(summaryData.processingTime || 0) / 1000;
    const numericCost = (() => {
      if (typeof summaryData.cost === 'number') return summaryData.cost;
      const parsed = parseFloat(summaryData.cost || '0');
      return Number.isNaN(parsed) ? 0 : parsed;
    })();

    const templateData = {
      // Header information
      headerTitle: options.headerTitle || 'Meeting Summary',
      headerSubtitle: options.headerSubtitle || `Generated on ${date}`,

      // Summary metadata (only user-relevant information)
      summaryStyle: this.formatSummaryStyle(summaryData.summaryStyle),

      // Content
      summaryContent: this.cleanSummaryContent(summaryData.content),
      summaryContentText: this.stripHtml(summaryData.content),
      customInstructions: summaryData.customInstructions,

      // Action items - only extract if not already present in content
      actionItems: this.shouldExtractActionItems(summaryData.content) ? this.extractActionItems(summaryData.content) : null,

      // Quality insights (only if meaningful to end users)
      qualityInsights: summaryData.quality ? {
        strengths: summaryData.quality.strengths || [],
        issues: summaryData.quality.issues || []
      } : null,

      // Basic file information (minimal, user-relevant only)
      originalFileName: summaryData.transcript?.originalName || 'Unknown',
      generatedAt: new Date().toLocaleString(),

      // App information
      appUrl: appUrl,
      footerText: 'Generated by Meeting Summarizer AI'
    };

    // Generate intelligent subject
    const subject = this.generateEmailSubject(summaryData, options);

    // Determine template style
    const templateStyle = options.templateStyle || 'default';
    const templateKey = templateStyle === 'professional' ? 'summary-professional' :
                       templateStyle === 'minimal' ? 'summary-minimal' : 'summary-html';

    // Render templates
    const htmlContent = this.templates.get(templateKey)(templateData);
    const html = this.templates.get('base')({
      subject: subject,
      headerTitle: templateData.headerTitle,
      headerSubtitle: templateData.headerSubtitle,
      content: htmlContent,
      footerText: templateData.footerText
    });

    const text = this.templates.get('summary-text')(templateData);

    return {
      subject,
      html,
      text,
      templateData, // Include for preview functionality
      templateStyle
    };
  }

  /**
   * Generate email preview without sending
   */
  generateEmailPreview(summaryData, options = {}) {
    try {
      const emailData = this.prepareSummaryEmailData(summaryData, options);

      return {
        success: true,
        preview: {
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          templateStyle: emailData.templateStyle,
          templateData: emailData.templateData
        }
      };
    } catch (error) {
      console.error('❌ Failed to generate email preview:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send email with retry logic
   */
  async sendEmail(emailOptions, retryCount = 0) {
    try {
      const mailOptions = {
        from: `${this.config.from.name} <${this.config.from.address}>`,
        to: Array.isArray(emailOptions.to) ? emailOptions.to.join(', ') : emailOptions.to,
        subject: emailOptions.subject,
        html: emailOptions.html,
        text: emailOptions.text
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };

    } catch (error) {
      console.error(`❌ Email send attempt ${retryCount + 1} failed:`, error);
      
      // Retry logic
      if (retryCount < this.config.retryAttempts) {
        console.log(`🔄 Retrying email send (attempt ${retryCount + 2}/${this.config.retryAttempts + 1})`);
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.sendEmail(emailOptions, retryCount + 1);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Utility methods
   */
  formatSummaryStyle(style) {
    const styles = {
      'executive': 'Executive Summary',
      'action-items': 'Action Items',
      'technical': 'Technical Summary',
      'detailed': 'Detailed Summary',
      'bullet-points': 'Bullet Points'
    };
    return styles[style] || style;
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Check if action items should be extracted separately
   * (only if they're not already formatted in the content)
   */
  shouldExtractActionItems(content) {
    if (!content) return false;

    // Check if content already has action items sections
    const hasActionItemsSection = /(?:action\s*items?|key\s*actions?|next\s*steps?)/i.test(content);

    // If there's already an action items section, don't extract separately
    return !hasActionItemsSection;
  }

  extractActionItems(content) {
    // Enhanced action item extraction with multiple patterns
    const items = [];

    // Pattern 1: **Owner:** Task format
    const ownerTaskPattern = /\*\*([^:]+):\*\*\s*([^.\n]+)/g;
    let match;

    while ((match = ownerTaskPattern.exec(content)) !== null) {
      items.push({
        owner: match[1].trim(),
        task: match[2].trim()
      });
    }

    // Pattern 2: - Task (Owner: Name) format
    const taskOwnerPattern = /-\s*([^(]+)\s*\((?:Owner|Assigned to):\s*([^)]+)\)/gi;
    while ((match = taskOwnerPattern.exec(content)) !== null) {
      items.push({
        owner: match[2].trim(),
        task: match[1].trim()
      });
    }

    // Pattern 3: Simple bullet points with action verbs
    const actionVerbPattern = /-\s*([A-Z][^.]+(?:will|should|must|need to|to)\s+[^.\n]+)/g;
    while ((match = actionVerbPattern.exec(content)) !== null) {
      items.push({
        owner: 'Team',
        task: match[1].trim()
      });
    }

    return items.length > 0 ? items : null;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get email service status
   */
  async getStatus() {
    const verification = this.transporter ? await verifyEmailConfig() : { success: false, error: 'No transporter' };
    
    return {
      enabled: this.config.enabled,
      configured: !!this.transporter,
      verified: verification.success,
      templatesLoaded: this.templates.size > 0,
      config: {
        service: this.config.service,
        host: this.config.host,
        port: this.config.port,
        from: this.config.from
      },
      error: verification.error
    };
  }
}

// Export singleton instance
module.exports = new EmailService();
