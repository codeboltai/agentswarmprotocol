/**
 * Example agent that demonstrates how to use services
 * This agent consumes the LLM Service to generate text and handle chat responses
 */
const { SwarmAgentSDK } = require('../index');

// Load environment variables
require('dotenv').config();

// Create the agent
const agent = new SwarmAgentSDK({
  name: 'Assistant Agent',
  description: 'Agent that uses LLM service to answer questions',
  capabilities: ['answer-question', 'generate-content'],
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000'
});

// Register task handler for answering questions
agent.onMessage('answer-question', async (taskData, metadata) => {
  console.log('Received question task:', taskData);
  
  if (!taskData.question) {
    return { error: 'Question is required' };
  }
  
  // Send notification that we're processing
  await agent.sendTaskNotification({
    taskId: metadata.taskId,
    notificationType: 'info',
    message: 'Processing your question...'
  });

  try {
    // Get available services
    const services = await agent.getServiceList({ capabilities: ['chat'] });
    
    if (services.length === 0) {
      throw new Error('No LLM service available');
    }
    
    // Find the LLM service
    const llmService = services.find(s => s.name.toLowerCase().includes('llm'));
    
    if (!llmService) {
      throw new Error('LLM service not found');
    }
    
    // Update client
    await agent.sendTaskNotification({
      taskId: metadata.taskId,
      notificationType: 'info',
      message: `Using service: ${llmService.name}`
    });
    
    // Prepare chat messages
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: taskData.question }
    ];
    
    // Call the LLM service with notification handling
    const result = await agent.executeServiceTask(
      llmService.id,
      'chat',
      { 
        messages,
        model: taskData.model || 'gpt-4',
        temperature: taskData.temperature || 0.7
      },
      {
        clientId: metadata.clientId, // Forward notifications to the client
        onNotification: async (notification) => {
          // We can process service notifications here
          console.log('Service notification:', notification.message);
          
          // We can also forward them to the client with our own context
          await agent.sendTaskNotification({
            taskId: metadata.taskId,
            notificationType: notification.notificationType,
            message: `Service: ${notification.message}`,
            data: notification.data
          });
        }
      }
    );
    
    // Return the answer
    return {
      answer: result.response,
      model: result.model,
      usage: result.usage
    };
  } catch (error) {
    console.error('Error answering question:', error);
    
    // Send error notification
    await agent.sendTaskNotification({
      taskId: metadata.taskId,
      notificationType: 'error',
      message: `Error: ${error.message}`,
      level: 'error'
    });
    
    // Return error
    return { error: error.message };
  }
});

// Register task handler for content generation
agent.onMessage('generate-content', async (taskData, metadata) => {
  console.log('Received content generation task:', taskData);
  
  if (!taskData.prompt) {
    return { error: 'Prompt is required' };
  }
  
  // Send notification that we're processing
  await agent.sendTaskNotification({
    taskId: metadata.taskId,
    notificationType: 'info',
    message: 'Starting content generation...'
  });

  try {
    // Get available services
    const services = await agent.getServiceList({ capabilities: ['generate'] });
    
    if (services.length === 0) {
      throw new Error('No LLM service available for content generation');
    }
    
    // Find the LLM service
    const llmService = services.find(s => s.name.toLowerCase().includes('llm'));
    
    if (!llmService) {
      throw new Error('LLM service not found');
    }
    
    // Update client
    await agent.sendTaskNotification({
      taskId: metadata.taskId,
      notificationType: 'info',
      message: `Using service: ${llmService.name}`
    });
    
    // Call the LLM service with notification handling
    const result = await agent.executeServiceTask(
      llmService.id,
      'generate',
      { 
        prompt: taskData.prompt,
        model: taskData.model || 'gpt-4',
        temperature: taskData.temperature || 0.7,
        maxTokens: taskData.maxTokens || 500
      },
      {
        clientId: metadata.clientId, // Forward notifications to client
        onNotification: async (notification) => {
          // Forward service notifications to client
          await agent.sendTaskNotification({
            taskId: metadata.taskId,
            notificationType: notification.notificationType,
            message: `Generator: ${notification.message}`,
            data: notification.data
          });
        }
      }
    );
    
    // Return the generated content
    return {
      content: result.text,
      model: result.model,
      usage: result.usage
    };
  } catch (error) {
    console.error('Error generating content:', error);
    
    // Send error notification
    await agent.sendTaskNotification({
      taskId: metadata.taskId,
      notificationType: 'error',
      message: `Error: ${error.message}`,
      level: 'error'
    });
    
    // Return error
    return { error: error.message };
  }
});

// Set up event listeners
agent.on('connected', () => {
  console.log('Agent connected to orchestrator');
});

agent.on('registered', (info) => {
  console.log('Agent registered successfully:', info);
  console.log(`Agent ID: ${agent.agentId}`);
});

agent.on('error', (error) => {
  console.error('Agent error:', error.message);
});

// Connect to the orchestrator
agent.connect()
  .then(() => {
    console.log('Agent running and ready to accept tasks');
  })
  .catch(error => {
    console.error('Failed to connect to orchestrator:', error.message);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down agent...');
  agent.disconnect();
  process.exit(0);
}); 