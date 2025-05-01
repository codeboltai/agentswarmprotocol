# Agent Swarm Protocol (ASP) Example Implementation

This directory contains an example implementation of the Agent Swarm Protocol, demonstrating how multiple specialized agents can collaborate through an orchestrator.

## Components

- **Orchestrator**: Coordinates communication and tasks between agents
- **Agents**: Specialized components that provide specific capabilities
  - Conversation Agent: Handles natural language interactions
  - Research Agent: Performs web searches and research tasks
  - Summarization Agent: Summarizes content and extracts key points
- **Workflows**: Predefined sequences of tasks across multiple agents
- **Services**: Shared capabilities available to agents through the orchestrator

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy the example environment file and configure it:
   ```
   cp env.example .env
   ```
   - Set your OpenAI API key
   - Configure other settings as needed

3. Start the orchestrator:
   ```
   npm start
   ```

4. In separate terminals, start each agent:
   ```
   npm run start:agent:conversation
   npm run start:agent:research
   npm run start:agent:summarization
   ```

## System Architecture

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                  Orchestrator                   │
│                                                 │
└───────────┬──────────────┬──────────────┬──────┘
            │              │              │
            ▼              ▼              ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Conversation │  │    Research   │  │ Summarization │
│     Agent     │  │     Agent     │  │     Agent     │
└───────────────┘  └───────────────┘  └───────────────┘
```

## Executing Workflows

The system comes with predefined workflows that demonstrate agent collaboration:

1. **Research Workflow**: Research a topic and provide a summary
   - Research Agent performs web search
   - Summarization Agent creates a concise summary
   - Results are returned to the requester

2. **Interactive Conversation**: Enable natural language interaction
   - Conversation Agent handles user messages
   - Can be extended to include other agents for complex requests

## Extending the System

To add new capabilities:

1. Create a new specialized agent in the `agents/` directory
2. Register the agent with appropriate capabilities
3. Define new workflows that leverage the agent's capabilities
4. Implement any required services in the orchestrator

## Communication Protocol

Agents communicate with the orchestrator using a standardized message format:

```javascript
{
  "type": "message.type",
  "id": "unique-message-id",
  "content": {
    // Message-specific content
  },
  "requestId": "id-of-message-this-responds-to" // For responses
}
```

For more details on communication, see the [Agent Swarm Protocol specification](https://github.com/your-org/agent-swarm-protocol). 