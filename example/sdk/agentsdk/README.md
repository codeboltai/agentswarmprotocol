# SwarmAgentSDK

The SwarmAgentSDK provides a simple way to create agents that connect to and communicate with the Agent Swarm Protocol orchestrator.

## Installation

```bash
npm install @agent-swarm/agent-sdk
```

## Basic Usage

```javascript
const SwarmAgentSDK = require('@agent-swarm/agent-sdk');

// Create a new agent
const agent = new SwarmAgentSDK({
  name: 'My Agent',
  capabilities: ['text-processing', 'data-analysis'],
  description: 'An example agent',
  orchestratorUrl: 'ws://localhost:3000'
});

// Connect to the orchestrator
agent.connect()
  .then(() => {
    console.log('Connected to the orchestrator');
  })
  .catch(error => {
    console.error('Failed to connect:', error.message);
  });

// Register a task handler
agent.registerTaskHandler('text-processing', async (input, metadata) => {
  // Process the task
  const result = { processed: input.text };
  return result;
});

// Listen for events
agent.on('task', (task) => {
  console.log('New task received:', task);
});
```

## Configuration Options

The SwarmAgentSDK constructor accepts a configuration object with the following properties:

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| name | string | Name of the agent | 'Generic Agent' |
| agentId | string | Unique identifier for the agent | Auto-generated UUID |
| agentType | string | Type of the agent | 'generic' |
| capabilities | array | List of agent capabilities | [] |
| description | string | Description of the agent | 'Generic Agent' |
| manifest | object | Additional agent metadata | {} |
| orchestratorUrl | string | URL of the orchestrator | 'ws://localhost:3000' |
| autoReconnect | boolean | Whether to auto-reconnect | true |
| reconnectInterval | number | Reconnect interval in ms | 5000 |

## Methods

### Connection Management

- **connect()**: Connect to the orchestrator
- **disconnect()**: Disconnect from the orchestrator

### Task Handling

- **registerTaskHandler(taskType, handler)**: Register a handler for a specific task type
- **registerDefaultTaskHandler(handler)**: Register a default handler for unspecified task types
- **sendTaskResult(taskId, result)**: Send a task result back to the orchestrator

### Communication

- **send(message)**: Send a message to the orchestrator
- **sendAndWaitForResponse(message, timeout)**: Send a message and wait for a response
- **requestAgentTask(targetAgentName, taskData, timeout)**: Request a task from another agent
- **requestService(serviceName, params, timeout)**: Request a service from the orchestrator
- **requestMCPService(params, timeout)**: Request an MCP service from the orchestrator
- **getAgentList(filters)**: Get a list of available agents
- **setStatus(status)**: Update the agent's status

## Events

The SDK emits the following events:

- **connected**: Emitted when connected to the orchestrator
- **disconnected**: Emitted when disconnected from the orchestrator
- **registered**: Emitted when successfully registered with the orchestrator
- **error**: Emitted when an error occurs
- **welcome**: Emitted when a welcome message is received from the orchestrator
- **task**: Emitted when a task is received
- **message**: Emitted for all received messages
- **agent-response**: Emitted when a response is received from another agent
- **agent-request-accepted**: Emitted when an agent request is accepted
- **service-response**: Emitted when a service response is received

## Example

Check out [example-agent.js](./example-agent.js) for a complete example of how to use the SDK.

## License

MIT 