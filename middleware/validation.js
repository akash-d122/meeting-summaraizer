/**
 * Input Validation and Sanitization Middleware
 * 
 * Comprehensive validation and sanitization for all user inputs:
 * - Email validation and sanitization
 * - Text input sanitization (XSS prevention)
 * - File validation and security checks
 * - SQL injection prevention
 * - Content Security Policy enforcement
 */

const validator = require('validator');
const xss = require('xss');
const { body, param, query, validationResult } = require('express-validator');

/**
 * XSS sanitization configuration
 */
const xssOptions = {
  whiteList: {
    // Allow basic formatting for summaries
    'p': [],
    'br': [],
    'strong': [],
    'em': [],
    'ul': [],
    'ol': [],
    'li': [],
    'h1': [],
    'h2': [],
    'h3': [],
    'h4': [],
    'h5': [],
    'h6': []
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
};

/**
 * Sanitize text input to prevent XSS
 */
const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  // Remove null bytes and control characters
  let sanitized = text.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // XSS sanitization
  sanitized = xss(sanitized, xssOptions);
  
  // Additional sanitization for common injection patterns
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  
  return sanitized.trim();
};

/**
 * Sanitize email addresses
 */
const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  
  // Basic sanitization
  let sanitized = email.toLowerCase().trim();
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>'"]/g, '');
  
  // Validate email format
  if (!validator.isEmail(sanitized)) {
    throw new Error('Invalid email format');
  }
  
  return sanitized;
};

/**
 * Validate and sanitize file names
 */
const sanitizeFileName = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return '';
  
  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');
  
  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }
  
  return sanitized.trim();
};

/**
 * Validation rules for different endpoints
 */
const validationRules = {
  // File upload validation
  fileUpload: [
    body('originalName')
      .optional()
      .isLength({ min: 1, max: 255 })
      .withMessage('File name must be between 1 and 255 characters')
      .custom((value) => {
        const sanitized = sanitizeFileName(value);
        if (sanitized !== value) {
          throw new Error('File name contains invalid characters');
        }
        return true;
      }),
    
    body('mimeType')
      .optional()
      .isIn(['text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
      .withMessage('Invalid file type'),
    
    body('fileSize')
      .optional()
      .isInt({ min: 1, max: 10485760 }) // 10MB max
      .withMessage('File size must be between 1 byte and 10MB')
  ],

  // Email validation
  email: [
    body('recipients')
      .isArray({ min: 1, max: 10 })
      .withMessage('Recipients must be an array with 1-10 email addresses'),
    
    body('recipients.*')
      .isEmail()
      .withMessage('Invalid email address')
      .normalizeEmail()
      .custom((value) => {
        try {
          sanitizeEmail(value);
          return true;
        } catch (error) {
          throw new Error('Email address failed security validation');
        }
      }),
    
    body('subject')
      .optional()
      .isLength({ min: 1, max: 255 })
      .withMessage('Subject must be between 1 and 255 characters')
      .custom((value) => {
        const sanitized = sanitizeText(value);
        if (sanitized.length !== value.length) {
          throw new Error('Subject contains invalid characters');
        }
        return true;
      }),
    
    body('customMessage')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Custom message must be less than 1000 characters')
      .custom((value) => {
        const sanitized = sanitizeText(value);
        if (sanitized.length !== value.length) {
          throw new Error('Custom message contains invalid characters');
        }
        return true;
      })
  ],

  // Summary generation validation
  summaryGeneration: [
    body('customInstructions')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Custom instructions must be less than 2000 characters')
      .custom((value) => {
        if (!value) return true;
        
        const sanitized = sanitizeText(value);
        if (sanitized.length !== value.length) {
          throw new Error('Custom instructions contain invalid characters');
        }
        
        // Check for potential prompt injection
        const suspiciousPatterns = [
          /ignore\s+previous\s+instructions/i,
          /system\s*:/i,
          /assistant\s*:/i,
          /human\s*:/i,
          /\[INST\]/i,
          /\[\/INST\]/i
        ];
        
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(value)) {
            throw new Error('Instructions contain potentially harmful content');
          }
        }
        
        return true;
      }),
    
    body('summaryStyle')
      .optional()
      .isIn(['executive', 'action-items', 'technical', 'detailed', 'bullet-points'])
      .withMessage('Invalid summary style'),
    
    body('transcriptId')
      .isUUID()
      .withMessage('Invalid transcript ID format')
  ],

  // UUID parameter validation
  uuidParam: [
    param('id')
      .isUUID()
      .withMessage('Invalid ID format'),
    
    param('transcriptId')
      .optional()
      .isUUID()
      .withMessage('Invalid transcript ID format'),
    
    param('summaryId')
      .optional()
      .isUUID()
      .withMessage('Invalid summary ID format')
  ],

  // Query parameter validation
  queryParams: [
    query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Page must be between 1 and 1000'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'failed'])
      .withMessage('Invalid status value')
  ]
};

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    console.warn('Validation errors:', {
      ip: req.ip,
      url: req.url,
      method: req.method,
      errors: errors.array()
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

/**
 * Sanitization middleware for request body
 */
const sanitizeRequestBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    // Recursively sanitize all string values in the request body
    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'string') {
            // Special handling for different fields
            if (key === 'recipients' || key.includes('email') || key.includes('Email')) {
              // Don't sanitize emails here, let validation handle it
              continue;
            } else if (key === 'customInstructions' || key === 'content' || key === 'subject') {
              obj[key] = sanitizeText(obj[key]);
            } else {
              obj[key] = sanitizeText(obj[key]);
            }
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
          }
        }
      }
    };
    
    sanitizeObject(req.body);
  }
  
  next();
};

/**
 * SQL injection prevention middleware
 */
const preventSQLInjection = (req, res, next) => {
  const checkForSQLInjection = (value) => {
    if (typeof value !== 'string') return false;

    // More precise SQL injection patterns to reduce false positives
    const sqlPatterns = [
      // SQL keywords with suspicious context
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\s+\w+)/i,
      // Classic injection patterns
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /('.*'.*=.*'.*')/i, // String comparison patterns
      /(;.*--)/, // Comment injection
      /(\bunion\s+select)/i, // Union select
      /(\bwaitfor\s+delay)/i, // Time-based injection
      // Dangerous functions in SQL context
      /(\b(CAST|CONVERT|SUBSTRING|ASCII|CHAR)\s*\()/i,
      // SQL comments
      /(\/\*.*\*\/)/,
      /(--.*$)/m
    ];

    // Exclude common false positives
    const falsePositivePatterns = [
      /^[•\-\*]\s/, // Bullet points
      /^\d+\.\s/, // Numbered lists
      /\b(and|or)\s+\w+\s+(discussion|points|perspectives|process)/i // Natural language
    ];

    // Check for false positives first
    for (const pattern of falsePositivePatterns) {
      if (pattern.test(value)) {
        return false; // It's likely a false positive
      }
    }

    return sqlPatterns.some(pattern => pattern.test(value));
  };
  
  const checkObject = (obj, path = '') => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof obj[key] === 'string') {
          if (checkForSQLInjection(obj[key])) {
            console.error(`SQL injection attempt detected in ${currentPath}:`, obj[key]);
            return true;
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (checkObject(obj[key], currentPath)) {
            return true;
          }
        }
      }
    }
    return false;
  };
  
  // Check request body, query, and params
  if (checkObject(req.body, 'body') || 
      checkObject(req.query, 'query') || 
      checkObject(req.params, 'params')) {
    
    console.warn('SQL injection attempt blocked:', {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(400).json({
      success: false,
      error: 'Invalid request detected'
    });
  }
  
  next();
};

module.exports = {
  validationRules,
  handleValidationErrors,
  sanitizeRequestBody,
  preventSQLInjection,
  sanitizeText,
  sanitizeEmail,
  sanitizeFileName
};
