# Agent Swarm Protocol Client SDK

Client SDK for connecting to and interacting with Agent Swarm Protocol orchestrators.

## Installation

```bash
npm install @agentswarmprotocol/clientsdk
```

## Usage

```javascript
const SwarmClientSDK = require('@agentswarmprotocol/clientsdk');

// Create a new SDK instance
const client = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001', // WebSocket URL of the orchestrator client interface
  autoReconnect: true, // Automatically reconnect on disconnection
  reconnectInterval: 5000 // Interval in ms to attempt reconnection
});

// Connect to the orchestrator
await client.connect();

// Get a list of registered agents
const agents = await client.getAgents();
console.log('Available agents:', agents);

// Send a task to an agent
const result = await client.sendTask('example-agent', {
  taskType: 'example',
  prompt: 'Hello, world!'
});
console.log('Task result:', result);

// Subscribe to task notifications
const unsubscribe = client.subscribeToNotifications(notification => {
  console.log('Received notification:', notification);
});

// Later, when done
client.disconnect();
```

## Modules

The SDK is organized into several modules:

- **WebSocketClient**: Handles WebSocket connection to the orchestrator
- **MessageHandler**: Processes messages from the orchestrator
- **TaskManager**: Handles task-related operations
- **AgentManager**: Handles agent-related operations
- **MCPManager**: Handles MCP-related operations

## API Reference

### SwarmClientSDK

Main SDK class that provides access to all functionality.

#### Methods

- `connect()`: Connect to the orchestrator
- `disconnect()`: Disconnect from the orchestrator
- `getAgents(filters)`: Get a list of all registered agents
- `sendTask(agentName, taskData, options)`: Send a task to an agent
- `getTaskStatus(taskId)`: Get the status of a task
- `listMCPServers(filters)`: List available MCP servers
- `subscribeToNotifications(options, callback)`: Subscribe to task notifications
- `getClientId()`: Get the client ID
- `isConnected()`: Check if client is connected

#### Events

- `connected`: Emitted when connected to the orchestrator
- `disconnected`: Emitted when disconnected from the orchestrator
- `error`: Emitted when an error occurs
- `welcome`: Emitted when a welcome message is received from the orchestrator
- `message`: Emitted for all messages received from the orchestrator
- `task-result`: Emitted when a task result is received
- `task-status`: Emitted when a task status update is received
- `task-created`: Emitted when a task is created
- `task-notification`: Emitted when a task notification is received
- `agent-list`: Emitted when an agent list is received
- `mcp-server-list`: Emitted when an MCP server list is received
- `orchestrator-error`: Emitted when an error is received from the orchestrator

## License

MIT