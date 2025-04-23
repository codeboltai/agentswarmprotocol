---
sidebar_position: 6
---

# Agent Communication

Communication between agents is a fundamental aspect of the Agent Swarm Protocol (ASP). This guide covers the direct agent-to-agent communication patterns, message structures, and best practices for effective agent collaboration.

## Message Structure

All communication in ASP follows a standardized message format:

```typescript
interface Message {
  id?: string;                     // Unique message ID
  type: string;                    // Message type (e.g., 'agent.request')
  content?: any;                   // Message payload
  requestId?: string;              // ID of the original request (for responses)
  timestamp?: number;              // When the message was created
  metadata?: Record<string, any>;  // Additional contextual information
}
```

## Agent-to-Agent Communication

ASP now supports direct agent-to-agent communication through the orchestrator. This allows agents to collaborate and delegate tasks without the need for complex workflow configurations.

### Request-Response Pattern

The most common pattern is request-response, where one agent sends a request to another agent and expects a response.

#### Agent SDK Example:

```javascript
// From within an agent implementation:
class MyAgent extends SwarmAgentSDK {
  async handleCustomTask(task) {
    // Request information from the Research Agent
    try {
      const researchResult = await this.requestAgentTask(
        'Research Agent',  // Target agent name
        {
          taskType: 'research.query',
          query: 'latest advancements in AI',
          context: {
            originAgent: 'My Agent'
          }
        },
        30000  // Timeout in ms (optional)
      );
      
      console.log('Research results:', researchResult);
      return { success: true, results: researchResult };
    } catch (error) {
      console.error('Error requesting research:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### How Agent-to-Agent Communication Works

1. **Request Initiation**: An agent sends a request to the orchestrator specifying the target agent and task data.
2. **Orchestrator Routing**: The orchestrator locates the target agent and forwards the request as a task.
3. **Task Processing**: The target agent processes the task and returns a result.
4. **Response Delivery**: The orchestrator delivers the response back to the requesting agent.

### Agent Request Message Structure

When an agent makes a request to another agent, it sends a message with the following structure:

```typescript
{
  type: 'agent.request',
  content: {
    targetAgentName: string,    // Name of the target agent
    taskData: {                 // Task data to send to the target agent
      taskType: string,         // Type of task (e.g., 'research.query')
      // Additional task-specific data...
    }
  }
}
```

### Agent Response Message Structure

The response from the target agent is wrapped by the orchestrator and sent back with the following structure:

```typescript
{
  type: 'agent.response',
  content: {                  // Response content from the target agent
    // Task-specific response data...
  },
  requestId: string           // Original request ID
}
```

## Implementation Details

### Orchestrator Handling

The orchestrator handles agent-to-agent communication with a dedicated handler method:

```javascript
async handleAgentRequest(message, ws) {
  const { targetAgentName, taskData } = message.content;
  
  // Get the requesting agent
  const requestingAgent = this.agents.getAgentByConnectionId(ws.id);
  
  // Get the target agent
  const targetAgent = this.agents.getAgentByName(targetAgentName);
  
  // Create a task for the target agent
  const taskId = uuidv4();
  const taskMessage = {
    id: taskId,
    type: 'task.execute',
    content: {
      input: taskData,
      metadata: {
        requestingAgentId: requestingAgent.id,
        requestingAgentName: requestingAgent.name,
        timestamp: new Date().toISOString()
      }
    }
  };
  
  // Send task to target agent and wait for response
  const response = await this.sendAndWaitForResponse(
    targetAgent.connection, 
    taskMessage
  );
  
  // Send the result back to the requesting agent
  this.send(ws, {
    type: 'agent.response',
    content: response.content,
    requestId: message.id
  });
}
```

### Agent SDK Integration

The SwarmAgentSDK provides a convenient method for requesting tasks from other agents:

```javascript
async requestAgentTask(targetAgentName, taskData, timeout = 30000) {
  const message = {
    type: 'agent.request',
    content: {
      targetAgentName,
      taskData
    }
  };
  
  try {
    const response = await this.sendAndWaitForResponse(message, timeout);
    return response.content;
  } catch (error) {
    this.emit('error', new Error(
      `Failed to request task from agent ${targetAgentName}: ${error.message}`
    ));
    throw error;
  }
}
```

## Example: Conversation Agent and Research Agent Collaboration

Here's an example of how the Conversation Agent communicates with the Research Agent to answer user queries:

```javascript
// Inside Conversation Agent's message handler
async handleConversationMessage(task) {
  const { message, context } = task.data;
  
  // Detect if this is a research query
  const isResearchQuery = this.isResearchQuery(message);
  let researchResult = null;
  
  if (isResearchQuery && context.availableAgents) {
    // Find the research agent from available agents
    const researchAgent = context.availableAgents.find(agent => 
      agent.name === 'Research Agent' || 
      (agent.capabilities && agent.capabilities.includes('research'))
    );
    
    if (researchAgent) {
      try {
        // Request research from the Research Agent
        researchResult = await this.requestAgentTask(researchAgent.name, {
          taskType: 'research.query',
          query: message,
          context: {
            conversationId: task.data.conversationId,
            originAgent: 'Conversation Agent'
          }
        });
      } catch (error) {
        this.logger.error(`Error requesting research: ${error.message}`);
      }
    }
  }
  
  // Generate response using research results if available
  const responseData = this.generateResponse(
    task.data.conversationId, 
    message, 
    context, 
    this.detectIntents(message), 
    this.analyzeSentiment(message),
    researchResult
  );
  
  return responseData;
}
```

## Client Example: Facilitating Agent-to-Agent Communication

Clients can facilitate agent-to-agent communication by providing context in task requests:

```javascript
// Using the SDK client to facilitate agent-to-agent communication
const response = await client.sendTask('Conversation Agent', {
  taskType: 'conversation.message',
  conversationId: 'conv-123',
  message: 'What are the latest advancements in AI?',
  context: {
    // Provide information about available agents
    availableAgents: [
      {
        name: 'Research Agent',
        capabilities: ['research', 'web-search', 'knowledge-retrieval']
      }
    ]
  }
});
```

## Benefits of Direct Agent-to-Agent Communication

1. **Simplicity**: Removes the need for complex workflow configurations
2. **Flexibility**: Agents can dynamically decide when and with whom to collaborate
3. **Autonomy**: Agents can operate more independently and make their own collaboration decisions
4. **Scalability**: Enables more organic scaling of agent ecosystems with less central coordination
5. **Fault Tolerance**: Failure of a single agent doesn't break a predefined workflow

## Best Practices

1. **Include Context**: Always include relevant context in agent-to-agent requests
2. **Implement Timeouts**: Set reasonable timeouts for agent-to-agent requests
3. **Error Handling**: Implement robust error handling for failed agent-to-agent communications
4. **Metadata**: Use metadata to provide additional information about the request
5. **Idempotency**: Design agent communications to be idempotent when possible
6. **Batching**: Batch related requests when appropriate to reduce communication overhead

Agent-to-agent communication opens up powerful collaboration possibilities within the Agent Swarm Protocol ecosystem, enabling more autonomous and flexible agent interactions.

## Communication Channels

ASP supports several communication channels:

1. **Direct Agent-to-Agent**: Messages sent directly between agents
2. **Agent-to-Orchestrator**: Requests for orchestrator services
3. **Orchestrator-to-Agent**: Responses and notifications from the orchestrator
4. **Broadcast**: Messages sent to all agents in the swarm

## Communication Patterns

### Publish-Subscribe Pattern

For one-to-many communication, agents can use the publish-subscribe pattern.

```javascript
// Agent A: Subscribe to a topic
await agentA.send({
  type: 'subscribe',
  content: { topic: 'market.updates' }
});

// Agent A: Handle updates
agentA.on('message', (message) => {
  if (message.type === 'market.update') {
    console.log('Market update:', message.content);
  }
});

// Agent B: Publish an update
await agentB.send({
  type: 'market.update',
  content: { 
    symbol: 'AAPL', 
    price: 150.25 
  },
  metadata: { 
    topic: 'market.updates' 
  }
});
```

The orchestrator routes these messages based on subscription registrations.

### Broadcast Pattern

For system-wide announcements, agents can broadcast messages to all agents.

```javascript
// Send a broadcast message
await agent.send({
  type: 'broadcast',
  content: { 
    alert: 'System maintenance starting in 5 minutes' 
  }
});
```

### Streaming Pattern

For continuous data flow, agents can use streaming communication.

```javascript
// Agent A: Start streaming data
const streamId = generateUniqueId();
await agentA.send({
  type: 'stream.start',
  content: { 
    streamId: streamId,
    dataType: 'sensor-readings'
  }
});

// Agent A: Send stream data
for (const reading of sensorReadings) {
  await agentA.send({
    type: 'stream.data',
    content: reading,
    metadata: { streamId }
  });
  
  await sleep(100); // Simulate delay between readings
}

// Agent A: End the stream
await agentA.send({
  type: 'stream.end',
  metadata: { streamId }
});

// Agent B: Handle the stream
agentB.on('message', (message) => {
  switch (message.type) {
    case 'stream.start':
      console.log('Stream started:', message.content.streamId);
      break;
    case 'stream.data':
      console.log('Stream data:', message.content);
      break;
    case 'stream.end':
      console.log('Stream ended:', message.metadata.streamId);
      break;
  }
});
```

## Message Routing

The ASP orchestrator handles message routing between agents. Several routing mechanisms are supported:

### Direct Routing

Messages are sent directly to a specific agent by ID or name.

```javascript
await agent.send({
  type: 'process.request',
  recipient: 'data-processing-agent',
  content: { data: 'example' }
});
```

### Capability-based Routing

Messages can be routed based on agent capabilities.

```javascript
await agent.send({
  type: 'search.request',
  content: { query: 'example' },
  metadata: {
    routing: {
      capability: 'web-search',
      strategy: 'round-robin' // or 'first-available', 'least-busy', etc.
    }
  }
});
```

### Topic-based Routing

Messages can be routed based on topics (publish-subscribe).

```javascript
await agent.send({
  type: 'market.update',
  content: { symbol: 'AAPL', price: 150.25 },
  metadata: { topic: 'market.updates' }
});
```

## Bidirectional Communication

ASP's WebSocket-based communication enables true bidirectional communication between agents and the orchestrator.

```javascript
// Agent connects to orchestrator
agent.connect().then(() => {
  console.log('Connected to orchestrator');
  
  // Agent can immediately send and receive messages
  agent.send({
    type: 'status.update',
    content: { status: 'online' }
  });
});

// Agent listens for messages from orchestrator or other agents
agent.on('message', (message) => {
  console.log('Received message:', message);
});
```

## Parent-Child Communication

ASP supports hierarchical agent relationships, where a parent agent can spawn and communicate with child agents.

```javascript
// Parent creates a child agent
const childAgent = await parentAgent.requestService('agent', {
  action: 'start',
  agentName: 'specialized-processor'
});

// Parent sends message to child
const response = await parentAgent.requestService('agent', {
  action: 'send',
  agentId: childAgent.id,
  message: {
    type: 'process.request',
    content: { data: 'to process' }
  },
  waitForResponse: true
});

// Parent can later stop the child agent
await parentAgent.requestService('agent', {
  action: 'stop',
  agentId: childAgent.id
});
```

## Error Handling in Communication

Proper error handling is crucial for robust agent communication:

```javascript
// Sending with error handling
try {
  const response = await agent.sendAndWaitForResponse({
    recipient: 'data-processor',
    type: 'process.request',
    content: { data: 'example' }
  }, {
    timeout: 5000,
    retries: 3,
    retryDelay: 1000
  });
  console.log('Received response:', response);
} catch (error) {
  if (error.code === 'TIMEOUT') {
    console.error('Request timed out');
  } else if (error.code === 'AGENT_NOT_FOUND') {
    console.error('Agent not found');
  } else {
    console.error('Communication error:', error);
  }
}

// Receiving with error handling
agent.on('message', async (message) => {
  try {
    if (message.type === 'process.request') {
      const result = await processData(message.content.data);
      await agent.send({
        type: 'process.response',
        content: result,
        requestId: message.id
      });
    }
  } catch (error) {
    // Send error response
    await agent.send({
      type: 'error.response',
      content: {
        error: error.message,
        code: error.code || 'PROCESSING_ERROR'
      },
      requestId: message.id
    });
  }
});
```

## Message Serialization

ASP automatically handles message serialization, but it's important to ensure messages contain only serializable data:

```javascript
// Good - fully serializable
await agent.send({
  type: 'data.response',
  content: {
    results: [1, 2, 3],
    metadata: {
      timestamp: new Date().toISOString(), // String representation of date
      source: 'sensor-123'
    }
  }
});

// Bad - contains non-serializable elements
await agent.send({
  type: 'data.response',
  content: {
    results: [1, 2, 3],
    processor: function() { /* ... */ }, // Functions can't be serialized
    timestamp: new Date() // Date objects need conversion
  }
});
```

## Message Validation

ASP allows you to define message schemas for validation:

```javascript
// Register message schema
agent.registerMessageSchema('search.request', {
  type: 'object',
  properties: {
    query: { type: 'string', minLength: 1 },
    limit: { type: 'number', default: 10 }
  },
  required: ['query']
});

// Messages will be validated automatically
await agent.send({
  type: 'search.request',
  content: { query: 'example' } // Valid
});

try {
  await agent.send({
    type: 'search.request',
    content: { query: '' } // Invalid - will throw validation error
  });
} catch (error) {
  console.error('Validation error:', error);
}
```

## Communication Security

ASP includes several security features for agent communication:

1. **Authentication**: Agents authenticate with the orchestrator
2. **Authorization**: Agents can only send messages to authorized recipients
3. **Message Signing**: Messages can be cryptographically signed
4. **Encryption**: Communication channels are encrypted

```javascript
// Creating an agent with security options
const agent = new Agent({
  manifestPath: './manifest.json',
  security: {
    authToken: 'your-auth-token',
    signMessages: true,
    encryptionKey: process.env.ENCRYPTION_KEY
  }
});
```

## Debugging Communication

ASP provides tools for debugging agent communication:

```javascript
// Enable communication logging
agent.enableMessageLogging({
  logLevel: 'debug', // 'debug', 'info', 'warn', 'error'
  includeContent: true,
  logFile: './agent-messages.log'
});

// Monitor specific message types
agent.on('message:search.request', (message) => {
  console.log('Search request received:', message);
});

// Monitor all messages
agent.on('message', (message) => {
  console.log(`[${message.type}] Message received`);
});
```

## Communication Patterns Examples

### Chain of Responsibility

Multiple agents can process a request in sequence:

```javascript
// Define a workflow with sequential processing
const workflow = {
  name: 'data-pipeline',
  steps: [
    {
      id: 'extract',
      agent: 'data-extractor',
      message: {
        type: 'extract.request',
        content: { source: 'database' }
      }
    },
    {
      id: 'transform',
      agent: 'data-transformer',
      message: {
        type: 'transform.request',
        content: { data: '{{extract.response.content}}' }
      },
      dependsOn: ['extract']
    },
    {
      id: 'load',
      agent: 'data-loader',
      message: {
        type: 'load.request',
        content: { data: '{{transform.response.content}}' }
      },
      dependsOn: ['transform']
    }
  ]
};

// Execute the workflow
const result = await orchestrator.executeWorkflow('data-pipeline');
```

### Fan Out / Fan In

Distribute work to multiple agents and collect results:

```javascript
// Fan out to multiple processors
const processorAgents = ['processor-1', 'processor-2', 'processor-3'];
const dataChunks = splitData(largeData, processorAgents.length);

// Send data to each processor
const promises = processorAgents.map((agentId, index) => {
  return agent.sendAndWaitForResponse({
    recipient: agentId,
    type: 'process.request',
    content: { data: dataChunks[index] }
  });
});

// Fan in - collect all results
const results = await Promise.all(promises);
const combinedResult = combineResults(results.map(r => r.content));
```

### Event-Driven Agents

Agents can react to events in the system:

```javascript
// Register interest in events
await agent.send({
  type: 'subscribe',
  content: { 
    topics: [
      'user.login', 
      'user.logout',
      'system.alert'
    ] 
  }
});

// Handle events
agent.on('message', async (message) => {
  switch (message.type) {
    case 'user.login':
      await handleUserLogin(message.content);
      break;
    case 'user.logout':
      await handleUserLogout(message.content);
      break;
    case 'system.alert':
      await handleSystemAlert(message.content);
      break;
  }
});
```

## Best Practices

### Message Design

- **Consistent Types**: Use consistent message types (e.g., 'entity.action')
- **Versioning**: Consider including version information in messages
- **Minimalism**: Send only the data that is needed
- **Completeness**: Include all necessary context in each message
- **Idempotency**: Design messages to be safely redelivered

### Communication Efficiency

- **Batching**: Batch related messages when possible
- **Throttling**: Implement rate limiting for high-frequency messages
- **Compression**: Consider compressing large message payloads
- **Streaming**: Use streaming for large datasets instead of single large messages

### Reliability

- **Acknowledgments**: Implement message acknowledgments for critical flows
- **Retries**: Implement retry logic with backoff for important messages
- **Timeouts**: Set appropriate timeouts for waiting for responses
- **Circuit Breakers**: Implement circuit breakers for failing communications

### Organization

- **Namespacing**: Use namespacing in message types (e.g., 'domain.entity.action')
- **Documentation**: Document message types and their payload structures
- **Schemas**: Define schemas for message validation

## Next Steps

Now that you understand agent communication, you can:

1. Explore [advanced workflows](./advanced-workflows)
2. Learn about the [agent marketplace](./agent-marketplace)
3. Dive into [orchestrator configuration](../api/orchestrator-configuration) 