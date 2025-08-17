const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const docxParser = require('docx-parser');
const { MeetingTranscript, UserSession } = require('../models');
const { validateSession, updateWorkflowState, updateSessionStats, findSessionByToken } = require('../middleware/sessionMiddleware');
const {
  validationRules,
  handleValidationErrors,
  sanitizeRequestBody,
  preventSQLInjection,
  sanitizeFileName
} = require('../middleware/validation');
const {
  performSecurityCheck,
  secureCleanup
} = require('../middleware/fileSecurity');

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
  const allowedTypes = ['.txt', '.md', '.doc', '.docx', '.pdf', '.rtf'];
  const allowedMimeTypes = [
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'application/rtf',
    'text/rtf',
    // Additional MIME types for better compatibility
    'application/vnd.ms-word',
    'application/x-msword'
  ];

  // Sanitize original filename
  const sanitizedOriginalName = sanitizeFileName(file.originalname);
  if (sanitizedOriginalName !== file.originalname) {
    return cb(new Error('File name contains invalid characters'), false);
  }

  const fileExtension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  // Check for null bytes and path traversal in filename
  if (file.originalname.includes('\0') || file.originalname.includes('..')) {
    return cb(new Error('Invalid file name detected'), false);
  }

  // Check file size (additional check beyond multer limits)
  if (file.size && file.size > 10485760) { // 10MB
    return cb(new Error('File size exceeds 10MB limit'), false);
  }

  // Check both extension and MIME type for security
  if (allowedTypes.includes(fileExtension) && allowedMimeTypes.includes(mimeType)) {
    // Additional security: check for executable extensions hidden in filename
    const dangerousPatterns = /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|app|deb|pkg|dmg)$/i;
    if (dangerousPatterns.test(file.originalname)) {
      return cb(new Error('Potentially dangerous file type detected'), false);
    }

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

    // Handle .docx files with mammoth
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const result = await mammoth.extractRawText({ path: filePath });
        const content = result.value;

        if (!content || content.trim().length === 0) {
          throw new Error('No text content found in document');
        }

        return {
          content: content.trim(),
          contentLength: content.length,
          tokenCount: Math.ceil(content.length / 4)
        };
      } catch (docxError) {
        console.error('❌ Mammoth DOCX extraction failed:', docxError.message);

        // Fallback 1: Try alternative DOCX parser
        try {
          console.log(`🔄 Trying alternative DOCX parser...`);
          const buffer = await fs.readFile(filePath);
          const docxText = await docxParser.parseDocx(buffer);

          if (docxText && docxText.trim().length > 10) {
            console.log(`✅ Alternative DOCX parser successful: ${docxText.length} characters`);
            return {
              content: docxText.trim(),
              contentLength: docxText.length,
              tokenCount: Math.ceil(docxText.length / 4)
            };
          }

          throw new Error('Alternative parser found no content');

        } catch (altParserError) {
          console.log(`❌ Alternative DOCX parser failed: ${altParserError.message}`);

          // Fallback 2: Try reading as buffer and extracting text manually
          try {
            console.log(`🔄 Trying manual DOCX text extraction...`);
            const buffer = await fs.readFile(filePath);

            // Try to extract readable text from the buffer
            let extractedText = '';
            const bufferStr = buffer.toString('utf8');

            // Look for text patterns in DOCX (XML-based)
            const textMatches = bufferStr.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
            if (textMatches) {
              extractedText = textMatches
                .map(match => match.replace(/<w:t[^>]*>([^<]+)<\/w:t>/, '$1'))
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            }

            // If no XML text found, try basic text extraction
            if (!extractedText || extractedText.length < 10) {
              extractedText = bufferStr
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, ' ')
                .replace(/[<>{}[\]]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            }

            if (extractedText && extractedText.length >= 10) {
              console.log(`✅ Fallback DOCX extraction successful: ${extractedText.length} characters`);
              return {
                content: extractedText,
                contentLength: extractedText.length,
                tokenCount: Math.ceil(extractedText.length / 4)
              };
            }

            throw new Error('No readable text found in DOCX file');

          } catch (manualError) {
            console.error('❌ Manual DOCX extraction also failed:', manualError.message);

            // Final fallback: Create a meaningful error message for the user
            const errorContent = `[DOCX Processing Error]

The uploaded DOCX file could not be processed due to technical limitations.

Error Details: ${docxError.message}

Recommendations:
1. Try saving the document as a .txt file and re-uploading
2. Copy and paste the content into a new .txt file
3. Ensure the DOCX file is not corrupted
4. Try using a different version of the document

File Information:
- Original Name: ${path.basename(filePath)}
- Processing Date: ${new Date().toISOString()}

Please convert this document to a plain text format for reliable processing.`;

            return {
              content: errorContent,
              contentLength: errorContent.length,
              tokenCount: Math.ceil(errorContent.length / 4)
            };
          }
        }
      }
    }

    // Handle .doc files (legacy format) with improved extraction
    if (mimeType === 'application/msword' || mimeType === 'application/vnd.ms-word' || mimeType === 'application/x-msword') {
      try {
        // Try mammoth first (it can handle some .doc files)
        const result = await mammoth.extractRawText({ path: filePath });
        const content = result.value;

        if (content && content.trim().length > 50) {
          return {
            content: content.trim(),
            contentLength: content.length,
            tokenCount: Math.ceil(content.length / 4)
          };
        }
        throw new Error('Insufficient content extracted');
      } catch (docError) {
        console.warn('Mammoth failed for .doc file, trying fallback method:', docError.message);
        // Fallback: basic text extraction
        const buffer = await fs.readFile(filePath);
        const content = buffer.toString('utf8')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (content.length < 50) {
          const placeholderContent = `[Document uploaded: ${path.basename(filePath)}]\n\nLegacy .doc format detected. Unable to extract content. Please convert to .docx or .txt format and upload again.`;
          return {
            content: placeholderContent,
            contentLength: placeholderContent.length,
            tokenCount: Math.ceil(placeholderContent.length / 4)
          };
        }

        return {
          content: content,
          contentLength: content.length,
          tokenCount: Math.ceil(content.length / 4)
        };
      }
    }

    // Handle PDF files
    if (mimeType === 'application/pdf') {
      try {
        const buffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(buffer);

        if (!pdfData.text || pdfData.text.trim().length === 0) {
          throw new Error('No text content found in PDF');
        }

        return {
          content: pdfData.text.trim(),
          contentLength: pdfData.text.length,
          tokenCount: Math.ceil(pdfData.text.length / 4)
        };
      } catch (pdfError) {
        console.error('Error extracting PDF content:', pdfError);
        const placeholderContent = `[PDF uploaded: ${path.basename(filePath)}]\n\nError extracting content from PDF file: ${pdfError.message}\n\nPlease ensure the PDF contains extractable text.`;
        return {
          content: placeholderContent,
          contentLength: placeholderContent.length,
          tokenCount: Math.ceil(placeholderContent.length / 4)
        };
      }
    }

    // Handle RTF files
    if (mimeType === 'application/rtf' || mimeType === 'text/rtf') {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        // Remove RTF control codes and extract plain text
        const plainText = content
          .replace(/\\[a-z]+\d*\s?/g, ' ') // Remove RTF control words
          .replace(/[{}]/g, ' ') // Remove braces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        if (plainText.length < 10) {
          throw new Error('Unable to extract readable content from RTF file');
        }

        return {
          content: plainText,
          contentLength: plainText.length,
          tokenCount: Math.ceil(plainText.length / 4)
        };
      } catch (rtfError) {
        console.error('Error extracting RTF content:', rtfError);
        const placeholderContent = `[RTF uploaded: ${path.basename(filePath)}]\n\nError extracting content from RTF file: ${rtfError.message}\n\nPlease convert to .txt or .docx format.`;
        return {
          content: placeholderContent,
          contentLength: placeholderContent.length,
          tokenCount: Math.ceil(placeholderContent.length / 4)
        };
      }
    }

    // For other file types, return empty but processable content
    const emptyContent = `[File uploaded: ${path.basename(filePath)}]\n\nContent extraction not supported for this file type. Supported formats: .txt, .md, .doc, .docx, .pdf, .rtf`;
    return {
      content: emptyContent,
      contentLength: emptyContent.length,
      tokenCount: Math.ceil(emptyContent.length / 4)
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
router.post('/',
  validateSession,
  preventSQLInjection,
  sanitizeRequestBody,
  upload.single('transcript'),
  validationRules.fileUpload,
  handleValidationErrors,
  async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    // Perform comprehensive security check
    console.log(`🔒 Performing security check on uploaded file: ${req.file.originalname}`);
    const securityCheck = await performSecurityCheck(req.file.path, req.file.mimetype);

    if (!securityCheck.safe) {
      console.error(`❌ Security check failed for file: ${req.file.originalname}`, securityCheck.reason);

      // Clean up the uploaded file
      await secureCleanup(req.file.path);

      return res.status(400).json({
        error: 'File failed security validation',
        code: 'SECURITY_CHECK_FAILED',
        reason: securityCheck.reason,
        details: 'The uploaded file contains potentially harmful content and has been rejected.'
      });
    }

    console.log(`✅ Security check passed for file: ${req.file.originalname}`);

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
    await updateWorkflowState(req.session.id, 'instructions');
    await updateSessionStats(req.session.id, { transcriptsProcessed: (req.session.statistics?.transcriptsProcessed || 0) + 1 });

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
        await secureCleanup(req.file.path);
      } catch (cleanupError) {
        console.error('Secure file cleanup error:', cleanupError);
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
    const session = await findSessionByToken(req.params.sessionToken);

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
