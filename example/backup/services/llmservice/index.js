/**
 * LLM Service using SwarmServiceSDK
 * Provides language model operations with real-time progress notifications
 */
const { SwarmServiceSDK } = require('../../sdk/servicesdk/index');
require('dotenv').config();

// Default configuration - normally would connect to actual API providers
const DEFAULT_CONFIG = {
  defaultModel: 'gpt-3.5-turbo',
  defaultTimeout: 60000,
  supportedModels: [
    'gpt-3.5-turbo',
    'gpt-4',
    'claude-2',
    'claude-instant'
  ]
};

/**
 * Initialize and start the LLM Service
 * @param {Object} config - Configuration options
 * @returns {SwarmServiceSDK} The service instance
 */
function startLLMService(config = {}) {
  // Merge default config with provided config
  const serviceConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };

  // Create LLM service
  const llmService = new SwarmServiceSDK({
    name: config.name || 'LLM Service',
    description: config.description || 'A service for language model operations',
    capabilities: ['generate', 'chat', 'embed', 'summarize', 'classify'],
    orchestratorUrl: config.orchestratorUrl || process.env.ORCHESTRATOR_SERVICE_URL || 'ws://localhost:3002',
    manifest: {
      supportedModels: serviceConfig.supportedModels,
      defaultModel: serviceConfig.defaultModel,
      features: {
        streaming: true,
        contextWindow: 16000,
        functionCalling: true
      }
    }
  });

  // Simulate API call - in production, this would connect to the actual LLM API
  async function simulateLLMAPI(prompt, options = {}) {
    // Simulate API delay
    const delay = options.delay || Math.floor(Math.random() * 2000) + 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Simulate token generation
    const words = prompt.split(' ');
    const responseLength = Math.min(50, words.length * 2);
    const responseParts = [];
    
    // Generate parts of response with pauses to simulate streaming
    for (let i = 0; i < responseLength; i++) {
      responseParts.push(`Response token ${i + 1}`);
      if (options.streamCallback) {
        options.streamCallback(responseParts.join(' '));
        // Small delay between "tokens"
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return {
      content: responseParts.join(' '),
      model: options.model || serviceConfig.defaultModel,
      usage: {
        promptTokens: words.length,
        completionTokens: responseLength,
        totalTokens: words.length + responseLength
      }
    };
  }

  // Register the 'generate' function for text generation
  llmService.onTask('generate', async (params, notify, metadata) => {
    console.log('Received text generation request:', params);
    
    const { 
      prompt, 
      model = serviceConfig.defaultModel,
      maxTokens = 500, 
      temperature = 0.7,
      stream = false
    } = params;
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }
    
    // Send initial progress notification
    await notify('Starting text generation...', { 
      progress: 0,
      model
    });
    
    try {
      // Check if the model is supported
      if (!serviceConfig.supportedModels.includes(model)) {
        throw new Error(`Model ${model} is not supported. Supported models: ${serviceConfig.supportedModels.join(', ')}`);
      }
      
      // Notify that we're sending the prompt to the language model
      await notify('Sending prompt to language model...', { 
        progress: 20,
        promptLength: prompt.length
      });
      
      // Set up streaming callback if streaming is enabled
      let generatedText = '';
      let lastProgressUpdate = Date.now();
      
      const streamCallback = stream ? (text) => {
        generatedText = text;
        
        // Only send progress updates every 500ms to avoid overwhelming the client
        const now = Date.now();
        if (now - lastProgressUpdate > 500) {
          lastProgressUpdate = now;
          notify('Generating text...', {
            progress: Math.min(90, 20 + (text.length / (maxTokens * 5)) * 70),
            partialText: text
          }, 'progress');
        }
      } : null;
      
      // Call the language model (simulated in this example)
      const result = await simulateLLMAPI(prompt, {
        model,
        maxTokens,
        temperature,
        streamCallback
      });
      
      // Send completion notification
      await notify('Text generation complete', {
        progress: 100
      });
      
      // Return the result
      return {
        text: result.content,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      // Send error notification
      await notify(`Error generating text: ${error.message}`, {}, 'error');
      throw error;
    }
  });

  // Register the 'chat' function for conversational AI
  llmService.onTask('chat', async (params, notify, metadata) => {
    console.log('Received chat request:', params);
    
    const { 
      messages, 
      model = serviceConfig.defaultModel,
      temperature = 0.7,
      stream = false
    } = params;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Chat messages are required and must be an array');
    }
    
    // Send initial progress notification
    await notify('Starting chat completion...', { 
      progress: 0,
      model
    });
    
    try {
      // Check if the model is supported
      if (!serviceConfig.supportedModels.includes(model)) {
        throw new Error(`Model ${model} is not supported. Supported models: ${serviceConfig.supportedModels.join(', ')}`);
      }
      
      // Construct a combined prompt from messages
      const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      
      // Notify that we're sending the messages to the language model
      await notify('Processing chat messages...', { 
        progress: 20,
        messageCount: messages.length
      });
      
      // Set up streaming callback if streaming is enabled
      let generatedResponse = '';
      let lastProgressUpdate = Date.now();
      
      const streamCallback = stream ? (text) => {
        generatedResponse = text;
        
        // Only send progress updates every 500ms to avoid overwhelming the client
        const now = Date.now();
        if (now - lastProgressUpdate > 500) {
          lastProgressUpdate = now;
          notify('Generating response...', {
            progress: Math.min(90, 20 + (text.length / 500) * 70),
            partialResponse: text
          }, 'progress');
        }
      } : null;
      
      // Call the language model (simulated in this example)
      const result = await simulateLLMAPI(prompt, {
        model,
        temperature,
        streamCallback
      });
      
      // Send completion notification
      await notify('Chat completion finished', {
        progress: 100
      });
      
      // Return the result
      return {
        message: {
          role: 'assistant',
          content: result.content
        },
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      // Send error notification
      await notify(`Error in chat completion: ${error.message}`, {}, 'error');
      throw error;
    }
  });

  // Register the 'embed' function for text embeddings
  llmService.onTask('embed', async (params, notify, metadata) => {
    console.log('Received embedding request:', params);
    
    const { 
      text, 
      model = 'text-embedding-ada-002' // Default embedding model
    } = params;
    
    if (!text) {
      throw new Error('Text is required for embedding');
    }
    
    // Send initial progress notification
    await notify('Starting text embedding...', { 
      progress: 0,
      model
    });
    
    try {
      // Notify that we're processing the text
      await notify('Processing text for embedding...', { 
        progress: 30,
        textLength: typeof text === 'string' ? text.length : text.join('').length
      });
      
      // Simulate embedding generation (in real implementation, would call embedding API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate mock embeddings - in production this would come from the embedding model
      const dimension = 384; // Common embedding dimension
      const embedding = Array.from({ length: dimension }, () => (Math.random() * 2 - 1));
      
      // Normalize the embedding vector
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      const normalizedEmbedding = embedding.map(val => val / magnitude);
      
      // Send completion notification
      await notify('Text embedding complete', {
        progress: 100,
        dimensions: dimension
      });
      
      // Return the result
      return {
        embedding: normalizedEmbedding,
        dimensions: dimension,
        model,
        usage: {
          promptTokens: typeof text === 'string' ? text.split(' ').length : text.join(' ').split(' ').length,
          totalTokens: typeof text === 'string' ? text.split(' ').length : text.join(' ').split(' ').length
        }
      };
    } catch (error) {
      // Send error notification
      await notify(`Error generating embedding: ${error.message}`, {}, 'error');
      throw error;
    }
  });

  // Register the 'summarize' function for text summarization
  llmService.onTask('summarize', async (params, notify, metadata) => {
    console.log('Received summarize request:', params);
    
    const { 
      text, 
      model = serviceConfig.defaultModel,
      maxLength = 200,
      temperature = 0.3
    } = params;
    
    if (!text) {
      throw new Error('Text is required for summarization');
    }
    
    // Send initial progress notification
    await notify('Starting text summarization...', { 
      progress: 0,
      model,
      textLength: text.length
    });
    
    try {
      // Create a summarization prompt
      const prompt = `Summarize the following text in ${maxLength} words or less:\n\n${text}`;
      
      // Notify that we're analyzing the text
      await notify('Analyzing text...', { 
        progress: 20
      });
      
      // Small delay to simulate text analysis
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Notify that we're generating the summary
      await notify('Generating summary...', { 
        progress: 50
      });
      
      // Call the language model (simulated in this example)
      const result = await simulateLLMAPI(prompt, {
        model,
        temperature,
        maxTokens: maxLength * 1.5 // Approximate tokens based on words
      });
      
      // Send completion notification
      await notify('Summarization complete', {
        progress: 100
      });
      
      // Return the result
      return {
        summary: result.content,
        originalLength: text.length,
        summaryLength: result.content.length,
        compressionRatio: result.content.length / text.length,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      // Send error notification
      await notify(`Error summarizing text: ${error.message}`, {}, 'error');
      throw error;
    }
  });

  // Set up event listeners
  llmService.on('connected', () => {
    console.log('LLM Service connected to orchestrator');
  });

  llmService.on('registered', (info) => {
    console.log('LLM Service registered successfully:', info);
    console.log(`Service ID: ${llmService.serviceId}`);
  });

  llmService.on('error', (error) => {
    console.error('LLM Service error:', error.message);
  });

  llmService.on('disconnected', () => {
    console.log('LLM Service disconnected from orchestrator');
  });

  // Connect to the orchestrator
  llmService.connect()
    .then(() => {
      console.log('LLM Service running and ready to accept tasks');
    })
    .catch(error => {
      console.error('Failed to connect to orchestrator:', error.message);
      process.exit(1);
    });

  return llmService;
}

// If file is run directly, start the service
if (require.main === module) {
  // Configuration from environment variables
  const config = {
    orchestratorUrl: process.env.ORCHESTRATOR_SERVICE_URL || 'ws://localhost:3002',
    name: process.env.SERVICE_NAME || 'LLM Service',
    description: process.env.SERVICE_DESCRIPTION || 'A service for language model operations',
    defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-3.5-turbo',
    apiKeys: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY
    }
  };

  console.log('Starting LLM Service with config:', {
    ...config,
    apiKeys: config.apiKeys ? Object.keys(config.apiKeys).filter(k => !!config.apiKeys[k]).join(', ') : 'none'
  });

  // Start the service
  const service = startLLMService(config);

  // Handle process signals for graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down LLM Service...');
    service.disconnect();
    setTimeout(() => process.exit(0), 1000);
  });

  process.on('SIGTERM', () => {
    console.log('Terminating LLM Service...');
    service.disconnect();
    setTimeout(() => process.exit(0), 1000);
  });
}

module.exports = {
  startLLMService
}; 