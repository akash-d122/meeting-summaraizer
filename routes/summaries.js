/**
 * Summary Generation API Routes
 * 
 * Endpoints for generating, retrieving, and managing meeting summaries
 * using the SummaryService and Groq API integration
 */

const express = require('express');
const router = express.Router();
const SummaryService = require('../services/summaryService');
const { validateSession, updateWorkflowState } = require('../middleware/sessionMiddleware');
const { MeetingTranscript, Summary } = require('../models');
const {
  validationRules,
  handleValidationErrors,
  sanitizeRequestBody,
  preventSQLInjection
} = require('../middleware/validation');

const summaryService = new SummaryService();

/**
 * Generate a new summary for a transcript
 * POST /api/summaries/generate
 */
router.post('/generate',
  validateSession,
  preventSQLInjection,
  sanitizeRequestBody,
  validationRules.summaryGeneration,
  handleValidationErrors,
  async (req, res) => {
  try {
    const {
      transcriptId,
      summaryStyle = 'executive',
      customInstructions = '',
      useFallback = false,
      forceModel = null,
      urgency = 'normal'
    } = req.body;

    // Validation
    if (!transcriptId) {
      return res.status(400).json({
        success: false,
        error: 'transcriptId is required'
      });
    }

    // Verify transcript exists and belongs to session
    const transcript = await MeetingTranscript.findOne({
      where: {
        id: transcriptId,
        sessionId: req.session.id
      }
    });

    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found or access denied'
      });
    }

    // Check if summary already exists
    const existingSummary = await Summary.findOne({
      where: {
        transcriptId: transcriptId,
        summaryStyle: summaryStyle,
        status: ['completed', 'generating']
      }
    });

    if (existingSummary && existingSummary.status === 'generating') {
      return res.status(409).json({
        success: false,
        error: 'Summary generation already in progress',
        summaryId: existingSummary.id
      });
    }

    if (existingSummary && existingSummary.status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Summary already exists',
        summary: {
          id: existingSummary.id,
          content: existingSummary.content,
          summaryStyle: existingSummary.summaryStyle,
          createdAt: existingSummary.createdAt,
          processingTime: existingSummary.processingTime,
          tokenUsage: existingSummary.tokenUsage,
          cost: existingSummary.cost
        }
      });
    }

    console.log(`🚀 Starting summary generation for transcript ${transcriptId}`);

    // Generate summary with fallback options
    const result = await summaryService.generateSummary(transcriptId, {
      summaryStyle,
      customInstructions,
      sessionToken: req.session.sessionToken,
      useFallback,
      forceModel,
      urgency
    });

    // Update session workflow state
    await updateWorkflowState(req.session.id, 'summary');

    res.status(201).json({
      success: true,
      message: 'Summary generated successfully',
      summary: {
        id: result.id,
        content: result.content,
        summaryStyle: result.summaryStyle,
        processingTime: result.processingTime,
        tokenUsage: result.tokenUsage,
        cost: result.cost,
        model: result.model,
        createdAt: result.createdAt,
        // Add processed response data
        quality: result.quality,
        structure: result.structure,
        analysis: result.analysis,
        formats: result.formats,
        validation: result.validation
      }
    });

  } catch (error) {
    console.error('Summary generation error:', error);

    // Handle specific error types
    const errorMessage = error?.message || error?.toString() || 'Unknown error';

    if (errorMessage.includes('Rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again in a moment.',
        retryAfter: 60
      });
    }

    if (errorMessage.includes('API key')) {
      return res.status(503).json({
        success: false,
        error: 'AI service temporarily unavailable. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate summary',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

/**
 * Get summary in specific format
 * GET /api/summaries/:id/format/:format
 */
router.get('/:id/format/:format', validateSession, async (req, res) => {
  try {
    const { id, format } = req.params;

    const summary = await Summary.findOne({
      where: { id },
      include: [{
        model: MeetingTranscript,
        where: { sessionId: req.session.id },
        attributes: ['id', 'originalName', 'createdAt']
      }]
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Summary not found or access denied'
      });
    }

    // Get formats from metadata
    const formats = summary.metadata?.formats || {};

    if (!formats[format]) {
      return res.status(404).json({
        success: false,
        error: `Format '${format}' not available. Available formats: ${Object.keys(formats).join(', ')}`
      });
    }

    // Set appropriate content type
    const contentTypes = {
      api: 'application/json',
      ui: 'application/json',
      email: 'text/plain',
      text: 'text/plain',
      markdown: 'text/markdown'
    };

    res.set('Content-Type', contentTypes[format] || 'application/json');

    if (format === 'email') {
      res.send(formats.email.body);
    } else if (format === 'text') {
      res.send(formats.text.content);
    } else if (format === 'markdown') {
      res.send(formats.markdown.content);
    } else {
      res.json({
        success: true,
        format: format,
        data: formats[format]
      });
    }

  } catch (error) {
    console.error('Get summary format error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve summary format'
    });
  }
});

/**
 * Get summary by ID
 * GET /api/summaries/:id
 */
router.get('/:id', validateSession, async (req, res) => {
  try {
    const { id } = req.params;

    const summary = await Summary.findOne({
      where: { id },
      include: [{
        model: MeetingTranscript,
        where: { sessionId: req.session.id },
        attributes: ['id', 'originalName', 'createdAt']
      }]
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Summary not found or access denied'
      });
    }

    res.json({
      success: true,
      summary: {
        id: summary.id,
        content: summary.content,
        summaryStyle: summary.summaryStyle,
        customInstructions: summary.customInstructions,
        status: summary.status,
        processingTime: summary.processingTime,
        tokenUsage: summary.tokenUsage,
        cost: summary.cost,
        aiModel: summary.aiModel,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        transcript: summary.MeetingTranscript
      }
    });

  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve summary'
    });
  }
});

/**
 * Get all summaries for current session
 * GET /api/summaries
 */
router.get('/', validateSession, async (req, res) => {
  try {
    const { style, status, limit = 50, offset = 0 } = req.query;

    const whereClause = {};
    if (style) whereClause.summaryStyle = style;
    if (status) whereClause.status = status;

    const summaries = await Summary.findAndCountAll({
      where: whereClause,
      include: [{
        model: MeetingTranscript,
        where: { sessionId: req.session.id },
        attributes: ['id', 'originalName', 'createdAt', 'fileSize']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      summaries: summaries.rows.map(summary => ({
        id: summary.id,
        summaryStyle: summary.summaryStyle,
        status: summary.status,
        processingTime: summary.processingTime,
        tokenUsage: summary.tokenUsage,
        cost: summary.cost,
        aiModel: summary.aiModel,
        createdAt: summary.createdAt,
        transcript: summary.MeetingTranscript
      })),
      pagination: {
        total: summaries.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: summaries.count > parseInt(offset) + parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get summaries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve summaries'
    });
  }
});

/**
 * Delete summary
 * DELETE /api/summaries/:id
 */
router.delete('/:id', validateSession, async (req, res) => {
  try {
    const { id } = req.params;

    const summary = await Summary.findOne({
      where: { id },
      include: [{
        model: MeetingTranscript,
        where: { sessionId: req.session.id }
      }]
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Summary not found or access denied'
      });
    }

    await summary.destroy();

    res.json({
      success: true,
      message: 'Summary deleted successfully'
    });

  } catch (error) {
    console.error('Delete summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete summary'
    });
  }
});

/**
 * Get fallback system statistics
 * GET /api/summaries/stats/fallback
 */
router.get('/stats/fallback', validateSession, async (req, res) => {
  try {
    const fallbackStats = summaryService.getFallbackStats();
    const fallbackConfig = summaryService.getFallbackConfig();

    res.json({
      success: true,
      statistics: fallbackStats,
      configuration: fallbackConfig
    });

  } catch (error) {
    console.error('Get fallback stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve fallback statistics'
    });
  }
});

/**
 * Test fallback scenarios
 * GET /api/summaries/test/fallback
 */
router.get('/test/fallback', validateSession, async (req, res) => {
  try {
    const scenarios = await summaryService.testFallbackScenarios();

    res.json({
      success: true,
      scenarios: scenarios,
      message: 'Fallback scenarios tested successfully'
    });

  } catch (error) {
    console.error('Test fallback scenarios error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test fallback scenarios'
    });
  }
});

/**
 * Reset fallback statistics
 * POST /api/summaries/stats/fallback/reset
 */
router.post('/stats/fallback/reset', validateSession, async (req, res) => {
  try {
    summaryService.resetStats();

    res.json({
      success: true,
      message: 'Fallback statistics reset successfully'
    });

  } catch (error) {
    console.error('Reset fallback stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset fallback statistics'
    });
  }
});

/**
 * Get generation statistics
 * GET /api/summaries/stats/generation
 */
router.get('/stats/generation', validateSession, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;

    const stats = await summaryService.getGenerationStats(timeframe);

    // Calculate totals
    const totals = stats.reduce((acc, stat) => {
      acc.totalSummaries += parseInt(stat.count);
      acc.totalCost += parseFloat(stat.totalCost || 0);
      acc.avgProcessingTime += parseFloat(stat.avgProcessingTime || 0);
      acc.avgTokens += parseFloat(stat.avgTokens || 0);
      return acc;
    }, {
      totalSummaries: 0,
      totalCost: 0,
      avgProcessingTime: 0,
      avgTokens: 0
    });

    if (stats.length > 0) {
      totals.avgProcessingTime = totals.avgProcessingTime / stats.length;
      totals.avgTokens = totals.avgTokens / stats.length;
    }

    res.json({
      success: true,
      timeframe,
      statistics: {
        totals,
        breakdown: stats
      }
    });

  } catch (error) {
    console.error('Get generation stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

module.exports = router;
