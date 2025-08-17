/**
 * Security Middleware
 * 
 * Comprehensive security implementation including:
 * - Rate limiting for API protection
 * - Security headers with Helmet
 * - CORS configuration
 * - Request logging and monitoring
 * - IP-based and session-based rate limiting
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const cors = require('cors');
const securityMonitor = require('../services/securityMonitor');

/**
 * Rate limiting configurations for different endpoints
 */
const rateLimitConfigs = {
  // General API rate limiting
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);

      // Log security event
      securityMonitor.logSecurityEvent(securityMonitor.constructor.EVENT_TYPES.RATE_LIMIT_EXCEEDED, {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        limit: 'general'
      });

      res.status(429).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      });
    }
  }),

  // File upload rate limiting (more restrictive)
  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 uploads per hour
    message: {
      error: 'Too many file uploads from this IP',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: 'Too many file uploads from this IP. Please wait before uploading again.',
        retryAfter: '1 hour'
      });
    }
  }),

  // AI processing rate limiting (very restrictive)
  aiProcessing: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 AI processing requests per hour
    message: {
      error: 'Too many AI processing requests from this IP',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`AI processing rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: 'Too many AI processing requests from this IP. Please wait before generating more summaries.',
        retryAfter: '1 hour'
      });
    }
  }),

  // Email sending rate limiting
  email: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Limit each IP to 20 emails per hour
    message: {
      error: 'Too many email requests from this IP',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`Email rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: 'Too many email requests from this IP. Please wait before sending more emails.',
        retryAfter: '1 hour'
      });
    }
  }),

  // Authentication attempts (very strict)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 auth attempts per 15 minutes
    message: {
      error: 'Too many authentication attempts from this IP',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: 'Too many authentication attempts. Please wait before trying again.',
        retryAfter: '15 minutes'
      });
    }
  })
};

/**
 * Slow down middleware for gradual response delays
 */
const slowDownConfig = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes at full speed
  delayMs: () => 500, // Fixed 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  validate: { delayMs: false }, // Disable warning
  skip: (req, res) => {
    // Skip slow down for static files and health checks
    return req.url.startsWith('/health') || req.url.startsWith('/favicon');
  }
});

/**
 * Helmet security headers configuration
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for development
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * CORS configuration
 */
const corsConfig = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const isProduction = process.env.NODE_ENV === 'production';

    // In development, allow all localhost origins
    if (!isProduction) {
      return callback(null, true);
    }

    // In production, check against allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.CORS_ORIGIN,
      process.env.BACKEND_URL
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow Railway and Render domains
    if (origin && (origin.includes('.railway.app') || origin.includes('.onrender.com'))) {
      return callback(null, true);
    }

    console.warn(`🚫 CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Forwarded-For']
});

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };
    
    // Log security-relevant events
    if (res.statusCode >= 400) {
      console.warn('Security Event:', logData);
    } else if (req.url.includes('/api/')) {
      console.log('API Request:', logData);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * IP whitelist middleware (for admin endpoints)
 */
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
      return next();
    }
    
    console.warn(`Blocked request from unauthorized IP: ${clientIP}`);
    res.status(403).json({
      success: false,
      error: 'Access denied from this IP address'
    });
  };
};

/**
 * Security monitoring middleware
 */
const securityMonitorMiddleware = (req, res, next) => {
  // Monitor for suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript injection
    /vbscript:/i,  // VBScript injection
  ];
  
  const requestData = JSON.stringify(req.body) + req.url + JSON.stringify(req.query);
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      console.error(`Suspicious request detected from IP ${req.ip}:`, {
        pattern: pattern.toString(),
        url: req.url,
        method: req.method,
        body: req.body,
        query: req.query
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid request detected'
      });
    }
  }
  
  next();
};

module.exports = {
  rateLimitConfigs,
  slowDownConfig,
  helmetConfig,
  corsConfig,
  requestLogger,
  ipWhitelist,
  securityMonitor: securityMonitorMiddleware
};
