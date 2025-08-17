const Groq = require('groq-sdk');
require('dotenv').config();

// Groq API Configuration
const groqConfig = {
  apiKey: process.env.GROQ_API_KEY,
  baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  timeout: parseInt(process.env.GROQ_TIMEOUT) || 30000,
  maxRetries: 3
};

// Model configurations
const modelConfig = {
  primary: {
    name: process.env.GROQ_MODEL_PRIMARY || 'llama-3.3-70b-versatile',
    maxTokens: parseInt(process.env.GROQ_MAX_TOKENS) || 32768,
    temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.1,
    contextWindow: 131072, // 131K tokens
    costPer1KTokens: {
      input: 0.00059,  // $0.59 per 1M input tokens
      output: 0.00079  // $0.79 per 1M output tokens
    }
  },
  fallback: {
    name: process.env.GROQ_MODEL_FALLBACK || 'llama-3.1-8b-instant',
    maxTokens: parseInt(process.env.GROQ_MAX_TOKENS) || 32768,
    temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.1,
    contextWindow: 131072, // 131K tokens
    costPer1KTokens: {
      input: 0.00018,  // $0.18 per 1M input tokens
      output: 0.00018  // $0.18 per 1M output tokens
    }
  }
};

// Initialize Groq client
let groqClient = null;

const initializeGroqClient = () => {
  try {
    if (!groqConfig.apiKey) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }

    if (groqConfig.apiKey === 'your_groq_api_key_here') {
      throw new Error('Please set a valid GROQ_API_KEY in your environment variables');
    }

    groqClient = new Groq({
      apiKey: groqConfig.apiKey,
      baseURL: groqConfig.baseURL,
      timeout: groqConfig.timeout,
      maxRetries: groqConfig.maxRetries
    });

    console.log('✅ Groq client initialized successfully');
    console.log(`📊 Primary model: ${modelConfig.primary.name}`);
    console.log(`🔄 Fallback model: ${modelConfig.fallback.name}`);
    
    return groqClient;
  } catch (error) {
    console.error('❌ Failed to initialize Groq client:', error.message);
    throw error;
  }
};

// Get Groq client instance
const getGroqClient = () => {
  if (!groqClient) {
    groqClient = initializeGroqClient();
  }
  return groqClient;
};

// Test API connection
const testGroqConnection = async () => {
  try {
    const client = getGroqClient();
    
    // Make a simple test request
    const testResponse = await client.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with just "Connection successful" to test the API.'
        }
      ],
      model: modelConfig.primary.name,
      max_tokens: 50,
      temperature: 0
    });

    const responseText = testResponse.choices[0]?.message?.content?.trim();
    
    if (responseText) {
      console.log('✅ Groq API connection test successful');
      console.log(`📝 Test response: "${responseText}"`);
      console.log(`🔢 Tokens used: ${testResponse.usage?.total_tokens || 'N/A'}`);
      return {
        success: true,
        response: responseText,
        usage: testResponse.usage,
        model: testResponse.model
      };
    } else {
      throw new Error('Empty response from Groq API');
    }
  } catch (error) {
    console.error('❌ Groq API connection test failed:', error.message);
    return {
      success: false,
      error: error.message,
      details: error.response?.data || error.stack
    };
  }
};

// Calculate cost for token usage
const calculateCost = (usage, modelType = 'primary') => {
  if (!usage || !usage.prompt_tokens || !usage.completion_tokens) {
    return 0;
  }

  const model = modelConfig[modelType];
  const inputCost = (usage.prompt_tokens / 1000) * model.costPer1KTokens.input;
  const outputCost = (usage.completion_tokens / 1000) * model.costPer1KTokens.output;
  
  return inputCost + outputCost;
};

// Validate environment configuration
const validateGroqConfig = () => {
  const errors = [];
  const warnings = [];

  // Required configurations
  if (!process.env.GROQ_API_KEY) {
    errors.push('GROQ_API_KEY environment variable is missing');
  } else if (process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
    errors.push('GROQ_API_KEY is set to placeholder value');
  }

  // Optional configurations with warnings
  if (!process.env.GROQ_MODEL_PRIMARY) {
    warnings.push('GROQ_MODEL_PRIMARY not set, using default: llama-3.3-70b-versatile');
  }

  if (!process.env.GROQ_MODEL_FALLBACK) {
    warnings.push('GROQ_MODEL_FALLBACK not set, using default: llama-3.1-8b-instant');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config: {
      apiKey: process.env.GROQ_API_KEY ? '***' + process.env.GROQ_API_KEY.slice(-4) : 'Not set',
      primaryModel: modelConfig.primary.name,
      fallbackModel: modelConfig.fallback.name,
      baseURL: groqConfig.baseURL,
      timeout: groqConfig.timeout
    }
  };
};

// Get model information
const getModelInfo = (modelType = 'primary') => {
  return modelConfig[modelType];
};

// Get all available models
const getAvailableModels = () => {
  return {
    primary: modelConfig.primary,
    fallback: modelConfig.fallback
  };
};

module.exports = {
  groqConfig,
  modelConfig,
  initializeGroqClient,
  getGroqClient,
  testGroqConnection,
  calculateCost,
  validateGroqConfig,
  getModelInfo,
  getAvailableModels
};
