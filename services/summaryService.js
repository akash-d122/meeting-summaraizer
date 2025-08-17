/**
 * Summary Generation Service
 * 
 * Core service that orchestrates meeting summary generation using:
 * - PromptEngine for optimized prompts
 * - Groq SDK for AI processing
 * - Database integration for persistence
 * - Error handling and retry logic
 */

const { getGroqClient, calculateCost, getModelInfo } = require('../config/groq');
const { FallbackDecisionEngine } = require('../config/fallback');
const PromptEngine = require('./promptEngine');
const ResponseProcessor = require('./responseProcessor');
const { errorHandler, userFeedbackSystem, ErrorTypes } = require('./errorHandler');
const { findSessionByToken } = require('../middleware/sessionMiddleware');
const { MeetingTranscript, Summary, UserSession } = require('../models');

class SummaryService {
  constructor() {
    this.promptEngine = new PromptEngine();
    this.responseProcessor = new ResponseProcessor();
    this.primaryModel = getModelInfo('primary');
    this.fallbackModel = getModelInfo('fallback');
    this.fallbackEngine = new FallbackDecisionEngine();

    // Fallback statistics
    this.stats = {
      primaryAttempts: 0,
      fallbackAttempts: 0,
      primarySuccesses: 0,
      fallbackSuccesses: 0,
      totalRetries: 0,
      avgPrimaryTime: 0,
      avgFallbackTime: 0
    };
  }

  /**
   * Generate summary for a meeting transcript
   * 
   * @param {string} transcriptId - Database ID of the transcript
   * @param {Object} options - Generation options
   * @param {string} options.summaryStyle - Style of summary (executive, action-items, etc.)
   * @param {string} options.customInstructions - User's custom instructions
   * @param {string} options.sessionToken - User session token
   * @param {boolean} options.useFallback - Force use of fallback model
   * @returns {Promise<Object>} Generated summary with metadata
   */
  async generateSummary(transcriptId, options = {}) {
    const startTime = Date.now();
    let session = null; // Declare session in outer scope

    try {
      console.log(`🚀 Starting summary generation for transcript: ${transcriptId}`);

      // Step 1: Load and validate transcript
      const transcript = await this.loadTranscript(transcriptId);

      // Step 2: Load user session if provided
      session = options.sessionToken ?
        await findSessionByToken(options.sessionToken) : null;
      
      // Step 3: Build optimized prompt
      const promptData = this.buildPrompt(transcript, options);
      
      // Step 4: Validate prompt before API call
      const validation = this.promptEngine.validatePrompt(promptData);
      if (!validation.isValid) {
        throw new Error(`Prompt validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Step 5: Create database record for tracking
      const summaryRecord = await this.createSummaryRecord(transcript, options, promptData);
      
      // Step 6: Intelligent model selection
      const modelDecision = await this.selectOptimalModel(transcript, promptData, options, session);
      console.log(`🤖 Model selected: ${modelDecision.model} (${modelDecision.reason})`);

      // Step 7: Generate summary with fallback logic
      const result = await this.generateWithFallback(promptData, modelDecision, options);
      
      // Step 8: Process AI response
      const processedResponse = await this.processAIResponse(result, {
        summaryStyle: options.summaryStyle,
        customInstructions: options.customInstructions,
        modelUsed: result.fallbackInfo?.modelUsed || 'primary',
        fallbackUsed: result.fallbackInfo?.fallbackTriggered || false,
        attemptCount: result.fallbackInfo?.attemptCount || 1,
        transcriptId: transcript.id
      });

      // Step 9: Save processed results
      const finalSummary = await this.processSummaryResult(
        summaryRecord,
        result,
        processedResponse,
        startTime,
        session
      );
      
      console.log(`✅ Summary generated successfully: ${finalSummary.id}`);
      return finalSummary;
      
    } catch (error) {
      console.error(`❌ Summary generation failed for ${transcriptId}:`, error.message);

      // Handle error with comprehensive error management
      const errorContext = {
        component: 'SummaryService',
        operation: 'generateSummary',
        transcriptId: transcriptId,
        sessionId: session?.id,
        userId: session?.userId || 'anonymous',
        summaryStyle: options.summaryStyle,
        customInstructions: options.customInstructions,
        modelUsed: options.useFallback ? 'fallback' : 'primary'
      };

      const errorResult = await errorHandler.handleError(error, errorContext);

      // Update summary record with error if it exists
      if (error.summaryId) {
        await this.handleGenerationError(error.summaryId, error, errorResult);
      }

      // Return user-friendly error response
      throw userFeedbackSystem.generateErrorResponse(error, errorContext);
    }
  }

  /**
   * Load transcript from database with validation
   */
  async loadTranscript(transcriptId) {
    try {
      const transcript = await MeetingTranscript.findByPk(transcriptId);

      if (!transcript) {
        const error = new Error(`Transcript not found: ${transcriptId}`);
        error.type = ErrorTypes.TRANSCRIPT_ERROR;
        throw error;
      }

      if (transcript.status !== 'processed') {
        const error = new Error(`Transcript not ready for processing: ${transcript.status}`);
        error.type = ErrorTypes.TRANSCRIPT_ERROR;
        throw error;
      }

      if (!transcript.content || transcript.content.trim().length === 0) {
        const error = new Error('Transcript content is empty');
        error.type = ErrorTypes.CONTENT_ERROR;
        throw error;
      }

      console.log(`📄 Loaded transcript: ${transcript.originalName} (${transcript.contentLength} chars)`);
      return transcript;

    } catch (error) {
      if (!error.type) {
        error.type = ErrorTypes.DATABASE_ERROR;
      }
      throw error;
    }
  }

  /**
   * Build optimized prompt using PromptEngine
   */
  buildPrompt(transcript, options) {
    const {
      summaryStyle = 'executive',
      customInstructions = ''
    } = options;
    
    // Extract metadata from transcript
    const metadata = {
      date: transcript.createdAt?.toISOString()?.split('T')[0],
      filename: transcript.originalName,
      ...transcript.metadata
    };
    
    const promptData = this.promptEngine.buildSummaryPrompt(
      transcript.content,
      {
        summaryStyle,
        customInstructions,
        transcriptMetadata: metadata
      }
    );
    
    const stats = this.promptEngine.getPromptStats(promptData);
    console.log(`🧠 Prompt built: ${stats.totalEstimatedTokens} tokens, $${stats.estimatedCost.toFixed(6)} estimated cost`);
    
    return promptData;
  }

  /**
   * Create summary record in database for tracking
   */
  async createSummaryRecord(transcript, options, promptData) {
    const stats = this.promptEngine.getPromptStats(promptData);
    
    const summaryData = {
      transcriptId: transcript.id,
      summaryStyle: options.summaryStyle || 'executive',
      customInstructions: options.customInstructions || '',
      aiModel: options.useFallback ? this.fallbackModel.name : this.primaryModel.name,
      status: 'generating',
      tokenUsage: {
        estimatedInputTokens: stats.totalEstimatedTokens,
        maxOutputTokens: stats.maxOutputTokens,
        totalTokens: 0 // Will be updated after generation
      },
      cost: 0, // Will be updated after generation
      metadata: {
        promptStats: stats,
        generationStarted: new Date(),
        temperature: promptData.temperature,
        maxTokens: promptData.maxTokens
      }
    };
    
    const summary = await Summary.create(summaryData);
    console.log(`📝 Created summary record: ${summary.id}`);
    
    return summary;
  }

  /**
   * Select optimal model based on context and fallback logic
   */
  async selectOptimalModel(transcript, promptData, options, session) {
    const stats = this.promptEngine.getPromptStats(promptData);

    // Get session history for decision making
    const sessionHistory = session ? await this.getSessionHistory(session.id) : null;

    // Build context for decision engine
    const context = {
      summaryStyle: options.summaryStyle || 'executive',
      estimatedTokens: stats.totalEstimatedTokens,
      estimatedCost: stats.estimatedCost,
      userPreference: options.useFallback ? 'fallback' : options.forceModel,
      sessionHistory: sessionHistory,
      urgency: options.urgency || 'normal',
      transcriptSize: transcript.contentLength,
      customInstructions: options.customInstructions
    };

    // Use fallback decision engine
    const decision = this.fallbackEngine.selectModel(context);

    // Add additional metadata
    decision.context = context;
    decision.timestamp = new Date();

    return decision;
  }

  /**
   * Generate summary with intelligent fallback logic
   */
  async generateWithFallback(promptData, modelDecision, options) {
    const maxRetries = this.fallbackEngine.config.retryConfig.maxRetries;
    let lastError = null;
    let attemptCount = 0;
    let currentModel = modelDecision.model;

    while (attemptCount < maxRetries) {
      attemptCount++;

      try {
        console.log(`🔄 Attempt ${attemptCount}: Using ${currentModel} model`);

        const result = await this.callGroqAPI(promptData, currentModel === 'fallback');

        // Update success statistics
        this.updateStats(currentModel, true, result.processingTime);

        // Add fallback metadata to result
        result.fallbackInfo = {
          modelUsed: currentModel,
          originalDecision: modelDecision,
          attemptCount: attemptCount,
          fallbackTriggered: currentModel !== modelDecision.model
        };

        return result;

      } catch (error) {
        lastError = error;
        console.error(`❌ ${currentModel} model failed (attempt ${attemptCount}):`, error.message);

        // Update failure statistics
        this.updateStats(currentModel, false, 0);

        // Check if error is retryable
        if (!this.fallbackEngine.isRetryableError(error)) {
          console.log('🚫 Non-retryable error, stopping attempts');
          break;
        }

        // Decide on next action
        const nextAction = this.decideNextAction(currentModel, error, attemptCount, maxRetries);

        if (nextAction.action === 'switch_model') {
          currentModel = nextAction.model;
          console.log(`🔄 Switching to ${currentModel} model`);
        } else if (nextAction.action === 'retry_same') {
          console.log(`⏳ Retrying with ${currentModel} model after delay`);
          await this.delay(this.fallbackEngine.calculateRetryDelay(attemptCount));
        } else if (nextAction.action === 'stop') {
          console.log('🛑 Stopping retry attempts');
          break;
        }
      }
    }

    // All attempts failed
    this.stats.totalRetries += attemptCount - 1;
    throw new Error(`Summary generation failed after ${attemptCount} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Decide next action after failure
   */
  decideNextAction(currentModel, error, attemptCount, maxRetries) {
    // If we're on the last attempt, stop
    if (attemptCount >= maxRetries) {
      return { action: 'stop' };
    }

    // If we're using primary model and it's a retryable error, try fallback
    if (currentModel === 'primary' && this.fallbackEngine.isRetryableError(error)) {
      return { action: 'switch_model', model: 'fallback' };
    }

    // If we're using fallback model, retry same model with delay
    if (currentModel === 'fallback') {
      return { action: 'retry_same' };
    }

    // Default: retry same model
    return { action: 'retry_same' };
  }

  /**
   * Update internal statistics
   */
  updateStats(model, success, processingTime) {
    if (model === 'primary') {
      this.stats.primaryAttempts++;
      if (success) {
        this.stats.primarySuccesses++;
        this.stats.avgPrimaryTime = (this.stats.avgPrimaryTime + processingTime) / 2;
      }
    } else {
      this.stats.fallbackAttempts++;
      if (success) {
        this.stats.fallbackSuccesses++;
        this.stats.avgFallbackTime = (this.stats.avgFallbackTime + processingTime) / 2;
      }
    }
  }

  /**
   * Get session history for decision making
   */
  async getSessionHistory(sessionId, limit = 10) {
    try {
      const summaries = await Summary.findAll({
        include: [{
          model: MeetingTranscript,
          as: 'MeetingTranscript',
          where: { sessionId: sessionId },
          attributes: []
        }],
        attributes: ['aiModel', 'status', 'processingTime', 'cost', 'summaryStyle', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: limit
      });

      return summaries.map(s => ({
        model: s.aiModel,
        status: s.status,
        processingTime: s.processingTime,
        cost: s.cost,
        style: s.summaryStyle,
        timestamp: s.createdAt
      }));
    } catch (error) {
      console.error('Failed to get session history:', error.message);
      return null;
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Call Groq API with optimized parameters
   */
  async callGroqAPI(promptData, useFallback = false) {
    const groq = getGroqClient();
    const model = useFallback ? this.fallbackModel : this.primaryModel;
    
    console.log(`🤖 Calling Groq API with ${model.name}...`);
    
    const requestStart = Date.now();
    
    try {
      const completion = await groq.chat.completions.create({
        model: model.name,
        messages: promptData.messages,
        max_tokens: promptData.maxTokens,
        temperature: promptData.temperature,
        stream: false, // We'll implement streaming in a future enhancement
        // Add additional parameters for better control
        top_p: 0.9,
        frequency_penalty: 0.1, // Reduce repetition
        presence_penalty: 0.1   // Encourage diverse content
      });
      
      const requestTime = Date.now() - requestStart;
      
      // Validate response
      if (!completion.choices || completion.choices.length === 0) {
        throw new Error('No completion choices returned from Groq API');
      }
      
      const content = completion.choices[0]?.message?.content;
      if (!content || content.trim().length === 0) {
        throw new Error('Empty content returned from Groq API');
      }
      
      console.log(`✅ Groq API response received: ${content.length} chars in ${requestTime}ms`);
      
      return {
        content: content.trim(),
        usage: completion.usage,
        model: completion.model,
        requestId: completion.id,
        processingTime: requestTime,
        finishReason: completion.choices[0]?.finish_reason
      };
      
    } catch (error) {
      console.error(`❌ Groq API call failed:`, error.message);

      // Enhanced error handling with proper error types
      if (error.status === 429) {
        const rateLimitError = new Error('Rate limit exceeded. Please try again in a moment.');
        rateLimitError.type = ErrorTypes.RATE_LIMIT_ERROR;
        rateLimitError.status = 429;
        throw rateLimitError;
      } else if (error.status === 401) {
        const authError = new Error('Invalid API key. Please check your Groq configuration.');
        authError.type = ErrorTypes.AUTHENTICATION_ERROR;
        authError.status = 401;
        throw authError;
      } else if (error.status === 400) {
        const validationError = new Error(`Invalid request: ${error.error?.message || error.message}`);
        validationError.type = ErrorTypes.VALIDATION_ERROR;
        validationError.status = 400;
        throw validationError;
      } else if (error.status >= 500) {
        const serviceError = new Error('Groq service temporarily unavailable. Please try again.');
        serviceError.type = ErrorTypes.SERVICE_UNAVAILABLE;
        serviceError.status = error.status;
        throw serviceError;
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        const networkError = new Error('Network connection failed. Please check your internet connection.');
        networkError.type = ErrorTypes.NETWORK_ERROR;
        networkError.code = error.code;
        throw networkError;
      } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        const timeoutError = new Error('Request timed out. Please try again.');
        timeoutError.type = ErrorTypes.TIMEOUT_ERROR;
        throw timeoutError;
      }

      // Default API error
      error.type = ErrorTypes.API_ERROR;
      throw error;
    }
  }

  /**
   * Process AI response using ResponseProcessor
   */
  async processAIResponse(result, context) {
    try {
      console.log('📝 Processing AI response...');

      const processedResponse = await this.responseProcessor.processResponse(result, context);

      if (!processedResponse.success) {
        console.warn('⚠️ Response processing had issues:', processedResponse.error);
      }

      console.log(`✅ Response processed: Quality ${processedResponse.content.quality.grade}, ${processedResponse.content.structure.actionItems.length} actions`);

      return processedResponse;

    } catch (error) {
      console.error('❌ Response processing failed:', error.message);

      // Return a minimal processed response for error cases
      return {
        success: false,
        error: error.message,
        content: {
          raw: result.content || '',
          normalized: result.content || '',
          structure: { headings: [], actionItems: [], decisions: [] },
          analysis: { readability: { score: 0 }, completeness: { score: 0 } },
          quality: { score: 0, grade: 'F', issues: [error.message] }
        },
        metadata: {
          model: { name: context.modelUsed || 'unknown', type: 'unknown' },
          usage: { totalTokens: 0 },
          cost: { total: 0 },
          processing: { processingTime: 0 },
          metrics: { qualityScore: 0, qualityGrade: 'F' },
          context: context
        },
        formats: {},
        validation: { isValid: false, errors: [error.message] }
      };
    }
  }

  /**
   * Process API result and update database
   */
  async processSummaryResult(summaryRecord, result, processedResponse, startTime, session) {
    const totalTime = Date.now() - startTime;
    const cost = processedResponse.metadata.cost.total;

    // Update summary record with processed results
    await summaryRecord.update({
      content: processedResponse.content.normalized,
      status: processedResponse.success ? 'completed' : 'error',
      processingTime: totalTime,
      tokenUsage: {
        inputTokens: processedResponse.metadata.usage.inputTokens,
        outputTokens: processedResponse.metadata.usage.outputTokens,
        totalTokens: processedResponse.metadata.usage.totalTokens
      },
      cost: cost,
      quality: Math.max(1, Math.min(5, Math.round(processedResponse.content.quality.score * 5))),
      metadata: {
        ...summaryRecord.metadata,
        groqRequestId: result.requestId,
        finishReason: result.finishReason,
        actualModel: result.model,
        generationCompleted: new Date(),
        apiProcessingTime: result.processingTime,
        // Add processed response metadata
        responseProcessing: {
          qualityGrade: processedResponse.content.quality.grade,
          qualityScore: processedResponse.content.quality.score,
          readabilityScore: processedResponse.content.analysis.readability.score,
          completenessScore: processedResponse.content.analysis.completeness.score,
          actionItemsCount: processedResponse.content.structure.actionItems.length,
          decisionsCount: processedResponse.content.structure.decisions.length,
          processingTime: processedResponse.metadata.processingTime,
          validationIssues: processedResponse.validation.errors || [],
          validationWarnings: processedResponse.validation.warnings || []
        },
        // Store structured data for future use
        structuredData: {
          headings: processedResponse.content.structure.headings,
          actionItems: processedResponse.content.structure.actionItems,
          decisions: processedResponse.content.structure.decisions,
          insights: processedResponse.content.structure.insights,
          entities: processedResponse.content.analysis.entities
        },
        // Store multiple formats
        formats: processedResponse.formats
      }
    });
    
    // Update user session statistics if available
    if (session) {
      await session.updateStatistics({
        summariesGenerated: (session.statistics?.summariesGenerated || 0) + 1,
        totalCost: (session.statistics?.totalCost || 0) + cost
      });
      
      await session.updateWorkflowState('summary', null, summaryRecord.id);
    }
    
    console.log(`📊 Summary completed: ${processedResponse.metadata.usage.totalTokens} tokens, $${cost.toFixed(6)} cost, ${totalTime}ms total`);

    return {
      id: summaryRecord.id,
      content: processedResponse.content.normalized,
      rawContent: processedResponse.content.raw,
      summaryStyle: summaryRecord.summaryStyle,
      processingTime: totalTime,
      tokenUsage: processedResponse.metadata.usage,
      cost: cost,
      model: result.model,
      createdAt: summaryRecord.createdAt,
      metadata: summaryRecord.metadata,
      // Add processed response data
      quality: {
        score: processedResponse.content.quality.score,
        grade: processedResponse.content.quality.grade,
        issues: processedResponse.content.quality.issues,
        strengths: processedResponse.content.quality.strengths
      },
      structure: {
        headings: processedResponse.content.structure.headings.length,
        actionItems: processedResponse.content.structure.actionItems.length,
        decisions: processedResponse.content.structure.decisions.length,
        insights: processedResponse.content.structure.insights.length
      },
      analysis: {
        readability: processedResponse.content.analysis.readability,
        sentiment: processedResponse.content.analysis.sentiment,
        completeness: processedResponse.content.analysis.completeness,
        actionability: processedResponse.content.analysis.actionability
      },
      formats: processedResponse.formats,
      validation: processedResponse.validation
    };
  }

  /**
   * Handle generation errors with comprehensive error tracking
   */
  async handleGenerationError(summaryId, error, errorResult = null) {
    try {
      const summary = await Summary.findByPk(summaryId);
      if (summary) {
        await summary.update({
          status: 'error',
          generationError: error.message,
          metadata: {
            ...summary.metadata,
            errorOccurred: new Date(),
            errorDetails: {
              message: error.message,
              type: error.type || 'unknown',
              status: error.status,
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
              errorId: errorResult?.error?.errorId,
              severity: errorResult?.error?.severity,
              retryable: errorResult?.error?.retryable,
              recoveryPlan: errorResult?.error?.recoveryPlan
            }
          }
        });

        console.log(`📝 Updated summary ${summaryId} with error details`);
      }
    } catch (updateError) {
      console.error('Failed to update summary error status:', updateError.message);

      // Log the update error as well
      await errorHandler.handleError(updateError, {
        component: 'SummaryService',
        operation: 'handleGenerationError',
        summaryId: summaryId,
        originalError: error.message
      });
    }
  }

  /**
   * Get summary generation statistics
   */
  async getGenerationStats(timeframe = '24h') {
    const timeframeDates = {
      '1h': new Date(Date.now() - 60 * 60 * 1000),
      '24h': new Date(Date.now() - 24 * 60 * 60 * 1000),
      '7d': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    };
    
    const since = timeframeDates[timeframe] || timeframeDates['24h'];
    
    const stats = await Summary.findAll({
      where: {
        createdAt: { [require('sequelize').Op.gte]: since }
      },
      attributes: [
        'summaryStyle',
        'aiModel',
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
        [require('sequelize').fn('AVG', require('sequelize').col('processingTime')), 'avgProcessingTime'],
        [require('sequelize').fn('SUM', require('sequelize').col('cost')), 'totalCost'],
        [require('sequelize').fn('AVG', require('sequelize').literal("CAST(json_extract(tokenUsage, '$.totalTokens') AS INTEGER)")), 'avgTokens']
      ],
      group: ['summaryStyle', 'aiModel', 'status'],
      raw: true
    });
    
    return stats;
  }

  /**
   * Get fallback system statistics
   */
  getFallbackStats() {
    const primarySuccessRate = this.stats.primaryAttempts > 0 ?
      (this.stats.primarySuccesses / this.stats.primaryAttempts * 100).toFixed(1) : 0;

    const fallbackSuccessRate = this.stats.fallbackAttempts > 0 ?
      (this.stats.fallbackSuccesses / this.stats.fallbackAttempts * 100).toFixed(1) : 0;

    return {
      primary: {
        attempts: this.stats.primaryAttempts,
        successes: this.stats.primarySuccesses,
        successRate: primarySuccessRate + '%',
        avgProcessingTime: Math.round(this.stats.avgPrimaryTime) + 'ms'
      },
      fallback: {
        attempts: this.stats.fallbackAttempts,
        successes: this.stats.fallbackSuccesses,
        successRate: fallbackSuccessRate + '%',
        avgProcessingTime: Math.round(this.stats.avgFallbackTime) + 'ms'
      },
      overall: {
        totalRetries: this.stats.totalRetries,
        fallbackUtilization: this.stats.fallbackAttempts > 0 ?
          ((this.stats.fallbackAttempts / (this.stats.primaryAttempts + this.stats.fallbackAttempts)) * 100).toFixed(1) + '%' : '0%'
      }
    };
  }

  /**
   * Get fallback configuration summary
   */
  getFallbackConfig() {
    return this.fallbackEngine.getConfigSummary();
  }

  /**
   * Test fallback system with mock scenarios
   */
  async testFallbackScenarios() {
    const scenarios = [
      {
        name: 'High Cost Scenario',
        context: {
          summaryStyle: 'detailed',
          estimatedTokens: 25000,
          estimatedCost: 0.08,
          urgency: 'normal'
        }
      },
      {
        name: 'High Urgency Scenario',
        context: {
          summaryStyle: 'executive',
          estimatedTokens: 5000,
          estimatedCost: 0.01,
          urgency: 'high'
        }
      },
      {
        name: 'Simple Summary Scenario',
        context: {
          summaryStyle: 'action-items',
          estimatedTokens: 3000,
          estimatedCost: 0.005,
          urgency: 'normal'
        }
      },
      {
        name: 'Complex Technical Scenario',
        context: {
          summaryStyle: 'technical',
          estimatedTokens: 45000,
          estimatedCost: 0.12,
          urgency: 'normal'
        }
      }
    ];

    const results = scenarios.map(scenario => {
      const decision = this.fallbackEngine.selectModel(scenario.context);
      return {
        scenario: scenario.name,
        context: scenario.context,
        decision: {
          model: decision.model,
          reason: decision.reason,
          confidence: decision.confidence,
          fallbackReasons: decision.fallbackReasons
        }
      };
    });

    return results;
  }

  /**
   * Reset fallback statistics
   */
  resetStats() {
    this.stats = {
      primaryAttempts: 0,
      fallbackAttempts: 0,
      primarySuccesses: 0,
      fallbackSuccesses: 0,
      totalRetries: 0,
      avgPrimaryTime: 0,
      avgFallbackTime: 0
    };
  }
}

module.exports = SummaryService;
