/**
 * Response Processing Pipeline
 * 
 * Comprehensive pipeline for processing AI-generated summary responses:
 * - Validation and quality checks
 * - Structured data extraction
 * - Text normalization and formatting
 * - Metadata enrichment
 * - Multi-format output preparation
 */

const { calculateCost } = require('../config/groq');

class ResponseProcessor {
  constructor() {
    this.validationRules = {
      minLength: 50,           // Minimum summary length
      maxLength: 50000,        // Maximum summary length
      minWords: 10,            // Minimum word count
      maxWords: 10000,         // Maximum word count
      requiredSections: [],    // Will be set based on summary style
      forbiddenPatterns: [     // Patterns that indicate poor quality
        /^I cannot|^I can't|^I'm unable/i,
        /^As an AI|^I am an AI/i,
        /^Sorry, I cannot|^I apologize/i,
        /\[ERROR\]|\[FAILED\]/i,
        /^The transcript appears to be/i
      ]
    };

    this.structurePatterns = {
      // Common heading patterns
      headings: /^#{1,6}\s+(.+)$|^(.+):?\s*$(?=\n[-•*]|\n\d+\.)/gm,
      
      // Bullet point patterns
      bulletPoints: /^[-•*]\s+(.+)$/gm,
      
      // Numbered list patterns
      numberedLists: /^\d+\.\s+(.+)$/gm,
      
      // Action item patterns
      actionItems: /(?:action|task|todo|follow[- ]?up)[:\s]*(.+?)(?:owner|assigned|due)[:\s]*(.+?)(?:deadline|by|due)[:\s]*(.+?)$/gim,
      
      // Decision patterns
      decisions: /(?:decision|decided|agreed)[:\s]*(.+?)$/gim,
      
      // Key insight patterns
      insights: /(?:key|important|insight|takeaway|highlight)[:\s]*(.+?)$/gim,
      
      // Date patterns
      dates: /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/gi,
      
      // Time patterns
      times: /\b\d{1,2}:\d{2}(?:\s*[ap]m)?\b/gi,
      
      // Person/name patterns
      names: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+\([^)]+\))?\b/g,
      
      // Email patterns
      emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    };

    this.styleRequirements = {
      executive: {
        requiredSections: ['summary', 'key', 'decision', 'next'],
        preferredLength: { min: 200, max: 800 },
        structureScore: 0.7
      },
      'action-items': {
        requiredSections: ['action', 'task', 'owner', 'due'],
        preferredLength: { min: 150, max: 1000 },
        structureScore: 0.8
      },
      technical: {
        requiredSections: ['technical', 'implementation', 'decision'],
        preferredLength: { min: 300, max: 1200 },
        structureScore: 0.6
      },
      detailed: {
        requiredSections: ['discussion', 'outcome', 'next'],
        preferredLength: { min: 500, max: 2000 },
        structureScore: 0.5
      }
    };
  }

  /**
   * Main processing pipeline
   */
  async processResponse(rawResponse, context = {}) {
    const startTime = Date.now();
    
    try {
      console.log('📝 Starting response processing pipeline...');
      
      // Step 1: Basic validation
      const validation = this.validateResponse(rawResponse, context);
      if (!validation.isValid) {
        throw new Error(`Response validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Step 2: Text normalization
      const normalizedText = this.normalizeText(rawResponse.content);
      
      // Step 3: Structure extraction
      const structure = this.extractStructure(normalizedText, context.summaryStyle);
      
      // Step 4: Content analysis
      const analysis = this.analyzeContent(normalizedText, structure, context);
      
      // Step 5: Quality assessment
      const quality = this.assessQuality(normalizedText, structure, analysis, context);
      
      // Step 6: Metadata enrichment
      const metadata = this.enrichMetadata(rawResponse, context, analysis, quality);
      
      // Step 7: Multi-format preparation
      const formats = this.prepareFormats(normalizedText, structure, metadata);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Response processed successfully in ${processingTime}ms`);
      
      return {
        success: true,
        content: {
          raw: rawResponse.content,
          normalized: normalizedText,
          structure: structure,
          analysis: analysis,
          quality: quality
        },
        metadata: {
          ...metadata,
          processingTime: processingTime,
          processedAt: new Date().toISOString()
        },
        formats: formats,
        validation: validation
      };
      
    } catch (error) {
      console.error('❌ Response processing failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        content: {
          raw: rawResponse?.content || '',
          normalized: '',
          structure: {},
          analysis: {},
          quality: { score: 0, issues: [error.message] }
        },
        metadata: {
          processingTime: Date.now() - startTime,
          processedAt: new Date().toISOString(),
          processingError: error.message
        },
        formats: {},
        validation: { isValid: false, errors: [error.message] }
      };
    }
  }

  /**
   * Validate AI response
   */
  validateResponse(response, context = {}) {
    const errors = [];
    const warnings = [];
    
    // Check if response exists
    if (!response || typeof response !== 'object') {
      errors.push('Response is missing or invalid');
      return { isValid: false, errors, warnings };
    }
    
    // Check content
    const content = response.content || '';
    if (!content || typeof content !== 'string') {
      errors.push('Response content is missing or not a string');
      return { isValid: false, errors, warnings };
    }
    
    // Length validation
    if (content.length < this.validationRules.minLength) {
      errors.push(`Content too short: ${content.length} chars (min: ${this.validationRules.minLength})`);
    }
    
    if (content.length > this.validationRules.maxLength) {
      errors.push(`Content too long: ${content.length} chars (max: ${this.validationRules.maxLength})`);
    }
    
    // Word count validation
    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount < this.validationRules.minWords) {
      errors.push(`Too few words: ${wordCount} (min: ${this.validationRules.minWords})`);
    }
    
    if (wordCount > this.validationRules.maxWords) {
      warnings.push(`High word count: ${wordCount} (max recommended: ${this.validationRules.maxWords})`);
    }
    
    // Pattern validation (forbidden content)
    for (const pattern of this.validationRules.forbiddenPatterns) {
      if (pattern.test(content)) {
        errors.push(`Content contains forbidden pattern: ${pattern.source}`);
      }
    }
    
    // Empty or placeholder content
    const trimmedContent = content.trim().toLowerCase();
    if (trimmedContent === '' || 
        trimmedContent === 'no content' || 
        trimmedContent === 'empty' ||
        trimmedContent.startsWith('i cannot') ||
        trimmedContent.startsWith('sorry')) {
      errors.push('Content appears to be empty or placeholder');
    }
    
    // Style-specific validation
    if (context.summaryStyle && this.styleRequirements[context.summaryStyle]) {
      const styleReq = this.styleRequirements[context.summaryStyle];
      
      // Length preferences
      if (content.length < styleReq.preferredLength.min) {
        warnings.push(`Content shorter than preferred for ${context.summaryStyle} style`);
      }
      
      if (content.length > styleReq.preferredLength.max) {
        warnings.push(`Content longer than preferred for ${context.summaryStyle} style`);
      }
    }
    
    // Usage validation
    if (response.usage) {
      if (!response.usage.total_tokens || response.usage.total_tokens <= 0) {
        warnings.push('Invalid or missing token usage information');
      }
      
      if (!response.usage.completion_tokens || response.usage.completion_tokens <= 10) {
        warnings.push('Very low completion token count - response may be truncated');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        contentLength: content.length,
        wordCount: wordCount,
        lineCount: content.split('\n').length
      }
    };
  }

  /**
   * Normalize text content
   */
  normalizeText(content) {
    if (!content || typeof content !== 'string') {
      return '';
    }
    
    let normalized = content;
    
    // Fix encoding issues
    normalized = normalized
      .replace(/â€™/g, "'")      // Smart apostrophe
      .replace(/â€œ/g, '"')      // Smart quote open
      .replace(/â€/g, '"')       // Smart quote close
      .replace(/â€"/g, '—')      // Em dash
      .replace(/â€"/g, '–')      // En dash
      .replace(/Â/g, '')         // Non-breaking space artifacts
      .replace(/\u00A0/g, ' ')   // Non-breaking space
      .replace(/\u2018/g, "'")   // Left single quote
      .replace(/\u2019/g, "'")   // Right single quote
      .replace(/\u201C/g, '"')   // Left double quote
      .replace(/\u201D/g, '"')   // Right double quote
      .replace(/\u2013/g, '–')   // En dash
      .replace(/\u2014/g, '—');  // Em dash
    
    // Normalize whitespace
    normalized = normalized
      .replace(/\r\n/g, '\n')    // Windows line endings
      .replace(/\r/g, '\n')      // Mac line endings
      .replace(/\t/g, '    ')    // Tabs to spaces
      .replace(/[ \t]+$/gm, '')  // Trailing whitespace
      .replace(/\n{3,}/g, '\n\n') // Multiple newlines
      .replace(/[ ]{2,}/g, ' ')  // Multiple spaces
      .trim();                   // Leading/trailing whitespace
    
    // Fix common formatting issues
    normalized = normalized
      .replace(/([.!?])\s*\n\s*([a-z])/g, '$1 $2')  // Fix broken sentences
      .replace(/([a-z])\s*\n\s*([A-Z])/g, '$1\n\n$2') // Fix paragraph breaks
      .replace(/^[-•*]\s*/gm, '• ')                     // Standardize bullets
      .replace(/^\d+\.\s*/gm, (match, offset, string) => {
        const num = string.substring(0, offset).split(/^\d+\./gm).length;
        return `${num}. `;
      });
    
    return normalized;
  }

  /**
   * Extract structured data from content
   */
  extractStructure(content, summaryStyle = 'executive') {
    const structure = {
      headings: [],
      bulletPoints: [],
      numberedLists: [],
      actionItems: [],
      decisions: [],
      insights: [],
      dates: [],
      times: [],
      names: [],
      emails: [],
      sections: {}
    };
    
    // Extract headings
    let match;
    while ((match = this.structurePatterns.headings.exec(content)) !== null) {
      structure.headings.push({
        text: (match[1] || match[2]).trim(),
        level: match[0].startsWith('#') ? match[0].split('#').length - 1 : 1,
        position: match.index
      });
    }
    
    // Reset regex
    this.structurePatterns.headings.lastIndex = 0;
    
    // Extract bullet points
    while ((match = this.structurePatterns.bulletPoints.exec(content)) !== null) {
      structure.bulletPoints.push({
        text: match[1].trim(),
        position: match.index
      });
    }
    this.structurePatterns.bulletPoints.lastIndex = 0;
    
    // Extract numbered lists
    while ((match = this.structurePatterns.numberedLists.exec(content)) !== null) {
      structure.numberedLists.push({
        text: match[1].trim(),
        number: parseInt(match[0]),
        position: match.index
      });
    }
    this.structurePatterns.numberedLists.lastIndex = 0;
    
    // Extract action items
    while ((match = this.structurePatterns.actionItems.exec(content)) !== null) {
      structure.actionItems.push({
        action: match[1] ? match[1].trim() : '',
        owner: match[2] ? match[2].trim() : '',
        deadline: match[3] ? match[3].trim() : '',
        position: match.index
      });
    }
    this.structurePatterns.actionItems.lastIndex = 0;
    
    // Extract decisions
    while ((match = this.structurePatterns.decisions.exec(content)) !== null) {
      structure.decisions.push({
        text: match[1].trim(),
        position: match.index
      });
    }
    this.structurePatterns.decisions.lastIndex = 0;
    
    // Extract insights
    while ((match = this.structurePatterns.insights.exec(content)) !== null) {
      structure.insights.push({
        text: match[1].trim(),
        position: match.index
      });
    }
    this.structurePatterns.insights.lastIndex = 0;
    
    // Extract dates
    structure.dates = [...content.matchAll(this.structurePatterns.dates)].map(m => ({
      text: m[0],
      position: m.index
    }));
    
    // Extract times
    structure.times = [...content.matchAll(this.structurePatterns.times)].map(m => ({
      text: m[0],
      position: m.index
    }));
    
    // Extract names (potential attendees)
    structure.names = [...content.matchAll(this.structurePatterns.names)]
      .map(m => ({ text: m[0], position: m.index }))
      .filter(name => name.text.length > 2 && name.text.length < 50); // Filter reasonable names
    
    // Extract emails
    structure.emails = [...content.matchAll(this.structurePatterns.emails)].map(m => ({
      text: m[0],
      position: m.index
    }));
    
    // Create sections based on headings
    if (structure.headings.length > 0) {
      for (let i = 0; i < structure.headings.length; i++) {
        const heading = structure.headings[i];
        const nextHeading = structure.headings[i + 1];
        const sectionStart = heading.position + heading.text.length;
        const sectionEnd = nextHeading ? nextHeading.position : content.length;
        
        structure.sections[heading.text.toLowerCase()] = {
          title: heading.text,
          content: content.substring(sectionStart, sectionEnd).trim(),
          position: heading.position,
          length: sectionEnd - sectionStart
        };
      }
    }
    
    return structure;
  }

  /**
   * Analyze content for insights and metrics
   */
  analyzeContent(content, structure, context = {}) {
    const analysis = {
      readability: this.calculateReadability(content),
      sentiment: this.analyzeSentiment(content),
      completeness: this.assessCompleteness(content, structure, context.summaryStyle),
      actionability: this.assessActionability(structure),
      coverage: this.assessCoverage(content, context),
      entities: this.extractEntities(structure)
    };
    
    return analysis;
  }

  /**
   * Calculate readability score (simplified Flesch Reading Ease)
   */
  calculateReadability(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((count, word) => {
      return count + this.countSyllables(word);
    }, 0);
    
    if (sentences.length === 0 || words.length === 0) {
      return { score: 0, level: 'unreadable' };
    }
    
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    // Simplified Flesch Reading Ease formula
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
    let level;
    if (score >= 90) level = 'very easy';
    else if (score >= 80) level = 'easy';
    else if (score >= 70) level = 'fairly easy';
    else if (score >= 60) level = 'standard';
    else if (score >= 50) level = 'fairly difficult';
    else if (score >= 30) level = 'difficult';
    else level = 'very difficult';
    
    return {
      score: Math.max(0, Math.min(100, score)),
      level: level,
      avgSentenceLength: avgSentenceLength,
      avgSyllablesPerWord: avgSyllablesPerWord
    };
  }

  /**
   * Count syllables in a word (simplified)
   */
  countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    const vowels = word.match(/[aeiouy]+/g);
    let count = vowels ? vowels.length : 1;
    
    if (word.endsWith('e')) count--;
    if (word.endsWith('le') && word.length > 2) count++;
    
    return Math.max(1, count);
  }

  /**
   * Analyze sentiment (simplified)
   */
  analyzeSentiment(content) {
    const positiveWords = ['success', 'complete', 'achieve', 'good', 'great', 'excellent', 'positive', 'progress', 'improve'];
    const negativeWords = ['fail', 'problem', 'issue', 'concern', 'delay', 'block', 'risk', 'challenge', 'difficult'];
    const neutralWords = ['discuss', 'review', 'plan', 'consider', 'analyze', 'evaluate', 'assess'];
    
    const words = content.toLowerCase().split(/\s+/);
    
    let positive = 0, negative = 0, neutral = 0;
    
    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positive++;
      else if (negativeWords.some(nw => word.includes(nw))) negative++;
      else if (neutralWords.some(neu => word.includes(neu))) neutral++;
    });
    
    const total = positive + negative + neutral;
    
    return {
      positive: total > 0 ? (positive / total * 100).toFixed(1) : 0,
      negative: total > 0 ? (negative / total * 100).toFixed(1) : 0,
      neutral: total > 0 ? (neutral / total * 100).toFixed(1) : 0,
      overall: positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral'
    };
  }

  /**
   * Assess completeness based on expected sections
   */
  assessCompleteness(content, structure, summaryStyle) {
    if (!summaryStyle || !this.styleRequirements[summaryStyle]) {
      return { score: 0.5, missing: [], present: [] };
    }
    
    const requirements = this.styleRequirements[summaryStyle].requiredSections;
    const contentLower = content.toLowerCase();
    
    const present = requirements.filter(req => 
      contentLower.includes(req) || 
      structure.headings.some(h => h.text.toLowerCase().includes(req))
    );
    
    const missing = requirements.filter(req => !present.includes(req));
    
    return {
      score: requirements.length > 0 ? present.length / requirements.length : 1,
      missing: missing,
      present: present,
      coverage: `${present.length}/${requirements.length}`
    };
  }

  /**
   * Assess actionability based on action items and decisions
   */
  assessActionability(structure) {
    const actionCount = structure.actionItems.length;
    const decisionCount = structure.decisions.length;
    const totalActionable = actionCount + decisionCount;
    
    let score = 0;
    if (totalActionable >= 5) score = 1.0;
    else if (totalActionable >= 3) score = 0.8;
    else if (totalActionable >= 1) score = 0.6;
    else score = 0.3;
    
    return {
      score: score,
      actionItems: actionCount,
      decisions: decisionCount,
      total: totalActionable,
      level: score >= 0.8 ? 'high' : score >= 0.6 ? 'medium' : 'low'
    };
  }

  /**
   * Assess coverage of original content
   */
  assessCoverage(content, context) {
    // This is a simplified assessment
    // In a real implementation, you might compare against the original transcript
    
    const hasIntroduction = /^(meeting|summary|overview)/i.test(content);
    const hasConclusion = /(conclusion|summary|next steps|action)/i.test(content);
    const hasStructure = content.includes('•') || content.includes('1.') || content.includes('#');
    
    let score = 0;
    if (hasIntroduction) score += 0.3;
    if (hasConclusion) score += 0.3;
    if (hasStructure) score += 0.4;
    
    return {
      score: score,
      hasIntroduction: hasIntroduction,
      hasConclusion: hasConclusion,
      hasStructure: hasStructure,
      level: score >= 0.8 ? 'comprehensive' : score >= 0.5 ? 'adequate' : 'limited'
    };
  }

  /**
   * Extract entities from structured data
   */
  extractEntities(structure) {
    return {
      people: [...new Set(structure.names.map(n => n.text))],
      dates: [...new Set(structure.dates.map(d => d.text))],
      times: [...new Set(structure.times.map(t => t.text))],
      emails: [...new Set(structure.emails.map(e => e.text))],
      actionOwners: [...new Set(structure.actionItems.map(a => a.owner).filter(o => o))],
      keyTopics: structure.headings.map(h => h.text)
    };
  }

  /**
   * Assess overall quality
   */
  assessQuality(content, structure, analysis, context) {
    const issues = [];
    const strengths = [];
    let score = 0;
    
    // Readability score (20%)
    const readabilityScore = analysis.readability.score / 100;
    score += readabilityScore * 0.2;
    if (readabilityScore >= 0.6) {
      strengths.push('Good readability');
    } else {
      issues.push('Poor readability');
    }
    
    // Completeness score (25%)
    const completenessScore = analysis.completeness.score;
    score += completenessScore * 0.25;
    if (completenessScore >= 0.8) {
      strengths.push('Complete coverage');
    } else {
      issues.push(`Missing sections: ${analysis.completeness.missing.join(', ')}`);
    }
    
    // Structure score (20%)
    const structureScore = (structure.headings.length > 0 ? 0.4 : 0) +
                          (structure.bulletPoints.length > 0 ? 0.3 : 0) +
                          (structure.actionItems.length > 0 ? 0.3 : 0);
    score += structureScore * 0.2;
    if (structureScore >= 0.7) {
      strengths.push('Well structured');
    } else {
      issues.push('Poor structure');
    }
    
    // Actionability score (20%)
    const actionabilityScore = analysis.actionability.score;
    score += actionabilityScore * 0.2;
    if (actionabilityScore >= 0.6) {
      strengths.push('Actionable content');
    } else {
      issues.push('Limited actionable items');
    }
    
    // Coverage score (15%)
    const coverageScore = analysis.coverage.score;
    score += coverageScore * 0.15;
    if (coverageScore >= 0.7) {
      strengths.push('Comprehensive coverage');
    } else {
      issues.push('Limited coverage');
    }
    
    // Determine overall grade
    let grade;
    if (score >= 0.9) grade = 'A';
    else if (score >= 0.8) grade = 'B';
    else if (score >= 0.7) grade = 'C';
    else if (score >= 0.6) grade = 'D';
    else grade = 'F';
    
    return {
      score: Math.round(score * 100) / 100,
      grade: grade,
      level: score >= 0.8 ? 'excellent' : score >= 0.6 ? 'good' : score >= 0.4 ? 'fair' : 'poor',
      issues: issues,
      strengths: strengths,
      breakdown: {
        readability: Math.round(readabilityScore * 100),
        completeness: Math.round(completenessScore * 100),
        structure: Math.round(structureScore * 100),
        actionability: Math.round(actionabilityScore * 100),
        coverage: Math.round(coverageScore * 100)
      }
    };
  }

  /**
   * Enrich metadata
   */
  enrichMetadata(rawResponse, context, analysis, quality) {
    const cost = rawResponse.usage ? 
      calculateCost(rawResponse.usage, context.modelUsed === 'fallback' ? 'fallback' : 'primary') : 0;
    
    return {
      // AI model information
      model: {
        name: rawResponse.model || context.modelUsed || 'unknown',
        type: context.modelUsed || 'primary',
        requestId: rawResponse.requestId || null
      },
      
      // Token usage
      usage: {
        inputTokens: rawResponse.usage?.prompt_tokens || 0,
        outputTokens: rawResponse.usage?.completion_tokens || 0,
        totalTokens: rawResponse.usage?.total_tokens || 0
      },
      
      // Cost information
      cost: {
        total: cost,
        inputCost: rawResponse.usage ? (rawResponse.usage.prompt_tokens / 1000) * 
          (context.modelUsed === 'fallback' ? 0.00018 : 0.00059) : 0,
        outputCost: rawResponse.usage ? (rawResponse.usage.completion_tokens / 1000) * 
          (context.modelUsed === 'fallback' ? 0.00018 : 0.00079) : 0,
        currency: 'USD'
      },
      
      // Processing information
      processing: {
        finishReason: rawResponse.finishReason || 'unknown',
        processingTime: rawResponse.processingTime || 0,
        fallbackUsed: context.fallbackUsed || false,
        attemptCount: context.attemptCount || 1
      },
      
      // Content metrics
      metrics: {
        contentLength: rawResponse.content?.length || 0,
        wordCount: rawResponse.content ? rawResponse.content.split(/\s+/).length : 0,
        readabilityScore: analysis.readability.score,
        qualityScore: quality.score,
        qualityGrade: quality.grade
      },
      
      // Summary style and context
      context: {
        summaryStyle: context.summaryStyle || 'executive',
        customInstructions: context.customInstructions || '',
        urgency: context.urgency || 'normal',
        transcriptId: context.transcriptId || null
      }
    };
  }

  /**
   * Prepare multiple output formats
   */
  prepareFormats(content, structure, metadata) {
    return {
      // API JSON format
      api: {
        content: content,
        metadata: metadata,
        structure: {
          headings: structure.headings.length,
          bulletPoints: structure.bulletPoints.length,
          actionItems: structure.actionItems.length,
          decisions: structure.decisions.length
        },
        entities: structure.sections
      },
      
      // UI rendering format
      ui: {
        title: this.generateTitle(content, structure),
        summary: content,
        highlights: this.extractHighlights(structure),
        actionItems: structure.actionItems,
        decisions: structure.decisions,
        keyInsights: structure.insights,
        metadata: {
          model: metadata.model.name,
          cost: `$${metadata.cost.total.toFixed(6)}`,
          tokens: metadata.usage.totalTokens,
          quality: metadata.metrics.qualityGrade,
          processingTime: `${metadata.processing.processingTime}ms`
        }
      },
      
      // Email format
      email: {
        subject: this.generateEmailSubject(content, structure, metadata),
        body: this.formatForEmail(content, structure),
        attachments: []
      },
      
      // Plain text format
      text: {
        content: this.stripFormatting(content),
        wordCount: metadata.metrics.wordCount,
        readingTime: Math.ceil(metadata.metrics.wordCount / 200) // ~200 words per minute
      },
      
      // Markdown format
      markdown: {
        content: this.convertToMarkdown(content, structure),
        toc: this.generateTableOfContents(structure)
      }
    };
  }

  /**
   * Generate title from content
   */
  generateTitle(content, structure) {
    // Try to find a title from headings
    if (structure.headings.length > 0) {
      return structure.headings[0].text;
    }
    
    // Extract from first sentence
    const firstSentence = content.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length < 100) {
      return firstSentence.trim();
    }
    
    // Default title
    return 'Meeting Summary';
  }

  /**
   * Extract highlights for UI
   */
  extractHighlights(structure) {
    const highlights = [];
    
    // Add key insights
    structure.insights.forEach(insight => {
      highlights.push({
        type: 'insight',
        text: insight.text,
        icon: '💡'
      });
    });
    
    // Add important decisions
    structure.decisions.slice(0, 3).forEach(decision => {
      highlights.push({
        type: 'decision',
        text: decision.text,
        icon: '✅'
      });
    });
    
    // Add urgent action items
    structure.actionItems.slice(0, 3).forEach(action => {
      highlights.push({
        type: 'action',
        text: action.action,
        owner: action.owner,
        deadline: action.deadline,
        icon: '🎯'
      });
    });
    
    return highlights.slice(0, 6); // Limit to 6 highlights
  }

  /**
   * Generate email subject
   */
  generateEmailSubject(content, structure, metadata) {
    const style = metadata.context.summaryStyle;
    const date = new Date().toLocaleDateString();
    
    if (structure.headings.length > 0) {
      return `${structure.headings[0].text} - ${style} Summary (${date})`;
    }
    
    return `Meeting Summary - ${style} (${date})`;
  }

  /**
   * Format content for email
   */
  formatForEmail(content, structure) {
    let emailBody = content;
    
    // Add action items section if present
    if (structure.actionItems.length > 0) {
      emailBody += '\n\n--- ACTION ITEMS ---\n';
      structure.actionItems.forEach((item, index) => {
        emailBody += `${index + 1}. ${item.action}`;
        if (item.owner) emailBody += ` (Owner: ${item.owner})`;
        if (item.deadline) emailBody += ` (Due: ${item.deadline})`;
        emailBody += '\n';
      });
    }
    
    return emailBody;
  }

  /**
   * Strip formatting for plain text
   */
  stripFormatting(content) {
    return content
      .replace(/#{1,6}\s+/g, '')     // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1')     // Remove italic
      .replace(/`(.*?)`/g, '$1')      // Remove code
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
      .trim();
  }

  /**
   * Convert to markdown format
   */
  convertToMarkdown(content, structure) {
    // Content is likely already in markdown-like format
    // This method can enhance it further
    let markdown = content;
    
    // Ensure proper heading formatting
    structure.headings.forEach(heading => {
      const level = '#'.repeat(Math.min(heading.level, 6));
      // Escape special regex characters in heading text
      const escapedText = heading.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escapedText}:?\\s*$`, 'gm');
      markdown = markdown.replace(regex, `${level} ${heading.text}`);
    });
    
    return markdown;
  }

  /**
   * Generate table of contents
   */
  generateTableOfContents(structure) {
    return structure.headings.map(heading => ({
      title: heading.text,
      level: heading.level,
      anchor: heading.text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
    }));
  }
}

module.exports = ResponseProcessor;
