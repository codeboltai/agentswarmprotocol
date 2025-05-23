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

## WebSocketClient

The WebSocketClient provides a robust WebSocket connection to the orchestrator with support for both browser and Node.js environments.

### Basic Usage

```typescript
import { WebSocketClient } from '@agentswarmprotocol/clientsdk';

const client = new WebSocketClient({
  orchestratorUrl: 'ws://localhost:3001',
  autoReconnect: true,
  reconnectInterval: 5000,
  defaultTimeout: 30000
});

// Connect to orchestrator
await client.connect();

// Send a simple message
const response = await client.sendRequestWaitForResponse({
  id: 'msg-1',
  type: 'ping',
  content: { message: 'Hello' }
});
```

### Advanced Usage with Custom Events

The `sendRequestWaitForResponse` method supports advanced options for more flexible response handling:

#### Custom Event Matching

Wait for a specific event type, regardless of other messages with the same ID:

```typescript
// Only resolve when a 'task.completed' message is received with the same message ID
const response = await client.sendRequestWaitForResponse({
  id: 'task-123',
  type: 'task.create',
  content: { task: 'process data' }
}, {
  customEvent: 'task.completed',
  timeout: 60000
});
```

#### Any Message ID with Custom Event

Wait for a specific event type from any message, regardless of message ID:

```typescript
// Resolve when any 'user.login' event is received, regardless of message ID
const response = await client.sendRequestWaitForResponse({
  id: 'login-request-456',
  type: 'auth.request',
  content: { username: 'user123' }
}, {
  customEvent: 'user.login',
  anyMessageId: true,
  timeout: 30000
});
```

#### Options

- `timeout`: Maximum time to wait for response in milliseconds. If not provided, no timeout will be set and the request will wait indefinitely
- `customEvent`: Specific event type to wait for. If specified, only messages with this event type will resolve the promise
- `anyMessageId`: If true, resolve for any message with the custom event type, regardless of message ID. Requires `customEvent` to be specified

### Event Handling

```typescript
// Listen for specific events
client.on('task.result', (data) => {
  console.log('Task completed:', data);
});

client.on('connected', () => {
  console.log('Connected to orchestrator');
});

client.on('disconnected', () => {
  console.log('Disconnected from orchestrator');
});
```

## License

MIT