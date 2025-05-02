# SwarmServiceSDK

The SwarmServiceSDK provides a simple way for services to connect to and interact with the Agent Swarm Protocol orchestrator. Services can register functions that agents can call, and they can send notifications to clients about task progress.

## Installation

```bash
npm install @agent-swarm/service-sdk
```

## Basic Usage

```javascript
const { SwarmServiceSDK } = require('@agent-swarm/service-sdk');

// Create a new service
const service = new SwarmServiceSDK({
  name: 'LLM Service',
  description: 'A service for language model operations',
  capabilities: ['generate', 'chat', 'embed']
});

// Connect to the orchestrator
service.connect()
  .then(() => {
    console.log('Connected to orchestrator');
  })
  .catch(error => {
    console.error('Error:', error.message);
  });

// Register a function handler
service.registerFunction('generate', async (params, notifyProgress, metadata) => {
  console.log('Received generate function call:', params);
  console.log('Task metadata:', metadata);
  
  // Send progress notification to client
  await notifyProgress('Starting text generation...', { progress: 10 });
  
  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send another progress notification
  await notifyProgress('Processing prompt...', { progress: 50 });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send info notification
  await notifyProgress('Applying parameters...', { 
    temperature: params.temperature || 0.7,
    maxTokens: params.maxTokens || 100
  }, 'info');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send final progress notification
  await notifyProgress('Finalizing results...', { progress: 90 });
  
  // Return the result
  return {
    text: `Generated text based on prompt: ${params.prompt}`,
    tokens: 42
  };
});

// Listen for events
service.on('error', (error) => {
  console.error('Service error:', error.message);
});
```

## Configuration Options

The SwarmServiceSDK constructor accepts a configuration object with the following properties:

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| name | string | Name of the service | 'Generic Service' |
| description | string | Service description | 'Generic Service' |
| orchestratorUrl | string | WebSocket URL of the orchestrator service interface | 'ws://localhost:3002' |
| capabilities | Array<string> | Service capabilities/functions | [] |
| autoReconnect | boolean | Whether to auto-reconnect | true |
| reconnectInterval | number | Reconnect interval in ms | 5000 |

## Key Features

### Function Registration

- **registerFunction(functionName, handler)**: Register a handler for a specific function
  - The handler receives three parameters:
    - `params`: The function parameters passed by the agent
    - `notifyProgress`: A function to send notifications about task progress
    - `metadata`: Task metadata including taskId, agentId, and clientId

### Notifications

- **sendNotification(notification)**: Send a notification to inform clients and agents about task progress
  - Notification types: 'progress', 'info', 'warning', 'error', 'debug'
  - Notifications include message text and optional data

### Communication

- **sendTaskResult(taskId, result)**: Send a task result back to the agent
- **setStatus(status, message)**: Update the service status

### Connection Management

- **connect()**: Connect to the orchestrator
- **disconnect()**: Disconnect from the orchestrator

## Events

The SDK emits the following events:

- **connected**: Emitted when connected to the orchestrator
- **registered**: Emitted when the service is registered with the orchestrator
- **disconnected**: Emitted when disconnected from the orchestrator
- **error**: Emitted when an error occurs
- **message**: Emitted for all received messages
- **task**: Emitted when a task is received

## Example: LLM Service

Here's an example of a simple LLM service that processes text generation requests:

```javascript
const { SwarmServiceSDK } = require('@agent-swarm/service-sdk');
const openai = require('openai');

// Initialize OpenAI client
const openaiClient = new openai.OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Create LLM service
const llmService = new SwarmServiceSDK({
  name: 'OpenAI LLM Service',
  description: 'Service for text generation using OpenAI models',
  capabilities: ['chat', 'complete', 'embed']
});

// Register chat function
llmService.registerFunction('chat', async (params, notifyProgress, metadata) => {
  const { messages, model = 'gpt-4', temperature = 0.7 } = params;
  
  await notifyProgress('Initializing chat request...', { 
    model, 
    messageCount: messages.length 
  });
  
  try {
    await notifyProgress('Sending request to OpenAI...', { progress: 30 });
    
    const response = await openaiClient.chat.completions.create({
      model,
      messages,
      temperature
    });
    
    await notifyProgress('Response received', { progress: 90 });
    
    return {
      text: response.choices[0].message.content,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    await notifyProgress(`Error: ${error.message}`, {}, 'error');
    throw error;
  }
});

// Connect to orchestrator
llmService.connect()
  .then(() => console.log('LLM Service connected and ready'))
  .catch(err => console.error('Connection error:', err.message));
```

## Task Handlers

Services can register task handlers using the `onTask` method:

```javascript
service.onTask('read', async (params, notify, metadata) => {
  // Initial notification
  await notify('Starting task...', { progress: 0 });
  
  // Perform the task
  const result = await doSomething(params);
  
  // Return the result
  return result;
});
```

The task handler receives three parameters:
- `params`: The parameters for the task
- `notify`: A function to send progress notifications
- `metadata`: Additional metadata about the task (taskId, agentId, clientId, etc.)

## Sending Notifications

Services can send real-time notifications about task progress to clients:

```javascript
// From within a task handler
await notify('Processing...', { progress: 50, details: 'step 2' });
```

For more control, use the service's `notify` method directly:

```javascript
await service.notify({
  taskId: 'task-123',
  type: 'progress',
  message: 'Processing file...',
  data: { progress: 75, fileName: 'data.json' }
});
```

## License

MIT
