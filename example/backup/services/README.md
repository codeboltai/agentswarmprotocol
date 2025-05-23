# Agent Swarm Protocol Services

This directory contains service implementations that connect to the Agent Swarm Protocol orchestrator. Services provide capabilities that agents can use through the orchestrator.

## Available Services

### File Management Service
Located in `services/filemanagement`, this service provides file operations such as:
- Reading files
- Writing files
- Listing directories
- Searching files
- Deleting files

### LLM Service
Located in `services/llmservice`, this service provides language model operations:
- Text generation
- Chat/conversation
- Text embeddings
- Summarization
- Classification

## How Services Work

Services are independent processes that connect to the orchestrator via WebSocket. They register themselves with the orchestrator and provide a set of tasks that agents can call. Services can send real-time notifications about task progress to clients through the orchestrator.

## Starting Services

Each service has a standalone `index.js` file that can be run directly:

```bash
# Start the File Management Service
cd services/filemanagement
node index.js

# Start the LLM Service
cd services/llmservice
node index.js
```

## Configuration

Services can be configured via environment variables or `.env` files:

```
# Common configuration
ORCHESTRATOR_SERVICE_URL=ws://localhost:3002
SERVICE_NAME=Custom Service Name

# File Management Service
FILE_SERVICE_BASE_DIR=/path/to/files

# LLM Service
DEFAULT_LLM_MODEL=gpt-4
OPENAI_API_KEY=your_api_key
ANTHROPIC_API_KEY=your_api_key
```

## Building Custom Services

To create a new service:

1. Create a new directory in `services/`
2. Create an `index.js` file that exports a start function and can be run directly
3. Implement the service logic using the ServiceSDK

Example:

```javascript
const { SwarmServiceSDK } = require('../../sdk/servicesdk/index');
require('dotenv').config();

function startMyService(config = {}) {
  const service = new SwarmServiceSDK({
    name: config.name || 'My Service',
    description: 'A service that does something',
    capabilities: ['taskOne', 'taskTwo'],
    orchestratorUrl: config.orchestratorUrl || 'ws://localhost:3002'
  });

  // Register tasks using the onTask method
  service.onTask('taskOne', async (params, notify, metadata) => {
    // Send progress notifications
    await notify('Starting...', { progress: 0 });
    
    // Do some work
    
    // Return result
    return { result: 'success' };
  });

  // Connect to orchestrator
  service.connect();
  
  return service;
}

// Run directly when called with node
if (require.main === module) {
  const service = startMyService({
    // Config from environment variables
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    service.disconnect();
    process.exit(0);
  });
}

module.exports = { startMyService };
```

## Service Notifications

Services can send real-time notifications about task progress to keep clients informed using the notify function passed to task handlers:

```javascript
service.onTask('processFile', async (params, notify, metadata) => {
  await notify('Starting task...', { progress: 0 });
  await notify('Processing...', { progress: 50, details: 'some details' });
  await notify('Task complete', { progress: 100, result: 'success' });
  
  return { success: true };
});
```

## Using Services from Agents

Agents can call service tasks using the AgentSDK:

```javascript
const result = await agent.executeServiceTask(
  'fileManagementService', // Service ID or name
  'read',                  // Task name
  { filePath: 'example.txt' }, // Parameters
  {
    onNotification: (notification) => {
      console.log(`Progress: ${notification.data.progress}%: ${notification.message}`);
    }
  }
);
``` 