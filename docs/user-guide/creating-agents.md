---
sidebar_position: 4
---

# Creating Agents

This guide provides a comprehensive look at creating agents for the Agent Swarm Protocol (ASP). You'll learn about agent structure, manifest files, communication patterns, and best practices.

## Agent Architecture

An ASP agent consists of:

1. A **manifest file** that defines its capabilities and requirements
2. An **implementation** that handles messages and uses orchestrator services
3. A **connection** to the orchestrator via WebSocket

## Agent Manifest

The manifest file is a JSON document that describes your agent to the orchestrator. It serves as a contract between your agent and the system.

### Manifest Structure

```json
{
  "name": "example-agent",
  "version": "1.0.0",
  "description": "An example agent that demonstrates ASP capabilities",
  "entryPoint": "index.js",
  "capabilities": [
    "example.capability1",
    "example.capability2"
  ],
  "requiredServices": [
    "llm",
    "storage"
  ],
  "metadata": {
    "author": "Your Name",
    "category": "utility",
    "icon": "🤖"
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "description": "API key for external service"
      },
      "maxRetries": {
        "type": "number",
        "default": 3,
        "description": "Maximum number of retry attempts"
      }
    },
    "required": ["apiKey"]
  }
}
```

### Key Manifest Properties

| Property | Description |
|----------|-------------|
| `name` | Unique identifier for your agent |
| `version` | Semantic version of your agent |
| `description` | Human-readable description |
| `entryPoint` | Main file that implements the agent |
| `capabilities` | List of actions this agent can perform |
| `requiredServices` | Orchestrator services this agent needs |
| `metadata` | Additional information for display |
| `configSchema` | JSON Schema for agent configuration |

## Implementing an Agent

Let's walk through implementing a basic agent:

```javascript
const { Agent } = require('@agent-swarm/agent-sdk');

class MyCustomAgent extends Agent {
  constructor(options) {
    super(options);
    this.state = {}; // Private agent state
    
    // Set up message handlers
    this.registerHandlers();
  }
  
  registerHandlers() {
    // Handle different message types
    this.on('message', async (message) => {
      switch (message.type) {
        case 'process.request':
          await this.handleProcessRequest(message);
          break;
        case 'status.request':
          await this.handleStatusRequest(message);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    });
  }
  
  async handleProcessRequest(message) {
    try {
      // Request LLM service from orchestrator
      const llmResult = await this.requestService('llm', {
        prompt: message.content,
        temperature: 0.7
      });
      
      // Process the result
      const processedResult = this.processResult(llmResult.text);
      
      // Send response back
      this.send({
        type: 'process.response',
        content: processedResult,
        requestId: message.id // Always include the original request ID
      });
    } catch (error) {
      this.send({
        type: 'error.response',
        error: error.message,
        requestId: message.id
      });
    }
  }
  
  async handleStatusRequest(message) {
    this.send({
      type: 'status.response',
      status: 'active',
      uptime: process.uptime(),
      requestId: message.id
    });
  }
  
  processResult(text) {
    // Custom processing logic
    return text.toUpperCase();
  }
}

// Initialize and connect the agent
const agent = new MyCustomAgent({
  manifestPath: './manifest.json'
});

agent.connect().then(() => {
  console.log('Agent connected to orchestrator');
}).catch(err => {
  console.error('Failed to connect agent:', err);
});
```

## Agent Communication

Agents communicate using a message-based protocol over WebSockets.

### Message Structure

Each message should include:

```typescript
interface Message {
  id?: string;         // Unique message ID (generated automatically)
  type: string;        // Message type (e.g., 'search.request')
  content?: any;       // Message payload
  requestId?: string;  // ID of the original request (for responses)
  timestamp?: number;  // When the message was created
  metadata?: Record<string, any>; // Additional context
}
```

### Communication Patterns

1. **Request-Response**: An agent sends a request and expects a response
   ```javascript
   // Send request
   agent.send({
     type: 'data.request',
     content: { query: 'example' }
   });
   
   // Handle response
   agent.on('message', (message) => {
     if (message.type === 'data.response' && message.requestId === requestId) {
       // Process response
     }
   });
   ```

2. **Pub-Sub**: An agent subscribes to a topic and receives updates
   ```javascript
   // Subscribe to updates
   agent.send({
     type: 'subscribe',
     content: { topic: 'system.status' }
   });
   
   // Handle updates
   agent.on('message', (message) => {
     if (message.type === 'system.status.update') {
       // Process update
     }
   });
   ```

3. **Broadcast**: An agent sends a message to all agents
   ```javascript
   agent.send({
     type: 'broadcast',
     content: { alert: 'System maintenance in 5 minutes' }
   });
   ```

## Requesting Orchestrator Services

Agents can request services from the orchestrator:

```javascript
// Request LLM service
const llmResult = await agent.requestService('llm', {
  prompt: 'Summarize the following text: ...',
  temperature: 0.3,
  model: 'gpt-4'
});

// Request storage service
const storedData = await agent.requestService('storage', {
  action: 'get',
  key: 'user-preferences'
});

// Request a child agent
const childAgentResult = await agent.requestService('agent', {
  agentName: 'specialized-processor',
  message: {
    type: 'process.request',
    content: { data: 'to process' }
  }
});
```

## Stateful Agents

Agents can maintain state between requests:

```javascript
class StatefulAgent extends Agent {
  constructor(options) {
    super(options);
    this.conversationHistory = [];
    this.userPreferences = {};
    
    // Load state on startup
    this.loadState();
  }
  
  async loadState() {
    try {
      const savedState = await this.requestService('storage', {
        action: 'get',
        key: `agent-state-${this.id}`
      });
      
      if (savedState) {
        this.conversationHistory = savedState.conversationHistory || [];
        this.userPreferences = savedState.userPreferences || {};
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }
  
  async saveState() {
    try {
      await this.requestService('storage', {
        action: 'set',
        key: `agent-state-${this.id}`,
        value: {
          conversationHistory: this.conversationHistory,
          userPreferences: this.userPreferences
        }
      });
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }
}
```

## Error Handling

Implement robust error handling in your agents:

```javascript
async handleRequest(message) {
  try {
    // Process the request
    const result = await this.processRequest(message);
    
    // Send success response
    this.send({
      type: 'success.response',
      content: result,
      requestId: message.id
    });
  } catch (error) {
    // Log the error
    console.error('Error processing request:', error);
    
    // Send error response
    this.send({
      type: 'error.response',
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      requestId: message.id
    });
    
    // Report to monitoring
    this.requestService('monitoring', {
      action: 'reportError',
      error: error
    }).catch(e => console.error('Failed to report error:', e));
  }
}
```

## Testing Agents

To test your agents, create a test harness:

```javascript
// test-agent.js
const { MockOrchestrator } = require('@agent-swarm/test-utils');
const MyAgent = require('./my-agent');

async function testAgent() {
  // Create a mock orchestrator
  const mockOrchestrator = new MockOrchestrator({
    services: {
      llm: async (params) => {
        return { text: 'Mock LLM response' };
      },
      storage: async (params) => {
        if (params.action === 'get') return { value: 'stored value' };
        if (params.action === 'set') return { success: true };
        return null;
      }
    }
  });
  
  // Create and connect the agent
  const agent = new MyAgent({
    manifestPath: './manifest.json'
  });
  
  // Connect to mock orchestrator
  await agent.connect(mockOrchestrator.getConnectionUrl());
  
  // Send a test message
  const response = await mockOrchestrator.sendAndWaitForResponse({
    type: 'process.request',
    content: 'Test message'
  });
  
  console.log('Response:', response);
  
  // Disconnect
  await agent.disconnect();
}

testAgent().catch(console.error);
```

## Best Practices

- **Single Responsibility**: Each agent should have a clear, focused purpose
- **Idempotency**: Ensure that repeated messages produce the same result
- **Graceful Degradation**: Handle service failures gracefully
- **Timeout Handling**: Set reasonable timeouts for service requests
- **Logging**: Implement comprehensive logging for debugging
- **Resource Management**: Clean up resources when an agent disconnects
- **Message Validation**: Validate incoming messages before processing
- **Versioning**: Use semantic versioning for your agents

## Advanced Topics

- **Agent Discovery**: Dynamically discover available agents
- **Agent Composition**: Combine multiple agents to create complex behaviors
- **Secure Communication**: Implement authentication and authorization
- **Performance Optimization**: Optimize agent communication and processing
- **Scaling**: Design agents to work in a distributed environment

## Next Steps

Now that you understand how to create agents, you can:

1. Learn about [agent communication patterns](./agent-communication)
2. Explore the [orchestrator services](../api/orchestrator-services)
3. Dive into [agent marketplace](./agent-marketplace) publishing 