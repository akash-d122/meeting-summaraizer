# 🧠 Prompt Engineering Documentation

This document explains the prompt engineering system designed for optimal meeting summarization using Groq's llama-3.3-70b-versatile model.

## 📋 Overview

The prompt engineering system combines:
- **Custom user instructions** from the frontend
- **Style-specific templates** for different summary types
- **Context optimization** for the 131K token window
- **Cost-aware token management** for efficient processing

## 🏗️ Architecture

### Core Components

1. **PromptEngine** (`services/promptEngine.js`)
   - Main orchestrator for prompt generation
   - Token counting and validation
   - Cost estimation and optimization

2. **PromptTemplates** (`services/promptTemplates.js`)
   - Reusable prompt components
   - Style-specific templates
   - Meeting type optimizations

3. **Integration Layer**
   - Database transcript integration
   - Custom instruction system integration
   - Groq API preparation

## 🎯 Summary Styles

### Executive Summary
- **Target**: Leadership and stakeholders
- **Focus**: Strategic decisions, business impact, resource needs
- **Length**: 300-500 words
- **Temperature**: 0.1 (focused and consistent)
- **Max Tokens**: 1,500

### Action Items & Decisions
- **Target**: Project managers and team leads
- **Focus**: Specific tasks, owners, deadlines, dependencies
- **Length**: Variable based on action count
- **Temperature**: 0.05 (extremely precise)
- **Max Tokens**: 2,000

### Technical Summary
- **Target**: Engineering teams and technical stakeholders
- **Focus**: Technical decisions, architecture, implementation details
- **Length**: 400-600 words
- **Temperature**: 0.1 (precise technical language)
- **Max Tokens**: 2,500

### Detailed Overview
- **Target**: Complete meeting records
- **Focus**: Comprehensive coverage, all discussion points
- **Length**: 800-1,500 words
- **Temperature**: 0.15 (slightly more creative for coverage)
- **Max Tokens**: 3,000

## 🔧 Token Management

### Context Window Optimization

```javascript
// Token allocation for 131K context window
const maxContextTokens = 131072;
const systemPromptTokens = 500;    // Instructions and guidelines
const formattingTokens = 200;      // Structure and formatting
const safetyBuffer = 1000;         // Error prevention
const maxTranscriptTokens = 129372; // Available for transcript content
```

### Intelligent Truncation

When transcripts exceed token limits:
1. **Smart breaking points**: End of sentences, paragraphs
2. **Preserve important content**: Keep 80% minimum
3. **Add truncation notice**: Inform about content limits
4. **Maintain context**: Preserve meeting metadata

## 💰 Cost Optimization

### Model Pricing (llama-3.3-70b-versatile)
- **Input**: $0.59 per 1M tokens
- **Output**: $0.79 per 1M tokens

### Cost Examples
| Meeting Size | Input Tokens | Output Tokens | Estimated Cost |
|--------------|--------------|---------------|----------------|
| Small (5 min) | 800 | 500 | $0.0009 |
| Medium (30 min) | 3,000 | 1,000 | $0.0026 |
| Large (60 min) | 8,000 | 2,000 | $0.0063 |
| Very Large (2 hr) | 20,000 | 3,000 | $0.0155 |

### Optimization Strategies
1. **Style-specific token limits**: Prevent over-generation
2. **Temperature tuning**: Lower for factual content
3. **Intelligent truncation**: Preserve quality while reducing cost
4. **Fallback model option**: Use cheaper model when appropriate

## 🎨 Prompt Structure

### System Prompt Components

```
1. Base Instructions (Core Principles)
   ├── Professional tone and clarity
   ├── Focus on outcomes and decisions
   ├── Logical organization
   └── Confidentiality and discretion

2. Style-Specific Instructions
   ├── Executive: Strategic focus
   ├── Action Items: Accountability focus
   ├── Technical: Implementation focus
   └── Detailed: Comprehensive coverage

3. Custom User Instructions
   ├── Specific formatting requests
   ├── Audience considerations
   ├── Priority areas
   └── Exclusion criteria

4. Quality Guidelines
   ├── Target length specifications
   ├── Formatting requirements
   ├── Action item structure
   └── Validation criteria
```

### User Prompt Structure

```
MEETING METADATA:
Date: [Meeting date]
Attendees: [Participant list]
Duration: [Meeting length]
Type: [Meeting category]

MEETING TRANSCRIPT:
[Full transcript content with intelligent truncation if needed]

[Truncation notice if applicable]
```

## 🧪 Testing and Validation

### Prompt Validation Checks

1. **Token Limits**
   - Context window compliance (< 131K tokens)
   - Output token limits per style
   - Safety buffer maintenance

2. **Content Quality**
   - Non-empty transcript content
   - Valid message structure
   - Appropriate temperature settings

3. **Cost Efficiency**
   - Token utilization warnings
   - Cost estimation accuracy
   - Optimization suggestions

### Test Commands

```bash
# Test prompt generation logic
npm run test:prompts

# See integration example
npm run example:prompts

# Test with real Groq API
npm run example:groq
```

## 🔗 Integration Points

### Database Integration

```javascript
// Load transcript and instructions from database
const transcript = await MeetingTranscript.findByPk(transcriptId);
const instructions = transcript.metadata?.instructions || {};

// Generate optimized prompt
const promptData = promptEngine.buildSummaryPrompt(
  transcript.content,
  {
    summaryStyle: instructions.summaryStyle,
    customInstructions: instructions.customInstructions,
    transcriptMetadata: {
      date: transcript.createdAt,
      attendees: transcript.metadata.attendees,
      duration: transcript.metadata.duration
    }
  }
);
```

### Groq API Integration

```javascript
// Prepare for Groq API call
const groqRequest = {
  model: "llama-3.3-70b-versatile",
  messages: promptData.messages,
  max_tokens: promptData.maxTokens,
  temperature: promptData.temperature,
  stream: false
};

// Make API call
const completion = await groq.chat.completions.create(groqRequest);
```

## 📊 Performance Metrics

### Quality Indicators
- **Token utilization**: < 90% of context window
- **Cost efficiency**: < $0.02 per summary
- **Processing time**: < 30 seconds per summary
- **Validation success**: 100% prompt validation

### Monitoring Points
- Average tokens per summary style
- Cost per summary by meeting size
- Validation failure rates
- User satisfaction with output quality

## 🚀 Best Practices

### For Developers

1. **Always validate prompts** before API calls
2. **Monitor token usage** and costs
3. **Use appropriate temperatures** for content type
4. **Implement intelligent truncation** for large transcripts
5. **Cache prompt templates** for performance

### For Users

1. **Provide specific instructions** for better results
2. **Choose appropriate summary style** for audience
3. **Include meeting context** in metadata
4. **Review and edit** generated summaries
5. **Use action-items style** for task tracking

## 🔧 Configuration

### Environment Variables

```bash
# Model configuration
GROQ_MODEL_PRIMARY=llama-3.3-70b-versatile
GROQ_MAX_TOKENS=32768
GROQ_TEMPERATURE=0.1

# Performance tuning
GROQ_TIMEOUT=30000
PROMPT_CACHE_TTL=3600
```

### Customization Options

- **Style templates**: Modify in `promptTemplates.js`
- **Token limits**: Adjust in `promptEngine.js`
- **Cost thresholds**: Configure in environment
- **Quality guidelines**: Update template components

## 🎯 Future Enhancements

1. **Dynamic style selection** based on content analysis
2. **Multi-language support** for international meetings
3. **Industry-specific templates** for specialized domains
4. **Adaptive token allocation** based on content complexity
5. **Real-time cost optimization** with usage analytics

Your prompt engineering system is now ready for production-grade meeting summarization! 🚀
