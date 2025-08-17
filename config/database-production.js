const { Sequelize } = require('sequelize');

/**
 * Production Database Configuration
 * Supports PostgreSQL with connection pooling and SSL
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Database URL from environment (Railway, Render, etc. provide this)
const databaseUrl = process.env.DATABASE_URL;

// Fallback to individual environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'meeting_summarizer',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

// Production Sequelize configuration
const sequelizeConfig = {
  dialect: 'postgres',
  logging: isProduction ? false : console.log,
  
  // Connection pooling for production
  pool: {
    max: isProduction ? 10 : 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  
  // SSL configuration for production
  dialectOptions: isProduction ? {
    ssl: {
      require: true,
      rejectUnauthorized: false, // For Railway, Render, etc.
    },
  } : {},
  
  // Retry configuration
  retry: {
    max: 3,
    timeout: 60000,
  },
  
  // Query timeout
  query: {
    timeout: 60000,
  },
  
  // Timezone
  timezone: '+00:00',
  
  // Define options
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true,
  },
};

// Create Sequelize instance
let sequelize;

if (databaseUrl) {
  // Use DATABASE_URL (preferred for cloud platforms)
  console.log('🔗 Connecting to database using DATABASE_URL...');
  sequelize = new Sequelize(databaseUrl, sequelizeConfig);
} else {
  // Use individual config variables
  console.log('🔗 Connecting to database using individual config...');
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      ...sequelizeConfig,
      host: dbConfig.host,
      port: dbConfig.port,
    }
  );
}

/**
 * Test database connection
 */
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error.message);
    return false;
  }
};

/**
 * Initialize database with proper error handling
 */
const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database...');
    
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }
    
    // Sync models (create tables if they don't exist)
    await sequelize.sync({ 
      force: false, // Never drop tables in production
      alter: isProduction ? false : true, // Only alter in development
    });
    
    console.log('✅ Database synchronized successfully.');
    return sequelize;
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

/**
 * Graceful database shutdown
 */
const closeDatabase = async () => {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed.');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
};

// Handle process termination
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);

module.exports = {
  sequelize,
  testConnection,
  initializeDatabase,
  closeDatabase,
  isProduction,
  isDevelopment,
};
