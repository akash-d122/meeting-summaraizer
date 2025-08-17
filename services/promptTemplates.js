/**
 * Prompt Templates for Meeting Summarization
 * 
 * Reusable prompt components optimized for different use cases
 * and meeting types. Templates are designed for llama-3.3-70b-versatile.
 */

class PromptTemplates {
  
  /**
   * Get base system prompt with core principles
   */
  static getBaseSystemPrompt() {
    return `You are an expert meeting summarizer with exceptional ability to extract key information, decisions, and action items from meeting transcripts. Your summaries are clear, concise, and actionable.

CORE PRINCIPLES:
- Focus on outcomes, decisions, and next steps
- Maintain professional tone and clarity
- Preserve important context and nuances
- Organize information logically
- Use bullet points for better readability
- Ensure all action items have clear ownership
- Maintain confidentiality and professional discretion`;
  }

  /**
   * Style-specific prompt templates
   */
  static getStylePrompts() {
    return {
      executive: {
        name: 'Executive Summary',
        prompt: `
EXECUTIVE SUMMARY STYLE:
Create a high-level executive summary focusing on:
• Strategic decisions and their business impact
• Key outcomes and deliverables
• Resource requirements and budget implications
• Critical risks and mitigation strategies
• Next steps requiring leadership attention

Format with clear sections and bullet points for executive consumption.
Target length: 300-500 words maximum.`,
        
        outputFormat: `
## Executive Summary
[2-3 sentence overview]

## Key Decisions
• [Decision 1 with business impact]
• [Decision 2 with business impact]

## Strategic Outcomes
• [Outcome 1]
• [Outcome 2]

## Resource Requirements
• [Budget/personnel needs]

## Next Steps for Leadership
• [Action requiring executive attention]
• [Timeline and owner]`
      },

      'action-items': {
        name: 'Action Items & Decisions',
        prompt: `
ACTION-FOCUSED STYLE:
Extract and organize all actionable items with:
• Specific tasks with clear owners
• Deadlines and priority levels
• Dependencies between tasks
• Follow-up requirements
• Decision points needing resolution

Prioritize actionability and accountability in your summary.
Be extremely specific about who does what by when.`,

        outputFormat: `
## Immediate Actions (Next 1-2 weeks)
• [Task] - Owner: [Name] - Due: [Date] - Priority: [High/Medium/Low]

## Short-term Actions (Next month)
• [Task] - Owner: [Name] - Due: [Date] - Dependencies: [If any]

## Decisions Made
• [Decision] - Owner: [Name] - Effective: [Date]

## Pending Decisions
• [Decision needed] - Owner: [Name] - Due: [Date]

## Follow-up Required
• [Item] - Next step: [Action] - By: [Date]`
      },

      technical: {
        name: 'Technical Summary',
        prompt: `
TECHNICAL SUMMARY STYLE:
Focus on technical aspects including:
• Technical decisions and architectural choices
• Implementation approaches and methodologies
• System requirements and specifications
• Technical risks and mitigation strategies
• Development timelines and milestones

Maintain technical accuracy while being accessible to stakeholders.
Include specific technical details and rationale for decisions.`,

        outputFormat: `
## Technical Decisions
• [Decision] - Rationale: [Why] - Impact: [What changes]

## Architecture & Implementation
• [Approach/Technology] - Benefits: [Why chosen]

## System Requirements
• [Requirement] - Specification: [Details]

## Technical Risks
• [Risk] - Mitigation: [Strategy] - Owner: [Name]

## Development Timeline
• [Milestone] - Target: [Date] - Dependencies: [If any]`
      },

      detailed: {
        name: 'Detailed Overview',
        prompt: `
DETAILED OVERVIEW STYLE:
Provide comprehensive coverage including:
• Complete context and background information
• All discussion points and perspectives shared
• Detailed decision-making process
• Full scope of topics covered
• Comprehensive next steps and follow-ups

Balance thoroughness with readability.
Preserve important nuances and different viewpoints discussed.`,

        outputFormat: `
## Meeting Context
[Background and purpose]

## Discussion Summary
### Topic 1: [Name]
• [Key points discussed]
• [Different perspectives]
• [Outcome/decision]

### Topic 2: [Name]
• [Key points discussed]
• [Different perspectives]
• [Outcome/decision]

## Decision-Making Process
• [How decisions were reached]
• [Criteria used]
• [Alternatives considered]

## Complete Action Items
• [Comprehensive list with full context]

## Follow-up Items
• [All items requiring future attention]`
      }
    };
  }

  /**
   * Meeting type specific templates
   */
  static getMeetingTypeTemplates() {
    return {
      standup: {
        name: 'Daily Standup',
        additionalInstructions: `
STANDUP MEETING FOCUS:
- What was accomplished since last meeting
- What will be worked on next
- Any blockers or impediments
- Keep summary brief and action-oriented`,
        
        suggestedFormat: `
## Progress Updates
• [Team member]: [Completed work]

## Planned Work
• [Team member]: [Next priorities]

## Blockers & Issues
• [Blocker]: [Impact] - [Resolution plan]`
      },

      retrospective: {
        name: 'Sprint Retrospective',
        additionalInstructions: `
RETROSPECTIVE FOCUS:
- What went well (continue doing)
- What didn't go well (stop doing)
- What could be improved (start doing)
- Action items for process improvement`,
        
        suggestedFormat: `
## What Went Well
• [Positive item with context]

## What Didn't Go Well
• [Issue with impact and root cause]

## Improvement Opportunities
• [Suggestion with implementation plan]

## Process Changes
• [Change]: [Implementation] - [Owner]`
      },

      planning: {
        name: 'Planning Meeting',
        additionalInstructions: `
PLANNING MEETING FOCUS:
- Goals and objectives defined
- Resource allocation decisions
- Timeline and milestone planning
- Risk assessment and mitigation
- Success criteria and metrics`,
        
        suggestedFormat: `
## Goals & Objectives
• [Goal]: [Success criteria] - [Timeline]

## Resource Allocation
• [Resource]: [Allocation] - [Justification]

## Timeline & Milestones
• [Milestone]: [Date] - [Dependencies]

## Risk Assessment
• [Risk]: [Probability/Impact] - [Mitigation]`
      },

      review: {
        name: 'Review Meeting',
        additionalInstructions: `
REVIEW MEETING FOCUS:
- Performance against goals
- Key metrics and outcomes
- Lessons learned
- Recommendations for future
- Approval decisions made`,
        
        suggestedFormat: `
## Performance Review
• [Metric/Goal]: [Actual vs Target] - [Analysis]

## Key Outcomes
• [Outcome]: [Impact] - [Next steps]

## Lessons Learned
• [Lesson]: [Application for future]

## Recommendations
• [Recommendation]: [Rationale] - [Implementation]`
      }
    };
  }

  /**
   * Industry-specific templates
   */
  static getIndustryTemplates() {
    return {
      software: {
        name: 'Software Development',
        keywords: ['sprint', 'deployment', 'bug', 'feature', 'API', 'database', 'testing'],
        additionalContext: 'Focus on technical implementation, code quality, and development processes.'
      },

      sales: {
        name: 'Sales & Business Development',
        keywords: ['pipeline', 'quota', 'prospect', 'deal', 'revenue', 'forecast'],
        additionalContext: 'Emphasize revenue impact, customer relationships, and sales metrics.'
      },

      marketing: {
        name: 'Marketing & Growth',
        keywords: ['campaign', 'leads', 'conversion', 'brand', 'content', 'analytics'],
        additionalContext: 'Focus on growth metrics, campaign performance, and customer acquisition.'
      },

      finance: {
        name: 'Finance & Operations',
        keywords: ['budget', 'cost', 'revenue', 'profit', 'forecast', 'compliance'],
        additionalContext: 'Emphasize financial impact, budget implications, and compliance requirements.'
      },

      hr: {
        name: 'Human Resources',
        keywords: ['hiring', 'performance', 'training', 'policy', 'culture', 'retention'],
        additionalContext: 'Focus on people-related decisions, policy changes, and organizational impact.'
      }
    };
  }

  /**
   * Get quality guidelines for different summary lengths
   */
  static getQualityGuidelines() {
    return {
      brief: {
        targetWords: '100-300',
        guidelines: [
          'Focus only on the most critical decisions and actions',
          'Use bullet points exclusively',
          'Omit background context unless essential',
          'Prioritize actionable items over discussion details'
        ]
      },

      standard: {
        targetWords: '300-800',
        guidelines: [
          'Include key discussion points and context',
          'Balance detail with conciseness',
          'Organize with clear headings and bullet points',
          'Include rationale for important decisions'
        ]
      },

      comprehensive: {
        targetWords: '800-1500',
        guidelines: [
          'Provide full context and background',
          'Include different perspectives discussed',
          'Detail the decision-making process',
          'Preserve important nuances and quotes'
        ]
      }
    };
  }

  /**
   * Get formatting guidelines
   */
  static getFormattingGuidelines() {
    return {
      structure: [
        'Use clear, descriptive headings',
        'Employ bullet points for lists and action items',
        'Maintain consistent formatting throughout',
        'Use bold text for emphasis on key points',
        'Include owner names and deadlines for action items'
      ],

      language: [
        'Use active voice and clear, direct language',
        'Avoid jargon unless necessary for accuracy',
        'Be specific with dates, numbers, and commitments',
        'Maintain professional but accessible tone',
        'Preserve exact quotes for important decisions'
      ],

      actionItems: [
        'Format: [Task] - Owner: [Name] - Due: [Date]',
        'Include priority level when discussed',
        'Note dependencies between tasks',
        'Specify success criteria when mentioned',
        'Include follow-up requirements'
      ]
    };
  }

  /**
   * Build complete prompt with template components
   */
  static buildPromptFromTemplate(templateType, customizations = {}) {
    const basePrompt = this.getBaseSystemPrompt();
    const stylePrompts = this.getStylePrompts();
    const meetingTypes = this.getMeetingTypeTemplates();
    const qualityGuidelines = this.getQualityGuidelines();
    const formattingGuidelines = this.getFormattingGuidelines();

    let prompt = basePrompt;

    // Add style-specific instructions
    if (stylePrompts[templateType]) {
      prompt += '\n\n' + stylePrompts[templateType].prompt;
    }

    // Add meeting type specific instructions
    if (customizations.meetingType && meetingTypes[customizations.meetingType]) {
      prompt += '\n\n' + meetingTypes[customizations.meetingType].additionalInstructions;
    }

    // Add quality guidelines
    if (customizations.length && qualityGuidelines[customizations.length]) {
      const guidelines = qualityGuidelines[customizations.length];
      prompt += `\n\nTARGET LENGTH: ${guidelines.targetWords} words\n`;
      prompt += 'QUALITY GUIDELINES:\n';
      guidelines.guidelines.forEach(guideline => {
        prompt += `• ${guideline}\n`;
      });
    }

    // Add formatting guidelines
    prompt += '\n\nFORMATTING REQUIREMENTS:\n';
    formattingGuidelines.structure.forEach(rule => {
      prompt += `• ${rule}\n`;
    });

    return prompt;
  }
}

module.exports = PromptTemplates;
