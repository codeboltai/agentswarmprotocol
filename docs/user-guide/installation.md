---
sidebar_position: 2
---

# Installation

Setting up the Agent Swarm Protocol (ASP) environment is straightforward. This guide will walk you through the installation process for both the orchestrator and your first agent.

## Prerequisites

Before installing ASP, ensure you have the following:

- [Node.js](https://nodejs.org/) version 18.0 or above
- npm or yarn package manager
- Basic understanding of JavaScript/TypeScript (for creating agents)

## Installing the ASP Orchestrator

The orchestrator is the central component of the Agent Swarm Protocol. To install it:

```bash
# Create a new directory for your ASP project
mkdir asp-project
cd asp-project

# Install the ASP orchestrator package
npm install @agent-swarm/orchestrator
```

## Configuration

Create a configuration file for the orchestrator:

```js
// asp-config.js
module.exports = {
  port: 3000, // WebSocket server port
  llmProviders: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: 'gpt-4',
    },
  },
  logLevel: 'info',
  agentDirectory: './agents', // Where agent manifests will be stored
}
```

## Starting the Orchestrator

Create a simple script to start the orchestrator:

```js
// start-orchestrator.js
const { Orchestrator } = require('@agent-swarm/orchestrator');
const config = require('./asp-config.js');

const orchestrator = new Orchestrator(config);

orchestrator.start().then(() => {
  console.log(`ASP Orchestrator running on port ${config.port}`);
});
```

Run the orchestrator:

```bash
node start-orchestrator.js
```

## Installing the Agent SDK

To create agents that connect to the orchestrator, you'll need the Agent SDK:

```bash
npm install @agent-swarm/agent-sdk
```

## Environment Variables

Create a `.env` file in your project root to store sensitive configuration:

```
OPENAI_API_KEY=your_openai_api_key_here
ASP_ORCHESTRATOR_URL=ws://localhost:3000
```

## Verifying the Installation

To verify that your installation is working correctly:

1. Start the orchestrator
2. Use the built-in testing tools:

```bash
npx asp-test-connection
```

If successful, you'll see a confirmation message indicating that the orchestrator is running and ready to accept agent connections.

## Next Steps

Now that you have installed the Agent Swarm Protocol, you're ready to:

1. [Create your first agent](./creating-agents)
2. Follow the [Quick Start guide](./quick-start) to see ASP in action
3. Explore the [Orchestrator API](../api/orchestrator-api) for advanced configuration options 