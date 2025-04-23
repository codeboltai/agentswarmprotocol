# Swarm Agent SDK Implementation

This document explains the Swarm Agent SDK implementation and how it differs from the direct WebSocket approach.

## Two Implementation Approaches

The Agent Swarm Protocol example provides two ways to create agents:

1. **Direct WebSocket Implementation** (in `agents/` directory)
   - Uses WebSocket directly for communication
   - Each agent handles its own connection, registration, and message processing
   - More verbose and requires duplicating communication logic

2. **SDK-Based Implementation** (in `sdk/` directory)
   - Uses a unified SDK that abstracts away WebSocket communication
   - Provides event-based architecture and specialized agent classes
   - Reduces boilerplate and standardizes agent development

## SDK Benefits

The Swarm Agent SDK offers several advantages:

- **Reduced Boilerplate**: Common WebSocket handling is abstracted away
- **Standardized Interface**: Consistent API for all agents
- **Event-Based Architecture**: Uses Node.js EventEmitter for easy event handling
- **Specialized Agent Classes**: Pre-built classes for common agent types
- **Error Handling**: Consistent error handling and timeouts
- **Reconnection Logic**: Automatic reconnection on disconnection

## SDK Structure

The SDK is organized as follows:

- `SwarmAgentSDK`: Base class for all agents, handles WebSocket communication
- Specialized agent classes:
  - `ConversationAgent`: For conversation and chat tasks
  - `ResearchAgent`: For web search and research tasks
  - `SummarizationAgent`: For content summarization tasks
- Factory functions for easily creating agents

## Using the SDK

### Creating an Agent

```javascript
const { createConversationAgent } = require('./sdk');

const agent = createConversationAgent({
  name: 'my-conversation-agent',
  defaultModel: 'gpt-4',
  orchestratorUrl: 'ws://localhost:3000'
});

// Connect and register with the orchestrator
await agent.connect();

// Handle events
agent.on('task', async (message) => {
  console.log(`Received task: ${message.type}`);
});

agent.on('error', (error) => {
  console.error('Agent error:', error);
});
```

### Requesting Services

```javascript
// Request a service from the orchestrator
const llmResponse = await agent.requestService('llm-service', {
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello, how are you?' }
  ],
  model: 'gpt-4'
});
```

### Sending Task Results

```javascript
// Send a task result
agent.sendTaskResult(messageId, {
  answer: 'This is the result of the task',
  confidence: 0.95
});

// Send a task error
agent.sendTaskError(messageId, new Error('Failed to process task'));
```

## Running the SDK Examples

To run the SDK examples:

```bash
# Run the conversation agent example
npm run sdk:example:conversation

# Test that the SDK loads correctly
npm run test:sdk
```

## Migration Guide

To migrate from direct WebSocket implementation to the SDK:

1. Replace direct WebSocket handling with `SwarmAgentSDK` or a specialized agent class
2. Replace manual message handling with event listeners
3. Replace direct service requests with `requestService()` method calls
4. Replace result sending with `sendTaskResult()` and `sendTaskError()` methods

## Implementation Comparison

| Feature | Direct WebSocket | SDK |
|---------|-----------------|-----|
| Connection Management | Manual | Automatic |
| Message Handling | Switch statements | Event listeners |
| Service Requests | Custom promises | Simple async method |
| Error Handling | Custom | Standardized |
| Reconnection | Custom | Built-in |
| Code Verbosity | High | Low |
| Customization | Full control | Pre-defined patterns |

## Conclusion

While both approaches work well, the SDK approach is recommended for most use cases as it reduces boilerplate, standardizes agent implementation, and provides a more developer-friendly experience. 