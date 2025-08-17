# 🔑 Groq API Setup Guide

This guide will help you set up Groq API credentials for the Meeting Summarizer application.

## 📋 Prerequisites

- Node.js 16+ installed
- Meeting Summarizer project cloned and dependencies installed
- Internet connection for API access

## 🚀 Quick Setup

### Step 1: Get Your Groq API Key

1. **Visit Groq Console**: Go to [https://console.groq.com/keys](https://console.groq.com/keys)
2. **Sign Up/Login**: Create an account or log in to your existing Groq account
3. **Create API Key**: Click "Create API Key" and give it a descriptive name
4. **Copy Key**: Copy the generated API key (starts with `gsk_` and is ~56 characters long)

### Step 2: Configure Environment Variables

1. **Copy Environment Template**:
   ```bash
   cp .env.meeting-summarizer .env
   ```

2. **Edit the .env file** and replace the placeholder:
   ```bash
   # Before
   GROQ_API_KEY=your_groq_api_key_here
   
   # After (example)
   GROQ_API_KEY=gsk_1234567890abcdef1234567890abcdef1234567890abcdef123456
   ```

### Step 3: Test Your Configuration

Run the credential test:
```bash
npm run test:groq
```

You should see:
```
✅ API connection successful
🎉 All Groq API credential tests passed!
```

## 🆕 Modern SDK Approach

This implementation uses the **official groq-sdk** with the modern API pattern:

```javascript
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [{ role: "user", content: "Your prompt here" }]
});
```

**Benefits of Modern SDK:**
- ✅ **Simplified initialization** - no manual baseURL configuration
- ✅ **Better error handling** - enhanced error messages and status codes
- ✅ **Automatic retries** - built-in retry logic for transient failures
- ✅ **Streaming support** - real-time response streaming
- ✅ **Type safety** - better TypeScript support
- ✅ **Official support** - maintained by Groq team

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GROQ_API_KEY` | Your Groq API key | - | ✅ Yes |
| `GROQ_MODEL_PRIMARY` | Primary AI model | `llama-3.3-70b-versatile` | No |
| `GROQ_MODEL_FALLBACK` | Fallback AI model | `llama-3.1-8b-instant` | No |
| ~~`GROQ_BASE_URL`~~ | ~~API base URL~~ | ~~Auto-handled by modern SDK~~ | ~~No~~ |
| `GROQ_MAX_TOKENS` | Max output tokens | `32768` | No |
| `GROQ_TEMPERATURE` | AI creativity (0-1) | `0.1` | No |
| `GROQ_TIMEOUT` | Request timeout (ms) | `30000` | No |

### Model Information

#### Primary Model: llama-3.3-70b-versatile
- **Context Window**: 131,072 tokens (~100,000 words)
- **Max Output**: 32,768 tokens
- **Cost**: $0.59/1M input tokens, $0.79/1M output tokens
- **Best For**: High-quality summaries, complex instructions

#### Fallback Model: llama-3.1-8b-instant
- **Context Window**: 131,072 tokens
- **Max Output**: 32,768 tokens  
- **Cost**: $0.18/1M input tokens, $0.18/1M output tokens
- **Best For**: Fast processing, cost optimization

## 💰 Cost Estimation

### Example Costs (Primary Model)

| Meeting Size | Input Tokens | Output Tokens | Estimated Cost |
|--------------|--------------|---------------|----------------|
| Small (5 min) | 1,000 | 500 | $0.001 |
| Medium (30 min) | 5,000 | 1,000 | $0.004 |
| Large (60 min) | 20,000 | 2,000 | $0.014 |
| Very Large (2 hr) | 50,000 | 3,000 | $0.032 |

### Cost Optimization Tips

1. **Use Fallback Model**: 3x cheaper for simpler summaries
2. **Optimize Instructions**: Shorter, clearer instructions = lower costs
3. **Batch Processing**: Process multiple meetings together when possible
4. **Monitor Usage**: Check the health endpoint for cost tracking

## 🧪 Testing & Validation

### Test Commands

```bash
# Test API credentials (modern SDK)
npm run test:groq

# Run official SDK examples
npm run example:groq

# Check application health (includes Groq status)
curl http://localhost:3000/health

# Test full upload and instruction flow
npm run test:upload
npm run test:instructions
```

### Health Check Response

```json
{
  "status": "OK",
  "services": {
    "database": {"status": "connected"},
    "groq": {
      "status": "configured",
      "primaryModel": "llama-3.3-70b-versatile",
      "fallbackModel": "llama-3.1-8b-instant",
      "apiKey": "***f123"
    }
  }
}
```

## 🔒 Security Best Practices

### API Key Security

1. **Never commit API keys** to version control
2. **Use environment variables** only
3. **Rotate keys regularly** (every 90 days recommended)
4. **Monitor usage** for unexpected activity
5. **Use different keys** for development/production

### Access Control

- API keys are stored securely in environment variables
- Keys are masked in logs and health checks
- No API keys are exposed in frontend code
- Server-side validation prevents unauthorized access

## 🚨 Troubleshooting

### Common Issues

#### "GROQ_API_KEY environment variable is missing"
- **Solution**: Copy `.env.meeting-summarizer` to `.env` and add your API key

#### "GROQ_API_KEY is set to placeholder value"
- **Solution**: Replace `your_groq_api_key_here` with your actual API key

#### "API connection test failed"
- **Check**: API key is correct and starts with `gsk_`
- **Check**: Internet connection is working
- **Check**: Groq service status at [status.groq.com](https://status.groq.com)

#### "Request timeout"
- **Solution**: Increase `GROQ_TIMEOUT` value in `.env`
- **Check**: Network connectivity and firewall settings

### Debug Mode

Enable detailed logging:
```bash
# Add to .env
LOG_LEVEL=debug
NODE_ENV=development
```

### Support Resources

- **Groq Documentation**: [https://docs.groq.com](https://docs.groq.com)
- **API Reference**: [https://console.groq.com/docs](https://console.groq.com/docs)
- **Status Page**: [https://status.groq.com](https://status.groq.com)
- **Community**: [Groq Discord](https://discord.gg/groq)

## 🎯 Next Steps

Once your Groq API is configured:

1. **Test the integration**: Run `npm run test:groq`
2. **Start the server**: Run `npm start`
3. **Upload a transcript**: Visit `http://localhost:3000`
4. **Generate summaries**: Use the instruction system
5. **Monitor costs**: Check usage in Groq console

Your Meeting Summarizer is now ready for AI-powered summary generation! 🚀
