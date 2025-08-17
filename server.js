const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import database models and configuration
const { initializeDatabase, sequelize } = require('./models');
const { testConnection } = require('./config/database');
const { validateGroqConfig } = require('./config/groq');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbConnected = await testConnection();

    // Check Groq configuration
    const groqValidation = validateGroqConfig();

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
        }
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

// API routes
app.use('/api/upload', require('./routes/upload'));
app.use('/api/instructions', require('./routes/instructions'));
app.use('/api/summary', require('./routes/summary'));
app.use('/api/email', require('./routes/email'));

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
      console.log(`🚀 Meeting Summarizer server running on port ${PORT}`);
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
