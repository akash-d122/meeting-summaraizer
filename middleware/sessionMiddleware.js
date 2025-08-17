/**
 * Session Management Middleware
 * 
 * Handles user session creation, validation, and management
 * for the Meeting Summarizer application
 */

const { UserSession } = require('../models');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a new session token
 */
function generateSessionToken() {
  return `session_${Date.now()}_${uuidv4().replace(/-/g, '')}`;
}

/**
 * Create a new user session
 */
async function createSession(req, res) {
  try {
    const sessionToken = generateSessionToken();
    
    const session = await UserSession.create({
      id: uuidv4(),
      sessionToken: sessionToken,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionData: {},
      isActive: true,
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      workflowState: 'upload',
      preferences: {
        defaultSummaryStyle: 'executive',
        emailFormat: 'html',
        autoSave: true
      },
      statistics: {
        transcriptsProcessed: 0,
        summariesGenerated: 0,
        emailsSent: 0,
        totalCost: 0
      }
    });

    console.log(`✅ New session created: ${session.id}`);
    
    return session;
    
  } catch (error) {
    console.error('❌ Failed to create session:', error.message);
    throw error;
  }
}

/**
 * Find existing session by token
 */
async function findSessionByToken(sessionToken) {
  try {
    const session = await UserSession.findOne({
      where: {
        sessionToken: sessionToken,
        isActive: true,
        expiresAt: {
          [require('sequelize').Op.gt]: new Date()
        }
      }
    });

    if (session) {
      // Update last activity
      await session.update({
        lastActivity: new Date()
      });
    }

    return session;
    
  } catch (error) {
    console.error('❌ Failed to find session:', error.message);
    return null;
  }
}

/**
 * Session validation middleware
 * Creates a new session if none exists or if the existing one is invalid
 */
async function validateSession(req, res, next) {
  try {
    let session = null;
    
    // Try to get session token from various sources
    const sessionToken = req.headers['x-session-token'] || 
                         req.body.sessionToken || 
                         req.query.sessionToken ||
                         req.cookies?.sessionToken;

    // If we have a token, try to find the session
    if (sessionToken) {
      session = await findSessionByToken(sessionToken);
    }

    // If no valid session found, create a new one
    if (!session) {
      session = await createSession(req, res);
      
      // Set session token in response header for client to store
      res.setHeader('X-Session-Token', session.sessionToken);
      
      // Also set as cookie for browser convenience
      res.cookie('sessionToken', session.sessionToken, {
        httpOnly: false, // Allow JavaScript access for frontend
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
    }

    // Attach session to request object
    req.session = session;
    
    // Continue to next middleware
    next();
    
  } catch (error) {
    console.error('❌ Session validation failed:', error.message);
    
    // Return error response
    res.status(500).json({
      success: false,
      error: 'Session management failed',
      message: 'Unable to create or validate session'
    });
  }
}

/**
 * Optional session middleware - doesn't create session if none exists
 */
async function optionalSession(req, res, next) {
  try {
    const sessionToken = req.headers['x-session-token'] || 
                         req.body.sessionToken || 
                         req.query.sessionToken ||
                         req.cookies?.sessionToken;

    if (sessionToken) {
      const session = await findSessionByToken(sessionToken);
      if (session) {
        req.session = session;
      }
    }

    next();
    
  } catch (error) {
    console.error('❌ Optional session check failed:', error.message);
    // Continue anyway for optional session
    next();
  }
}

/**
 * Update session workflow state
 */
async function updateWorkflowState(sessionId, newState) {
  try {
    const session = await UserSession.findByPk(sessionId);
    if (session) {
      await session.update({
        workflowState: newState,
        lastActivity: new Date()
      });
      console.log(`📝 Session ${sessionId} workflow updated to: ${newState}`);
    }
  } catch (error) {
    console.error('❌ Failed to update workflow state:', error.message);
  }
}

/**
 * Update session statistics
 */
async function updateSessionStats(sessionId, updates) {
  try {
    const session = await UserSession.findByPk(sessionId);
    if (session) {
      const currentStats = session.statistics || {};
      const newStats = { ...currentStats, ...updates };
      
      await session.update({
        statistics: newStats,
        lastActivity: new Date()
      });
      
      console.log(`📊 Session ${sessionId} statistics updated`);
    }
  } catch (error) {
    console.error('❌ Failed to update session statistics:', error.message);
  }
}

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions() {
  try {
    const expiredCount = await UserSession.destroy({
      where: {
        expiresAt: {
          [require('sequelize').Op.lt]: new Date()
        }
      }
    });
    
    if (expiredCount > 0) {
      console.log(`🧹 Cleaned up ${expiredCount} expired sessions`);
    }
    
    return expiredCount;
    
  } catch (error) {
    console.error('❌ Failed to cleanup expired sessions:', error.message);
    return 0;
  }
}

/**
 * Get session statistics
 */
async function getSessionStats(sessionId) {
  try {
    const session = await UserSession.findByPk(sessionId);
    return session ? session.statistics : null;
  } catch (error) {
    console.error('❌ Failed to get session statistics:', error.message);
    return null;
  }
}

/**
 * Extend session expiration
 */
async function extendSession(sessionId, additionalHours = 24) {
  try {
    const session = await UserSession.findByPk(sessionId);
    if (session) {
      const newExpiration = new Date(Date.now() + additionalHours * 60 * 60 * 1000);
      await session.update({
        expiresAt: newExpiration,
        lastActivity: new Date()
      });
      console.log(`⏰ Session ${sessionId} extended until ${newExpiration}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Failed to extend session:', error.message);
    return false;
  }
}

// Schedule periodic cleanup of expired sessions (every hour)
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = {
  validateSession,
  optionalSession,
  createSession,
  findSessionByToken,
  updateWorkflowState,
  updateSessionStats,
  cleanupExpiredSessions,
  getSessionStats,
  extendSession,
  generateSessionToken
};
