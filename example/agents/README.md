# ASP Agents

This directory contains specialized agents that connect to the ASP Orchestrator and provide various capabilities.

## Available Agents

### Conversation Agent

- **Location**: `conversation-agent/`
- **Capabilities**: conversation, chat, user-interaction
- **Description**: Handles natural language conversations with users, providing responses using an LLM.
- **Start Command**: `npm run start:agent:conversation`

### Research Agent

- **Location**: `research-agent/`
- **Capabilities**: web-search, information-retrieval, research
- **Description**: Performs web searches and analyzes the results to provide researched information on given topics.
- **Start Command**: `npm run start:agent:research`

### Summarization Agent

- **Location**: `summarization-agent/`
- **Capabilities**: summarization, content-processing, text-analysis
- **Description**: Summarizes content and extracts key points from text.
- **Start Command**: `npm run start:agent:summarization`

## Running the Agents

1. Make sure the ASP Orchestrator is running first: `npm run start`
2. Run the desired agent using its start command
3. Agents will automatically connect to the orchestrator at the URL specified in the `.env` file

## Agent Architecture

Each agent follows a common structure:

1. **Connection**: WebSocket connection to the orchestrator
2. **Registration**: Agents register themselves with their capabilities
3. **Message Handling**: Process messages and requests from the orchestrator
4. **Service Utilization**: Agents leverage services provided through the orchestrator
5. **Task Processing**: Execute their specialized tasks and return results

## Using Services

Agents can use services registered with the orchestrator:

```javascript
// Example of requesting a service
const serviceRequest = {
  type: 'service.request',
  id: uuidv4(),
  content: {
    service: 'service-name',
    params: {
      // Service-specific parameters
    }
  }
};

// Send the service request
agent.send(serviceRequest);
```

## Extending the System

To create a new agent:

1. Create a new directory for your agent
2. Implement the agent following the existing patterns
3. Register your agent with appropriate capabilities
4. Add a start script to `package.json`
5. Update workflows to utilize your new agent's capabilities 