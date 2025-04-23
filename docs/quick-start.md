---
sidebar_position: 3
---

# Quick Start

This quick start guide will walk you through creating a simple agent swarm using the Agent Swarm Protocol. By the end, you'll have a small swarm of agents working together to solve a task.

## Overview

In this guide, we'll create:
1. A simple conversational agent
2. A research agent that can search for information
3. A workflow that connects them together

## Prerequisites

Ensure you have:
- Completed the [installation](./installation) of the ASP Orchestrator
- Set up your environment variables (especially API keys)
- Basic understanding of JavaScript/TypeScript

## Step 1: Create Your First Agent

Let's create a simple conversational agent:

```bash
mkdir -p agents/conversational-agent
cd agents/conversational-agent
```

Create a manifest file:

```js
// manifest.json
{
  "name": "conversational-agent",
  "version": "1.0.0",
  "description": "A simple conversational agent",
  "entryPoint": "index.js",
  "capabilities": [
    "conversation"
  ],
  "requiredServices": [
    "llm"
  ]
}
```

Now implement the agent:

```js
// index.js
const { Agent } = require('@agent-swarm/agent-sdk');

// Initialize the agent
const agent = new Agent({
  manifestPath: './manifest.json'
});

// Handle incoming messages
agent.on('message', async (message) => {
  if (message.type === 'conversation.request') {
    // Request LLM service from the orchestrator
    const llmResponse = await agent.requestService('llm', {
      prompt: message.content,
      temperature: 0.7
    });
    
    // Send response back
    agent.send({
      type: 'conversation.response',
      content: llmResponse.text,
      requestId: message.id
    });
  }
});

// Connect to the orchestrator
agent.connect();
```

## Step 2: Create a Research Agent

Let's create another agent that can search for information:

```bash
mkdir -p agents/research-agent
cd agents/research-agent
```

Create a manifest file:

```js
// manifest.json
{
  "name": "research-agent",
  "version": "1.0.0",
  "description": "An agent that can search for information",
  "entryPoint": "index.js",
  "capabilities": [
    "search"
  ],
  "requiredServices": [
    "web-search",
    "llm"
  ]
}
```

Implement the agent:

```js
// index.js
const { Agent } = require('@agent-swarm/agent-sdk');

// Initialize the agent
const agent = new Agent({
  manifestPath: './manifest.json'
});

// Handle incoming messages
agent.on('message', async (message) => {
  if (message.type === 'search.request') {
    // Perform web search
    const searchResults = await agent.requestService('web-search', {
      query: message.query,
      numResults: 3
    });
    
    // Summarize results using LLM
    const summary = await agent.requestService('llm', {
      prompt: `Summarize these search results about "${message.query}": ${JSON.stringify(searchResults)}`,
      temperature: 0.3
    });
    
    // Send response back
    agent.send({
      type: 'search.response',
      content: summary.text,
      sources: searchResults.map(r => r.url),
      requestId: message.id
    });
  }
});

// Connect to the orchestrator
agent.connect();
```

## Step 3: Create a Swarm Workflow

Now, let's create a workflow that orchestrates these agents:

```js
// workflow.js
const { Orchestrator } = require('@agent-swarm/orchestrator');
const config = require('./asp-config.js');

const orchestrator = new Orchestrator(config);

// Define a swarm workflow
const swarmWorkflow = {
  name: 'research-conversation',
  description: 'A workflow that combines research and conversation',
  agents: ['conversational-agent', 'research-agent'],
  initialMessage: {
    type: 'workflow.start',
    content: 'I need information about Agent Swarm Protocol.'
  },
  steps: [
    {
      id: 'research',
      agent: 'research-agent',
      message: {
        type: 'search.request',
        query: '{{initialMessage.content}}'
      }
    },
    {
      id: 'conversation',
      agent: 'conversational-agent',
      message: {
        type: 'conversation.request',
        content: 'Based on the following information, provide a helpful response to the user: {{research.response.content}}'
      },
      dependsOn: ['research']
    }
  ],
  output: '{{conversation.response.content}}'
};

// Register the workflow
orchestrator.registerWorkflow(swarmWorkflow);

// Start the orchestrator
orchestrator.start().then(() => {
  console.log(`ASP Orchestrator running on port ${config.port}`);
  
  // Example of executing the workflow
  orchestrator.executeWorkflow('research-conversation', {
    initialMessage: {
      content: 'Tell me about the benefits of Agent Swarm Protocol.'
    }
  }).then(result => {
    console.log('Workflow result:', result);
  });
});
```

## Step 4: Run Your Agent Swarm

Start the orchestrator with your workflow:

```bash
node workflow.js
```

This will:
1. Start the orchestrator
2. Register and start your agents
3. Execute the workflow
4. Display the result

## What's Happening?

1. The workflow starts with a request about the Agent Swarm Protocol
2. This request is sent to the research agent
3. The research agent searches for information and summarizes it
4. The summarized information is sent to the conversational agent
5. The conversational agent creates a user-friendly response
6. The final response is returned as the workflow output

## Next Steps

Now that you've created your first agent swarm, you can:

1. Add more agents with different capabilities
2. Create more complex workflows
3. Explore [advanced agent features](./creating-agents)
4. Learn about [orchestrator services](./orchestrator-services)
5. Understand [agent communication patterns](./agent-communication) 