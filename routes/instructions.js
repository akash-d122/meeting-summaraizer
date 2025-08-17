const express = require('express');
const { body, validationResult } = require('express-validator');
const { MeetingTranscript, UserSession } = require('../models');

const router = express.Router();

// Validation middleware for instructions
const validateInstructions = [
  body('transcriptId').isUUID().withMessage('Valid transcript ID is required'),
  body('summaryStyle').isIn(['executive', 'action-items', 'technical', 'detailed', 'custom'])
    .withMessage('Invalid summary style'),
  body('customInstructions').optional().isLength({ max: 1000 })
    .withMessage('Custom instructions must be 1000 characters or less'),
  body('sessionToken').optional().isLength({ min: 32, max: 128 })
    .withMessage('Invalid session token format')
];

// Session middleware
const validateSession = async (req, res, next) => {
  try {
    const sessionToken = req.headers['x-session-token'] || req.body.sessionToken;
    
    if (sessionToken) {
      const session = await UserSession.findByToken(sessionToken);
      if (session) {
        req.session = session;
      }
    }
    
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    next(); // Continue without session
  }
};

// Save instructions for a transcript
router.post('/save', validateSession, validateInstructions, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const { transcriptId, summaryStyle, customInstructions } = req.body;

    // Verify transcript exists and belongs to session (if session provided)
    const transcript = await MeetingTranscript.findByPk(transcriptId);
    if (!transcript) {
      return res.status(404).json({ 
        error: 'Transcript not found',
        code: 'TRANSCRIPT_NOT_FOUND'
      });
    }

    // Check session ownership if session is provided
    if (req.session && transcript.sessionId !== req.session.id) {
      return res.status(403).json({ 
        error: 'Access denied to this transcript',
        code: 'ACCESS_DENIED'
      });
    }

    // Update transcript with instruction metadata
    await transcript.update({
      metadata: {
        ...transcript.metadata,
        instructions: {
          summaryStyle,
          customInstructions,
          savedAt: new Date(),
          sessionId: req.session?.id
        }
      }
    });

    res.json({
      message: 'Instructions saved successfully',
      transcriptId: transcriptId,
      instructions: {
        summaryStyle,
        customInstructions,
        characterCount: customInstructions?.length || 0
      }
    });

  } catch (error) {
    console.error('Save instructions error:', error);
    res.status(500).json({ 
      error: 'Failed to save instructions',
      code: 'SAVE_ERROR'
    });
  }
});

// Get instructions for a transcript
router.get('/:transcriptId', validateSession, async (req, res) => {
  try {
    const { transcriptId } = req.params;

    if (!transcriptId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ 
        error: 'Invalid transcript ID format',
        code: 'INVALID_ID'
      });
    }

    const transcript = await MeetingTranscript.findByPk(transcriptId);
    if (!transcript) {
      return res.status(404).json({ 
        error: 'Transcript not found',
        code: 'TRANSCRIPT_NOT_FOUND'
      });
    }

    // Check session ownership if session is provided
    if (req.session && transcript.sessionId !== req.session.id) {
      return res.status(403).json({ 
        error: 'Access denied to this transcript',
        code: 'ACCESS_DENIED'
      });
    }

    const instructions = transcript.metadata?.instructions || {};

    res.json({
      transcriptId: transcriptId,
      instructions: {
        summaryStyle: instructions.summaryStyle || 'executive',
        customInstructions: instructions.customInstructions || '',
        characterCount: instructions.customInstructions?.length || 0,
        savedAt: instructions.savedAt || null
      }
    });

  } catch (error) {
    console.error('Get instructions error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve instructions',
      code: 'RETRIEVAL_ERROR'
    });
  }
});

// Get instruction templates
router.get('/templates/list', (req, res) => {
  try {
    const templates = {
      styles: {
        executive: {
          name: 'Executive Summary',
          description: 'High-level bullet points focusing on key decisions, outcomes, and strategic implications',
          template: 'Please create an executive summary with:\n• Key decisions made\n• Strategic outcomes\n• Budget/resource implications\n• Next steps for leadership'
        },
        'action-items': {
          name: 'Action Items & Decisions',
          description: 'Structured list of action items with clear owners, deadlines, and priorities',
          template: 'Please extract and format:\n• Action items with clear owners\n• Deadlines and priorities\n• Dependencies between tasks\n• Follow-up meeting requirements'
        },
        technical: {
          name: 'Technical Summary',
          description: 'Detailed technical discussion points, decisions, and implementation details',
          template: 'Please focus on:\n• Technical decisions and rationale\n• Implementation approaches discussed\n• Architecture or design choices\n• Technical risks and mitigation strategies'
        },
        detailed: {
          name: 'Detailed Overview',
          description: 'Comprehensive overview covering all discussion points, context, and nuances',
          template: 'Please provide a comprehensive summary including:\n• Full context and background\n• All discussion points covered\n• Different perspectives shared\n• Complete decision-making process'
        }
      },
      examples: {
        'meeting-notes': {
          name: 'Meeting Notes',
          description: 'Structured meeting summary with attendees, agenda, and outcomes',
          category: 'General'
        },
        'action-focused': {
          name: 'Action-Focused',
          description: 'Emphasize action items, deadlines, and responsibilities',
          category: 'Task Management'
        },
        'decision-log': {
          name: 'Decision Log',
          description: 'Focus on decisions made and their rationale',
          category: 'Decision Tracking'
        },
        'stakeholder-update': {
          name: 'Stakeholder Update',
          description: 'High-level summary for executives and stakeholders',
          category: 'Communication'
        }
      }
    };

    res.json({
      templates,
      limits: {
        maxCharacters: 1000,
        recommendedLength: '200-500 characters for best results'
      },
      tips: [
        'Be specific about the format you want (bullets, paragraphs, etc.)',
        'Specify your target audience (executives, team members, etc.)',
        'Include any specific sections or topics to emphasize',
        'Mention if you want certain information excluded',
        'Use action-oriented language for clearer instructions'
      ]
    });

  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve templates',
      code: 'TEMPLATES_ERROR'
    });
  }
});

// Validate instructions without saving
router.post('/validate', validateInstructions, (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        valid: false,
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const { summaryStyle, customInstructions } = req.body;
    const characterCount = customInstructions?.length || 0;
    
    // Additional validation logic
    const warnings = [];
    if (characterCount < 50 && summaryStyle === 'custom') {
      warnings.push('Custom instructions are quite short. Consider adding more specific details.');
    }
    if (characterCount > 800) {
      warnings.push('Instructions are quite long. Consider being more concise for better AI performance.');
    }

    res.json({
      valid: true,
      characterCount,
      warnings,
      suggestions: characterCount < 100 ? [
        'Add specific formatting preferences (bullets, paragraphs, etc.)',
        'Mention your target audience',
        'Include any sections you want emphasized'
      ] : []
    });

  } catch (error) {
    console.error('Validate instructions error:', error);
    res.status(500).json({ 
      error: 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
});

module.exports = router;
