---
sidebar_position: 1
---

# Conversation Agent Example

This example demonstrates how to build a conversation agent that can engage in natural dialogue with users.

## Overview

The conversation agent uses natural language processing to understand user inputs, maintain context throughout a conversation, and generate appropriate responses.

## Implementation

### Step 1: Set up the basic agent structure

```typescript
import { Agent, Orchestrator } from '@agent-swarm/sdk';

const conversationAgent = new Agent({
  name: 'conversation-agent',
  description: 'Engages in natural conversations with users',
  capabilities: ['chat', 'context-tracking', 'personality-simulation']
});
```

### Step 2: Define the conversation state

```typescript
interface ConversationState {
  history: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  context: {
    username?: string;
    preferences?: Record<string, any>;
    lastTopic?: string;
  };
}

// Initialize conversation state
const initialState: ConversationState = {
  history: [],
  context: {}
};
```

### Step 3: Implement the message handler

```typescript
conversationAgent.registerHandler('chat', async (task) => {
  const { message, sessionId } = task.inputs;
  
  // Retrieve or initialize conversation state
  const state = await getConversationState(sessionId) || initialState;
  
  // Add user message to history
  state.history.push({
    role: 'user',
    content: message
  });
  
  // Process the message and generate a response
  const response = await generateResponse(message, state);
  
  // Add agent response to history
  state.history.push({
    role: 'assistant',
    content: response
  });
  
  // Update conversation state
  await saveConversationState(sessionId, state);
  
  return {
    response,
    conversationState: state
  };
});
```

### Step 4: Implement helper functions

```typescript
async function generateResponse(message: string, state: ConversationState): Promise<string> {
  // Process the message using a language model or other techniques
  // Include context from the conversation state
  
  // Example implementation using a hypothetical language model
  const prompt = formatConversationPrompt(state.history);
  const response = await languageModel.generate(prompt);
  
  // Update context based on the message and response
  updateContext(message, response, state.context);
  
  return response;
}

function updateContext(message: string, response: string, context: ConversationState['context']) {
  // Extract relevant information to update the context
  // For example, identify user preferences or detect the conversation topic
  
  // Example: Simple topic detection
  const topics = extractTopics(message);
  if (topics.length > 0) {
    context.lastTopic = topics[0];
  }
}
```

### Step 5: Start the agent

```typescript
// Connect to orchestrator
const orchestrator = new Orchestrator('http://localhost:3000');
conversationAgent.connect(orchestrator);

// Start the agent
const port = 8080;
conversationAgent.start(port);
console.log(`Conversation agent started on port ${port}`);
```

## Usage

To interact with the conversation agent:

```typescript
// Client-side code
const response = await fetch('http://localhost:3000/api/v1/tasks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    type: 'chat',
    description: 'User conversation',
    inputs: {
      message: 'Hello, how are you today?',
      sessionId: 'user-123'
    },
    agents: ['conversation-agent']
  })
});

const result = await response.json();
console.log(result.outputs.response); // Agent's response
```

## Extensions

The conversation agent can be extended with additional capabilities:

- **Personality customization**: Add parameters to define the agent's personality traits
- **Multi-language support**: Implement language detection and responses in multiple languages
- **Domain-specific knowledge**: Integrate specialized knowledge bases for specific topics
- **Emotion recognition**: Analyze user messages for emotional content and adjust responses accordingly 