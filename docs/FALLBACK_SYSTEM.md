# 🔄 Fallback System Documentation

The Meeting Summarizer includes an intelligent fallback system that automatically selects the optimal AI model and handles failures gracefully.

## 🎯 Overview

The fallback system provides:
- **Intelligent model selection** based on content, cost, and performance requirements
- **Automatic retry logic** with exponential backoff
- **Cost optimization** through smart model switching
- **Performance monitoring** and statistics tracking
- **Configurable strategies** for different use cases

## 🧠 Decision Engine

### Model Selection Strategies

#### Smart Strategy (Default)
- **Technical/Detailed summaries**: Primary model (llama-3.3-70b-versatile)
- **Executive/Action-items**: Fallback model (llama-3.1-8b-instant)
- **Cost consideration**: Switch to fallback if cost > $0.05
- **Urgency consideration**: Use fallback for high-urgency requests

#### Cost Strategy
- **Prioritizes cost savings** over quality
- **Uses fallback model** for most summaries
- **Primary model only** for complex content

#### Speed Strategy
- **Prioritizes response time**
- **Uses fallback model** for all summaries
- **Optimized for low latency**

#### Quality Strategy
- **Prioritizes output quality**
- **Uses primary model** for all summaries
- **Cost and speed are secondary

### Decision Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| **Summary Style** | High | Technical/detailed → Primary, Executive/action → Fallback |
| **Content Complexity** | High | >50K tokens → Primary, <20K tokens → Fallback eligible |
| **Estimated Cost** | Medium | >$0.05 → Consider fallback |
| **Urgency** | Medium | High urgency → Prefer fallback for speed |
| **Session History** | Low | Past performance influences decisions |

## 🔄 Retry Logic

### Retryable Errors
- **Rate limit exceeded** (HTTP 429)
- **Service unavailable** (HTTP 5xx)
- **Request timeout**
- **Network errors**
- **Temporary failures**

### Retry Strategy
1. **Primary model fails** → Switch to fallback model
2. **Fallback model fails** → Retry with exponential backoff
3. **Max retries reached** → Return error with details

### Backoff Calculation
```
Delay = baseDelay × (multiplier ^ attemptNumber)
Base delay: 2 seconds
Multiplier: 1.5x
Max delay: 30 seconds
```

## 📊 Performance Monitoring

### Statistics Tracked
- **Primary model**: Attempts, successes, avg processing time
- **Fallback model**: Attempts, successes, avg processing time
- **Overall**: Total retries, fallback utilization rate

### Example Statistics
```json
{
  "primary": {
    "attempts": 45,
    "successes": 42,
    "successRate": "93.3%",
    "avgProcessingTime": "8500ms"
  },
  "fallback": {
    "attempts": 23,
    "successes": 23,
    "successRate": "100.0%",
    "avgProcessingTime": "3200ms"
  },
  "overall": {
    "totalRetries": 8,
    "fallbackUtilization": "33.8%"
  }
}
```

## ⚙️ Configuration

### Environment Variables

```bash
# Cost thresholds
MAX_PRIMARY_COST=0.05          # $0.05 per summary
MAX_FALLBACK_COST=0.02         # $0.02 per summary
COST_SAVINGS_THRESHOLD=0.70    # 70% savings triggers fallback

# Latency thresholds
MAX_PRIMARY_LATENCY=30000      # 30 seconds
MAX_FALLBACK_LATENCY=15000     # 15 seconds
FAST_RESPONSE_THRESHOLD=5000   # 5 seconds

# Token thresholds
LARGE_SUMMARY_TOKENS=20000     # Use fallback for large inputs
COMPLEX_SUMMARY_TOKENS=50000   # Always use primary for complex

# Retry configuration
MAX_FALLBACK_RETRIES=3         # Maximum retry attempts
RETRY_DELAY=2000               # Base retry delay (ms)
BACKOFF_MULTIPLIER=1.5         # Exponential backoff multiplier

# Strategy selection
FALLBACK_STRATEGY=smart        # smart, cost, speed, quality
QUALITY_PREFERENCE=balanced    # high, balanced, fast

# Feature toggles
ENABLE_COST_OPTIMIZATION=true
ENABLE_LATENCY_OPTIMIZATION=true
ENABLE_LOAD_BALANCING=true
```

## 🚀 API Usage

### Generate Summary with Fallback Options

```javascript
POST /api/summaries/generate
{
  "transcriptId": "transcript-123",
  "summaryStyle": "executive",
  "customInstructions": "Focus on key decisions",
  "urgency": "high",           // normal, high
  "forceModel": "fallback"     // primary, fallback, null
}
```

### Get Fallback Statistics

```javascript
GET /api/summaries/stats/fallback

Response:
{
  "success": true,
  "statistics": {
    "primary": { "attempts": 45, "successRate": "93.3%" },
    "fallback": { "attempts": 23, "successRate": "100.0%" },
    "overall": { "fallbackUtilization": "33.8%" }
  },
  "configuration": {
    "strategy": "smart",
    "costThresholds": { "maxPrimaryCost": 0.05 },
    "latencyThresholds": { "maxPrimaryLatency": 30000 }
  }
}
```

### Test Fallback Scenarios

```javascript
GET /api/summaries/test/fallback

Response:
{
  "success": true,
  "scenarios": [
    {
      "scenario": "High Cost Scenario",
      "decision": {
        "model": "fallback",
        "reason": "cost_optimization",
        "confidence": 0.8
      }
    }
  ]
}
```

## 🧪 Testing

### Test Commands

```bash
# Test fallback system
npm run test:fallback

# Test summary service with fallback
npm run test:summary

# Test Groq API configuration
npm run test:groq
```

### Test Scenarios

The system automatically tests:
- **High cost scenarios** (>$0.05 estimated)
- **High urgency scenarios** (time-sensitive)
- **Simple summary scenarios** (executive style)
- **Complex technical scenarios** (detailed content)

## 💡 Best Practices

### For Developers

1. **Monitor fallback utilization** - High utilization may indicate primary model issues
2. **Set appropriate thresholds** - Balance cost, quality, and performance
3. **Handle errors gracefully** - Always provide meaningful error messages
4. **Log decision reasons** - Track why fallback decisions were made
5. **Test failure scenarios** - Ensure retry logic works correctly

### For Users

1. **Choose appropriate urgency** - High urgency uses faster fallback model
2. **Consider summary style** - Executive summaries work well with fallback
3. **Monitor costs** - Fallback model is 3x cheaper than primary
4. **Provide feedback** - Help improve decision algorithms
5. **Use force options sparingly** - Let the system choose optimal model

## 🔍 Troubleshooting

### Common Issues

#### High Fallback Utilization
- **Cause**: Primary model frequently failing or too expensive
- **Solution**: Check API key, adjust cost thresholds, monitor service status

#### Low Success Rates
- **Cause**: Network issues, service problems, or invalid requests
- **Solution**: Check connectivity, validate inputs, review error logs

#### Slow Response Times
- **Cause**: High latency thresholds, network issues, or model overload
- **Solution**: Adjust latency thresholds, use fallback model, check network

### Debug Information

Enable debug logging:
```bash
LOG_LEVEL=debug
NODE_ENV=development
```

Check fallback decisions in logs:
```
🤖 Model selected: fallback (cost_optimization)
🔄 Attempt 1: Using fallback model
✅ Summary generated with fallback model
```

## 📈 Performance Optimization

### Recommendations

1. **Use smart strategy** for balanced performance
2. **Set realistic thresholds** based on your requirements
3. **Monitor session history** for decision improvements
4. **Adjust retry limits** based on failure patterns
5. **Consider cost vs quality** trade-offs for your use case

Your fallback system is now production-ready with intelligent decision-making and robust error handling! 🚀
