/**
 * Prompt Engineering Service for Meeting Summarization
 * 
 * Optimized for Groq's llama-3.3-70b-versatile model
 * Context window: 131K tokens (~100K words)
 * Output limit: 32K tokens
 */

const { getModelInfo } = require('../config/groq');

class PromptEngine {
  constructor() {
    this.modelInfo = getModelInfo('primary');
    this.maxContextTokens = this.modelInfo.contextWindow;
    this.maxOutputTokens = this.modelInfo.maxTokens;
    
    // Reserve tokens for system prompt and formatting
    this.systemPromptTokens = 500;
    this.formattingTokens = 200;
    this.safetyBuffer = 1000;
    
    this.maxTranscriptTokens = this.maxContextTokens - 
      this.systemPromptTokens - 
      this.formattingTokens - 
      this.safetyBuffer;
  }

  /**
   * Build complete prompt for meeting summarization
   */
  buildSummaryPrompt(transcript, instructions = {}) {
    const {
      summaryStyle = 'executive',
      customInstructions = '',
      transcriptMetadata = {}
    } = instructions;

    // Get style-specific system prompt
    const systemPrompt = this.getSystemPrompt(summaryStyle, customInstructions);
    
    // Format transcript with metadata
    const formattedTranscript = this.formatTranscript(transcript, transcriptMetadata);
    
    // Build messages array for Groq API
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: formattedTranscript
      }
    ];

    return {
      messages,
      estimatedTokens: this.estimateTokenCount(systemPrompt + formattedTranscript),
      maxTokens: this.calculateOptimalMaxTokens(summaryStyle),
      temperature: this.getOptimalTemperature(summaryStyle)
    };
  }

  /**
   * Generate system prompt based on summary style and custom instructions
   */
  getSystemPrompt(summaryStyle, customInstructions) {
    const basePrompt = `You are an expert meeting summarizer with exceptional ability to extract key information, decisions, and action items from meeting transcripts. Your summaries are clear, concise, and actionable.

CORE PRINCIPLES:
- Focus on outcomes, decisions, and next steps
- Maintain professional tone and clarity
- Preserve important context and nuances
- Organize information logically
- Use bullet points for better readability`;

    const stylePrompts = {
      executive: `
EXECUTIVE SUMMARY STYLE:
Create a high-level executive summary focusing on:
• Strategic decisions and their business impact
• Key outcomes and deliverables
• Resource requirements and budget implications
• Critical risks and mitigation strategies
• Next steps requiring leadership attention

Format with clear sections and bullet points for executive consumption.`,

      'action-items': `
ACTION-FOCUSED STYLE:
Extract and organize all actionable items with:
• Specific tasks with clear owners
• Deadlines and priority levels
• Dependencies between tasks
• Follow-up requirements
• Decision points needing resolution

Prioritize actionability and accountability in your summary.`,

      technical: `
TECHNICAL SUMMARY STYLE:
Focus on technical aspects including:
• Technical decisions and architectural choices
• Implementation approaches and methodologies
• System requirements and specifications
• Technical risks and mitigation strategies
• Development timelines and milestones

Maintain technical accuracy while being accessible to stakeholders.`,

      detailed: `
DETAILED OVERVIEW STYLE:
Provide comprehensive coverage including:
• Complete context and background information
• All discussion points and perspectives shared
• Detailed decision-making process
• Full scope of topics covered
• Comprehensive next steps and follow-ups

Balance thoroughness with readability.`,

      custom: ''
    };

    let finalPrompt = basePrompt + (stylePrompts[summaryStyle] || '');

    // Add custom instructions if provided
    if (customInstructions && customInstructions.trim()) {
      finalPrompt += `

CUSTOM INSTRUCTIONS:
${customInstructions.trim()}

Please incorporate these specific requirements into your summary while maintaining the core principles above.`;
    }

    finalPrompt += `

IMPORTANT GUIDELINES:
- If the transcript is incomplete or unclear, note this in your summary
- Preserve exact quotes for important decisions or commitments
- Use clear headings and bullet points for organization
- Ensure all action items have clear ownership
- Maintain confidentiality and professional discretion`;

    return finalPrompt;
  }

  /**
   * Format transcript with metadata for optimal processing
   */
  formatTranscript(transcript, metadata = {}) {
    let formattedContent = '';

    // Add metadata header if available
    if (Object.keys(metadata).length > 0) {
      formattedContent += 'MEETING METADATA:\n';
      
      if (metadata.date) formattedContent += `Date: ${metadata.date}\n`;
      if (metadata.attendees) formattedContent += `Attendees: ${metadata.attendees}\n`;
      if (metadata.duration) formattedContent += `Duration: ${metadata.duration}\n`;
      if (metadata.meetingType) formattedContent += `Type: ${metadata.meetingType}\n`;
      
      formattedContent += '\n';
    }

    formattedContent += 'MEETING TRANSCRIPT:\n';
    formattedContent += transcript;

    // Truncate if too long for context window
    const estimatedTokens = this.estimateTokenCount(formattedContent);
    if (estimatedTokens > this.maxTranscriptTokens) {
      const targetLength = Math.floor(formattedContent.length * (this.maxTranscriptTokens / estimatedTokens));
      formattedContent = this.intelligentTruncate(formattedContent, targetLength);
      formattedContent += '\n\n[Note: Transcript was truncated to fit context window. Summary based on available content.]';
    }

    return formattedContent;
  }

  /**
   * Intelligent truncation that preserves important content
   */
  intelligentTruncate(content, targetLength) {
    if (content.length <= targetLength) return content;

    // Try to find a good breaking point (end of sentence, paragraph, etc.)
    const breakPoints = ['. ', '\n\n', '\n', ': '];
    
    for (const breakPoint of breakPoints) {
      const lastIndex = content.lastIndexOf(breakPoint, targetLength);
      if (lastIndex > targetLength * 0.8) { // Don't truncate too aggressively
        return content.substring(0, lastIndex + breakPoint.length);
      }
    }

    // Fallback to character truncation
    return content.substring(0, targetLength);
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate optimal max_tokens based on summary style
   */
  calculateOptimalMaxTokens(summaryStyle) {
    const styleTokenLimits = {
      executive: 1500,    // Concise executive summary
      'action-items': 2000, // Detailed action items
      technical: 2500,    // Technical details
      detailed: 3000,     // Comprehensive overview
      custom: 2000        // Default for custom
    };

    return Math.min(
      styleTokenLimits[summaryStyle] || 2000,
      this.maxOutputTokens
    );
  }

  /**
   * Get optimal temperature based on summary style
   */
  getOptimalTemperature(summaryStyle) {
    const styleTemperatures = {
      executive: 0.1,     // Very focused and consistent
      'action-items': 0.05, // Extremely precise for action items
      technical: 0.1,     // Precise technical language
      detailed: 0.15,     // Slightly more creative for comprehensive coverage
      custom: 0.1         // Default conservative setting
    };

    return styleTemperatures[summaryStyle] || 0.1;
  }

  /**
   * Validate prompt before sending to API
   */
  validatePrompt(promptData) {
    const { messages, estimatedTokens, maxTokens } = promptData;
    const errors = [];
    const warnings = [];

    // Check token limits
    if (estimatedTokens > this.maxContextTokens) {
      errors.push(`Estimated tokens (${estimatedTokens}) exceed context window (${this.maxContextTokens})`);
    }

    if (estimatedTokens > this.maxContextTokens * 0.9) {
      warnings.push('Prompt is close to context window limit, consider shortening transcript');
    }

    if (maxTokens > this.maxOutputTokens) {
      errors.push(`Max tokens (${maxTokens}) exceed model limit (${this.maxOutputTokens})`);
    }

    // Check message structure
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      errors.push('Messages array is required and must not be empty');
    }

    if (messages && messages.length > 0) {
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessage = messages.find(m => m.role === 'user');

      if (!systemMessage) {
        warnings.push('No system message found, consider adding instructions');
      }

      if (!userMessage) {
        errors.push('User message with transcript is required');
      }

      if (userMessage && !userMessage.content.trim()) {
        errors.push('User message content cannot be empty');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      tokenUtilization: (estimatedTokens / this.maxContextTokens * 100).toFixed(1) + '%'
    };
  }

  /**
   * Get prompt statistics for monitoring and optimization
   */
  getPromptStats(promptData) {
    const { messages, estimatedTokens, maxTokens } = promptData;

    const systemPromptContent = messages.find(m => m.role === 'system')?.content || '';
    const userPromptContent = messages.find(m => m.role === 'user')?.content || '';

    const systemPromptTokens = this.estimateTokenCount(systemPromptContent);
    const userPromptTokens = this.estimateTokenCount(userPromptContent);

    return {
      totalEstimatedTokens: estimatedTokens,
      systemPromptTokens: systemPromptTokens,
      userPromptTokens: userPromptTokens,
      maxOutputTokens: maxTokens,
      contextUtilization: (estimatedTokens / this.maxContextTokens * 100).toFixed(1) + '%',
      outputUtilization: (maxTokens / this.maxOutputTokens * 100).toFixed(1) + '%',
      estimatedCost: this.estimateCost(estimatedTokens, maxTokens)
    };
  }

  /**
   * Estimate cost for the prompt
   */
  estimateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1000) * this.modelInfo.costPer1KTokens.input;
    const outputCost = (outputTokens / 1000) * this.modelInfo.costPer1KTokens.output;
    return inputCost + outputCost;
  }
}

module.exports = PromptEngine;
