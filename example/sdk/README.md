# Swarm Agent SDK

A Software Development Kit for creating agents that connect to the Agent Swarm Protocol (ASP) orchestrator.

## Overview

The Swarm Agent SDK provides a simple interface for creating agents that can communicate with the ASP orchestrator, request services, and handle tasks. It abstracts away the WebSocket communication details and provides a consistent event-based interface for building specialized agents.

## Features

- **WebSocket Connection Management**: Handles connection, reconnection, and message serialization
- **Event-Based Architecture**: Uses Node.js EventEmitter for handling messages and tasks
- **Service Request Abstraction**: Simplified interface for requesting services from the orchestrator
- **Task Result Handling**: Methods for reporting task results and errors
- **Specialized Agent Classes**: Pre-built classes for common agent types
- **Promise-Based API**: Modern async/await support for all operations

## Installation

```bash
npm install swarm-agent-sdk
```

## Basic Usage

```javascript
const { SwarmAgentSDK } = require('swarm-agent-sdk');

// Create a custom agent
const agent = new SwarmAgentSDK({
  name: 'my-custom-agent',
  capabilities: ['custom-capability'],
  manifest: {
    description: 'My custom agent',
    version: '1.0.0',
    requiredServices: ['some-service']
  }
});

// Connect to the orchestrator
await agent.connect();

// Listen for tasks
agent.on('task', async (message) => {
  if (message.type === 'task.custom') {
    // Handle the task
    const result = await processTask(message);
    
    // Send the result back
    agent.sendTaskResult(message.id, result);
  }
});

// Request a service
const serviceResult = await agent.requestService('some-service', {
  param1: 'value1',
  param2: 'value2'
});
```

## Using Pre-Built Agent Classes

```javascript
const { 
  createConversationAgent, 
  createResearchAgent, 
  createSummarizationAgent 
} = require('swarm-agent-sdk');

// Create a conversation agent
const conversationAgent = createConversationAgent({
  defaultModel: 'gpt-4'
});

// Start the agent
await conversationAgent.connect();
```

## Creating Custom Agent Classes

```javascript
const { SwarmAgentSDK } = require('swarm-agent-sdk');

class MyCustomAgent extends SwarmAgentSDK {
  constructor(config = {}) {
    super({
      name: config.name || 'my-custom-agent',
      capabilities: ['custom-capability'],
      ...config
    });
    
    this.on('task', this.handleTask.bind(this));
  }
  
  async handleTask(message) {
    if (message.type === 'task.custom') {
      // Custom task handling logic
    }
  }
}
```

## API Reference

### SwarmAgentSDK

Base class for creating agents.

#### Properties

- `name`: Name of the agent
- `capabilities`: Array of agent capabilities
- `orchestratorUrl`: WebSocket URL of the orchestrator
- `manifest`: Additional agent metadata
- `agentId`: ID assigned by the orchestrator (after registration)
- `connected`: Connection status

#### Methods

- `connect()`: Connect to the orchestrator
- `disconnect()`: Disconnect from the orchestrator
- `send(message)`: Send a message to the orchestrator
- `sendAndWaitForResponse(message, options)`: Send a message and wait for a response
- `requestService(serviceName, params, options)`: Request a service from the orchestrator
- `sendTaskResult(requestId, result, metadata)`: Send a task result
- `sendTaskError(requestId, error, metadata)`: Send a task error

#### Events

- `connected`: Emitted when connected to the orchestrator
- `disconnected`: Emitted when disconnected
- `registered`: Emitted when registered with the orchestrator
- `message`: Emitted for any received message
- `task`: Emitted for task messages
- `error`: Emitted on any error

### Specialized Agents

The SDK includes specialized agent classes:

- `ConversationAgent`: For handling conversations and chat interactions
- `ResearchAgent`: For performing web searches and research tasks
- `SummarizationAgent`: For summarizing content and extracting key points

## Examples

See the `examples` directory for complete examples of using the SDK.

## License

MIT 