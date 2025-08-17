const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Import security middleware
const {
  rateLimitConfigs,
  slowDownConfig,
  helmetConfig,
  corsConfig,
  requestLogger,
  securityMonitor
} = require('./middleware/security');

// Import database models and configuration
const { initializeDatabase, sequelize } = require('./models');
const { testConnection } = require('./config/database');
const { validateGroqConfig } = require('./config/groq');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware - comprehensive implementation
console.log('🔒 Initializing security middleware...');

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security headers
app.use(helmetConfig);

// CORS configuration
app.use(corsConfig);

// Request logging and monitoring
app.use(requestLogger);

// Security monitoring for suspicious patterns
app.use(securityMonitor);

// General rate limiting and slow down
app.use(rateLimitConfigs.general);
app.use(slowDownConfig);

console.log('✅ Security middleware initialized');

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handling middleware
const { errorHandler, userFeedbackSystem } = require('./services/errorHandler');

app.use(async (error, req, res, next) => {
  // Handle errors with comprehensive error management
  const errorContext = {
    component: 'ExpressServer',
    operation: req.method + ' ' + req.path,
    sessionId: req.session?.id,
    userId: req.session?.userId || 'anonymous',
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    requestBody: req.body,
    requestQuery: req.query
  };

  const errorResult = await errorHandler.handleError(error, errorContext);
  const userResponse = userFeedbackSystem.generateErrorResponse(error, errorContext);

  // Log the error
  console.error(`🚨 Unhandled error in ${req.method} ${req.path}:`, error.message);

  // Send user-friendly error response
  res.status(error.status || 500).json(userResponse);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbConnected = await testConnection();

    // Check Groq configuration
    const groqValidation = validateGroqConfig();

    // Check error handling system status
    const errorStats = errorHandler.getErrorStats('1h');
    const errorSystemHealth = {
      status: errorStats.total < 10 ? 'healthy' : errorStats.total < 50 ? 'warning' : 'degraded',
      errorsLastHour: errorStats.total,
      criticalErrors: errorStats.bySeverity?.critical || 0,
      loggedErrors: errorHandler.errorLog.length
    };

    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: dbConnected ? 'connected' : 'disconnected',
          type: 'SQLite'
        },
        groq: {
          status: groqValidation.isValid ? 'configured' : 'not_configured',
          primaryModel: groqValidation.config.primaryModel,
          fallbackModel: groqValidation.config.fallbackModel,
          apiKey: groqValidation.config.apiKey
        },
        errorHandling: errorSystemHealth
      }
    };

    // Set appropriate status code
    const allServicesOk = dbConnected && groqValidation.isValid;
    res.status(allServicesOk ? 200 : 503).json(health);

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API routes with specific rate limiting
console.log('🔗 Configuring API routes with security...');

// File upload routes (most restrictive)
app.use('/api/upload', rateLimitConfigs.upload, require('./routes/upload'));

// Summary generation routes (AI processing - very restrictive)
app.use('/api/summaries', rateLimitConfigs.aiProcessing, require('./routes/summaries'));

// Email routes (moderately restrictive)
app.use('/api/email', rateLimitConfigs.email, require('./routes/email'));

// Instructions and error routes (general rate limiting)
app.use('/api/instructions', require('./routes/instructions'));
app.use('/api/errors', require('./routes/errors'));

console.log('✅ API routes configured with security');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database initialization and server startup
const startServer = async () => {
  try {
    // Initialize database
    console.log('🔄 Initializing database...');
    const dbInitialized = await initializeDatabase();

    if (!dbInitialized) {
      console.error('❌ Database initialization failed. Server not started.');
      process.exit(1);
    }

    // Start server
    app.listen(PORT, () => {
      console.log('✅ Database connected and synchronized');
      console.log(`🚀 Meeting Summarizer server running on port ${PORT} (Production Ready)`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`💾 Database: PostgreSQL`);
    });

  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  try {
    await sequelize.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  try {
    await sequelize.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
});

// Start the server
startServer();

module.exports = app;
