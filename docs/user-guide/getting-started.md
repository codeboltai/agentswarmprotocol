---
sidebar_position: 2
---

# Getting Started

## Prerequisites

Before you begin working with Agent Swarm Protocol, ensure you have:

- Node.js 18 or higher installed
- Basic knowledge of JavaScript/TypeScript
- Access to an LLM provider (OpenAI, Anthropic, etc.) API key (optional for some examples)

## Installation

### Setting up the Orchestrator

The orchestrator is the central hub that manages communication between agents. To set up:

```bash
# Clone the repository
git clone https://github.com/agentswarm/agentswarmprotocol.git
cd agentswarmprotocol

# Install dependencies
npm install

# Start the orchestrator
npm run start:orchestrator
```

This will start the orchestrator on `ws://localhost:3000` by default.

### Installing the SDK

For client applications or agent implementations, you'll need the Agent Swarm SDK:

```bash
npm install @agentswarm/sdk
```

## Creating Your First Agent

Let's create a simple agent that can respond to greeting messages:

```javascript
// simple-agent.js
const { Agent } = require('@agentswarm/sdk');

class GreetingAgent extends Agent {
  constructor() {
    super('greeting-agent');
    
    // Register capabilities
    this.capabilities = ['greeting', 'farewell'];
    
    // Register task handlers
    this.registerTaskHandlers();
  }
  
  registerTaskHandlers() {
    this.registerTaskHandler('greeting', this.handleGreeting.bind(this));
    this.registerTaskHandler('farewell', this.handleFarewell.bind(this));
  }
  
  async handleGreeting(task) {
    const { name } = task.data;
    return {
      message: `Hello, ${name || 'there'}! How can I help you today?`
    };
  }
  
  async handleFarewell(task) {
    return {
      message: `Goodbye! Have a wonderful day!`
    };
  }
}

// Connect to the orchestrator and start the agent
async function main() {
  const agent = new GreetingAgent();
  await agent.connect('ws://localhost:3000');
  console.log('Greeting agent is now connected and ready!');
}

main().catch(console.error);
```

## Creating a Client

Now, let's create a simple client that interacts with our agent:

```javascript
// client.js
const { createClient } = require('@agentswarm/sdk');

async function main() {
  // Connect to the orchestrator
  const client = createClient('ws://localhost:3000');
  await client.connect();
  
  // Send a greeting task to our agent
  const response = await client.sendTask({
    type: 'greeting',
    data: { name: 'Alice' }
  });
  
  console.log(response); // { message: 'Hello, Alice! How can I help you today?' }
  
  // Send a farewell task
  const farewell = await client.sendTask({
    type: 'farewell',
    data: {}
  });
  
  console.log(farewell); // { message: 'Goodbye! Have a wonderful day!' }
  
  // Disconnect from the orchestrator
  await client.disconnect();
}

main().catch(console.error);
```

## Running the Example

1. Start the orchestrator in one terminal:
   ```bash
   npm run start:orchestrator
   ```

2. Run your agent in another terminal:
   ```bash
   node simple-agent.js
   ```

3. Run the client in a third terminal:
   ```bash
   node client.js
   ```

## Next Steps

Now that you've created your first agent and client, you can:

1. **Explore example agents** in the `example/agents` directory to see more complex implementations
2. **Learn about agent communication** to understand how agents interact with each other
3. **Build specialized agents** for specific tasks like research, conversation, or data analysis
4. **Create a multi-agent system** where agents collaborate to solve complex problems

## Using Example Agents

The repository includes several example agents that you can run out of the box:

```bash
# Run the conversation agent
node example/agents/conversation-agent/conversation-agent.js

# Run the research agent
node example/agents/research-agent/research-agent.js
```

Then interact with them using the example clients:

```bash
# Interact with the conversation agent
node example/sdk/examples/run-conversation-agent.js

# Interact with the research agent
node example/sdk/examples/run-research-agent.js
```

## Troubleshooting

- **Connection issues**: Ensure the orchestrator is running and the WebSocket URL is correct
- **Agent not receiving tasks**: Check that the agent is registered with the correct task types
- **Task timeout**: The orchestrator has a default timeout for tasks; increase it if needed

For more detailed information, check out the [SDK documentation](/docs/sdk) and [examples](/docs/examples/conversation-agent). 