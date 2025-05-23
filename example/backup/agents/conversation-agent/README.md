# Conversation Agent

A natural language conversation agent that can hold contextual conversations with users, remember conversation history, and adapt responses based on user preferences.

## Capabilities

- **chat**: Basic conversational capabilities
- **contextual-responses**: Ability to maintain context throughout a conversation
- **memory**: Ability to remember conversation history
- **preference-adaptation**: Ability to adapt responses based on user preferences

## Features

- Maintains separate conversations with unique IDs
- Adapts formality and verbosity based on user preferences
- Remembers conversation history for context-aware responses
- Handles conversation lifecycle (start, message, end)
- Generates appropriate responses based on message content and context

## Usage

### Starting the Agent

To start the agent, run:

```bash
# With default configuration
node index.js

# With environment variables
AGENT_NAME=my-conversation-agent ORCHESTRATOR_URL=ws://myorchestrator:3000 node index.js
```

Or use npm scripts defined in your package.json:

```json
"scripts": {
  "start": "node index.js",
  "dev": "NODE_ENV=development node index.js"
}
```

### Environment Variables

- `AGENT_NAME`: Custom name for the agent (default: 'Conversation Agent')
- `ORCHESTRATOR_URL`: WebSocket URL to the Agent Swarm Protocol orchestrator (default: ws://localhost:3000)

### Task Types

The Conversation Agent responds to these task types:

1. `conversation:start` - Initialize a new conversation
2. `conversation:message` - Process a message within a conversation
3. `conversation:end` - End a conversation and get statistics

### Example API Usage

#### Starting a conversation

```javascript
const task = {
  taskType: 'conversation:start',
  conversationId: 'user-123-conv-456',
  context: {
    userData: {
      name: 'Alice',
      preferences: {
        formality: 'casual',
        verbosity: 'concise'
      }
    }
  }
};
```

#### Sending a message

```javascript
const task = {
  taskType: 'conversation:message',
  conversationId: 'user-123-conv-456',
  message: 'Tell me about yourself',
  context: {
    userData: {
      // Updated user data if needed
    }
  }
};
```

#### Ending a conversation

```javascript
const task = {
  taskType: 'conversation:end',
  conversationId: 'user-123-conv-456'
};
```

### Programmatic Usage

You can also use the agent programmatically:

```javascript
const { startConversationAgent } = require('./index');

async function main() {
  // Start the agent
  const agent = await startConversationAgent();
  
  // Use the agent...
  
  // When done
  await agent.disconnect();
}

main().catch(console.error);
```

## Development

### Extending the Agent

To extend the Conversation Agent with additional capabilities:

1. Add the capability to the capabilities array in the constructor
2. Implement the corresponding task handlers
3. Update response generation logic in the `generateResponse` method

### Adding New Task Types

To add new task types:

1. Create a handler method for the new task
2. Register it in the `registerTaskHandlers` method
3. Implement the logic for processing the task and returning results 