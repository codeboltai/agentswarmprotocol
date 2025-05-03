# Agent Swarm Protocol - Universal Client SDK

This client SDK for Agent Swarm Protocol supports both browser and Node.js environments, allowing you to use the same SDK code in any JavaScript/TypeScript environment.

## Features

- Universal compatibility: Works in both browser and Node.js environments
- Automatic environment detection
- Consistent API across platforms
- TypeScript support
- Event-based communication with orchestrator
- Task management
- Agent discovery and interaction
- MCP (Master Control Program) integration

## Installation

```bash
npm install @agentswarmprotocol/clientsdk
```

## Usage

### Browser Environment

```typescript
import { SwarmClientSDK } from '@agentswarmprotocol/clientsdk';

// Create SDK instance
const sdk = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001',
  autoConnect: true
});

// Listen for events
sdk.on('connected', () => {
  console.log('Connected to orchestrator!');
});

// Get available agents
sdk.getAgents().then(agents => {
  console.log('Available agents:', agents);
});

// Send a task to an agent
sdk.sendTask('research-agent', {
  query: 'Find information about AI agent swarms'
})
.then(task => {
  console.log('Task created:', task);
});
```

### Node.js Environment

```typescript
import { SwarmClientSDK } from '@agentswarmprotocol/clientsdk';

// Create SDK instance
const sdk = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001'
});

// Connect to orchestrator
await sdk.connect();

// Get available agents
const agents = await sdk.getAgents();
console.log('Available agents:', agents);

// Send a task
const task = await sdk.sendTask('research-agent', {
  query: 'Find information about AI agent swarms'
});
console.log('Task created:', task);
```

## Environment Detection

The SDK automatically detects the environment and uses the appropriate WebSocket implementation:

- In browsers: Uses the native browser WebSocket API
- In Node.js: Uses the 'ws' package

## Configuration Options

```typescript
const sdk = new SwarmClientSDK({
  // WebSocket URL of the orchestrator client interface
  orchestratorUrl: 'ws://localhost:3001',
  
  // Whether to automatically reconnect on disconnection (default: true)
  autoReconnect: true,
  
  // Interval in ms to attempt reconnection (default: 5000)
  reconnectInterval: 5000,
  
  // Default timeout for requests in milliseconds (default: 30000)
  defaultTimeout: 30000,
  
  // Auto-connect on initialization (default: false)
  autoConnect: false,
  
  // Force the use of browser WebSocket implementation even in Node.js (default: false)
  forceBrowserWebSocket: false
});
```

## API Reference

### Main SDK Methods

- `connect()` - Connect to the orchestrator
- `disconnect()` - Disconnect from the orchestrator
- `isConnected()` - Check if connected to the orchestrator
- `getClientId()` - Get the client ID
- `sendRequest(message, options)` - Send a request to the orchestrator
- `sendTask(agentName, taskData, options)` - Send a task to an agent
- `getAgents(filters)` - Get a list of all registered agents
- `listMCPServers(filters)` - List available MCP servers

### Task Manager Methods

- `sendTask(agentName, taskData, options)` - Send a task to an agent
- `getTaskStatus(taskId)` - Get the status of a task
- `getTaskResult(taskId)` - Get the result of a task
- `cancelTask(taskId)` - Cancel a task
- `listTasks(filters)` - List all tasks

### Agent Manager Methods

- `getAgents(filters)` - Get a list of all registered agents
- `getAgentInfo(agentId)` - Get information about a specific agent
- `getAgentCapabilities(agentId)` - Get the capabilities of a specific agent

### Events

- `connected` - Emitted when connected to the orchestrator
- `disconnected` - Emitted when disconnected from the orchestrator
- `error` - Emitted when an error occurs
- `welcome` - Emitted when receiving the welcome message from the orchestrator
- `task-created` - Emitted when a task is created
- `task-status` - Emitted when a task status changes
- `task-result` - Emitted when a task result is received
- `task-notification` - Emitted when a task notification is received
- `agent-list` - Emitted when an agent list is received
- `orchestrator-error` - Emitted when an error is received from the orchestrator

## License

MIT