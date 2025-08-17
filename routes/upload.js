const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { MeetingTranscript, UserSession } = require('../models');

const router = express.Router();

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  try {
    await fs.access('uploads');
  } catch (error) {
    await fs.mkdir('uploads', { recursive: true });
  }
};

// Configure multer for secure file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadsDir();
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate secure filename with timestamp and random hash
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(16).toString('hex');
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const secureFilename = `transcript-${timestamp}-${randomHash}${fileExtension}`;
    cb(null, secureFilename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.txt', '.md', '.doc', '.docx'];
  const allowedMimeTypes = [
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const fileExtension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  // Check both extension and MIME type for security
  if (allowedTypes.includes(fileExtension) && allowedMimeTypes.includes(mimeType)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only .txt, .md, .doc, .docx files are allowed. Received: ${fileExtension} (${mimeType})`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  },
  fileFilter: fileFilter
});

// Session management middleware
const getOrCreateSession = async (req, res, next) => {
  try {
    let sessionToken = req.headers['x-session-token'] || req.body.sessionToken;
    let session = null;

    if (sessionToken) {
      // Try to find existing session
      session = await UserSession.findByToken(sessionToken);
    }

    if (!session) {
      // Create new session
      sessionToken = crypto.randomBytes(32).toString('hex');
      session = await UserSession.create({
        sessionToken: sessionToken,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        workflowState: 'upload',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
    }

    req.session = session;
    next();
  } catch (error) {
    console.error('Session management error:', error);
    res.status(500).json({ error: 'Session management failed' });
  }
};

// File content extraction (for text files)
const extractFileContent = async (filePath, mimeType) => {
  try {
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      const content = await fs.readFile(filePath, 'utf8');
      return {
        content: content.trim(),
        contentLength: content.length,
        tokenCount: Math.ceil(content.length / 4) // Rough token estimation
      };
    }

    // For .doc/.docx files, we'll need additional processing in future tasks
    return {
      content: null,
      contentLength: 0,
      tokenCount: 0
    };
  } catch (error) {
    console.error('Content extraction error:', error);
    return {
      content: null,
      contentLength: 0,
      tokenCount: 0
    };
  }
};

// Main file upload endpoint
router.post('/', getOrCreateSession, upload.single('transcript'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    // Extract file content
    const contentData = await extractFileContent(req.file.path, req.file.mimetype);

    // Create database record
    const transcript = await MeetingTranscript.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      content: contentData.content,
      contentLength: contentData.contentLength,
      tokenCount: contentData.tokenCount,
      status: contentData.content ? 'processed' : 'uploaded',
      sessionId: req.session.id,
      metadata: {
        uploadedAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        originalPath: req.file.originalname
      }
    });

    // Update session workflow state
    await req.session.updateWorkflowState('instructions', transcript.id);
    await req.session.incrementStat('transcriptsProcessed', 1);

    // Return success response
    res.status(201).json({
      message: 'File uploaded and processed successfully',
      transcript: {
        id: transcript.id,
        filename: transcript.originalName,
        size: transcript.fileSize,
        status: transcript.status,
        contentLength: transcript.contentLength,
        tokenCount: transcript.tokenCount,
        uploadedAt: transcript.createdAt
      },
      session: {
        token: req.session.sessionToken,
        workflowState: req.session.workflowState
      }
    });

  } catch (error) {
    console.error('Upload processing error:', error);

    // Clean up uploaded file if database operation failed
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('File cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'File upload processing failed',
      code: 'PROCESSING_ERROR'
    });
  }
});

// Get transcript by ID
router.get('/:id', async (req, res) => {
  try {
    const transcript = await MeetingTranscript.findByPk(req.params.id, {
      include: ['summaries', 'session']
    });

    if (!transcript) {
      return res.status(404).json({
        error: 'Transcript not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      transcript: {
        id: transcript.id,
        filename: transcript.originalName,
        size: transcript.fileSize,
        status: transcript.status,
        contentLength: transcript.contentLength,
        tokenCount: transcript.tokenCount,
        uploadedAt: transcript.createdAt,
        summaries: transcript.summaries?.length || 0
      }
    });

  } catch (error) {
    console.error('Get transcript error:', error);
    res.status(500).json({
      error: 'Failed to retrieve transcript',
      code: 'RETRIEVAL_ERROR'
    });
  }
});

// Get transcript content
router.get('/:id/content', async (req, res) => {
  try {
    const transcript = await MeetingTranscript.findByPk(req.params.id);

    if (!transcript) {
      return res.status(404).json({
        error: 'Transcript not found',
        code: 'NOT_FOUND'
      });
    }

    if (!transcript.content) {
      return res.status(400).json({
        error: 'Transcript content not available',
        code: 'NO_CONTENT'
      });
    }

    res.json({
      content: transcript.content,
      contentLength: transcript.contentLength,
      tokenCount: transcript.tokenCount
    });

  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({
      error: 'Failed to retrieve content',
      code: 'CONTENT_ERROR'
    });
  }
});

// Delete transcript
router.delete('/:id', async (req, res) => {
  try {
    const transcript = await MeetingTranscript.findByPk(req.params.id);

    if (!transcript) {
      return res.status(404).json({
        error: 'Transcript not found',
        code: 'NOT_FOUND'
      });
    }

    // Delete physical file
    try {
      await fs.unlink(transcript.filePath);
    } catch (fileError) {
      console.warn('File deletion warning:', fileError.message);
    }

    // Delete database record (cascades to summaries and emails)
    await transcript.destroy();

    res.json({
      message: 'Transcript deleted successfully',
      id: req.params.id
    });

  } catch (error) {
    console.error('Delete transcript error:', error);
    res.status(500).json({
      error: 'Failed to delete transcript',
      code: 'DELETE_ERROR'
    });
  }
});

// List user's transcripts
router.get('/session/:sessionToken', async (req, res) => {
  try {
    const session = await UserSession.findByToken(req.params.sessionToken);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const transcripts = await MeetingTranscript.findBySession(session.id);

    res.json({
      transcripts: transcripts.map(t => ({
        id: t.id,
        filename: t.originalName,
        size: t.fileSize,
        status: t.status,
        uploadedAt: t.createdAt,
        summaries: t.summaries?.length || 0
      })),
      session: {
        workflowState: session.workflowState,
        statistics: session.statistics
      }
    });

  } catch (error) {
    console.error('List transcripts error:', error);
    res.status(500).json({
      error: 'Failed to list transcripts',
      code: 'LIST_ERROR'
    });
  }
});

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 10MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Only one file allowed.',
        code: 'TOO_MANY_FILES'
      });
    }
  }

  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }

  console.error('Upload middleware error:', error);
  res.status(500).json({
    error: 'Upload failed',
    code: 'UPLOAD_ERROR'
  });
});

module.exports = router;
