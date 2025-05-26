---
sidebar_position: 10
---

# Client SDK Interface

The SwarmClientSDK provides a comprehensive interface for creating client applications that connect to the Agent Swarm Protocol orchestrator. This document outlines all available methods, events, and their usage patterns.

## Installation

```bash
npm install @agentswarmprotocol/clientsdk
```

## Quick Start

```javascript
const { SwarmClientSDK } = require('@agentswarmprotocol/clientsdk');

const client = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001',
  autoConnect: true
});

// Listen for events
client.on('connected', () => {
  console.log('Connected to orchestrator!');
});

// Get available agents
const agents = await client.getAgentsList();
console.log('Available agents:', agents);

// Send a task to an agent
const result = await client.sendTask(
  'agent-001',
  'Text Processing Agent',
  {
    text: 'hello world',
    operation: 'uppercase'
  },
  { waitForResult: true, timeout: 60000 }
);
console.log('Task result:', result);
```

## Constructor

### `new SwarmClientSDK(config)`

Creates a new client instance.

**Parameters:**
- `config` (`WebSocketClientConfig`): Configuration object

```typescript
interface WebSocketClientConfig {
  orchestratorUrl?: string;     // WebSocket URL of the orchestrator (default: 'ws://localhost:3001')
  autoReconnect?: boolean;      // Whether to automatically reconnect on disconnection (default: true)
  reconnectInterval?: number;   // Interval in ms to attempt reconnection (default: 5000)
  defaultTimeout?: number;      // Default timeout for requests in milliseconds (default: 30000)
  autoConnect?: boolean;        // Auto-connect on initialization (default: false)
  forceBrowserWebSocket?: boolean; // Force browser WebSocket implementation (default: false)
}
```

## Connection Methods

### `connect()`

Connects to the orchestrator and waits for the welcome message.

**Returns:** `Promise<void>`

```javascript
await client.connect();
```

### `disconnect()`

Disconnects from the orchestrator.

**Returns:** `void`

```javascript
client.disconnect();
```

### `isConnected()`

Checks if the client is connected to the orchestrator.

**Returns:** `boolean`

```javascript
const connected = client.isConnected();
```

### `getClientId()`

Gets the client ID assigned by the orchestrator.

**Returns:** `string | null`

```javascript
const clientId = client.getClientId();
```

## Task Management Methods

### `sendTask(agentId, agentName, taskData, options)`

Sends a task to a specific agent.

**Parameters:**
- `agentId` (string): ID of the target agent
- `agentName` (string): Name of the target agent
- `taskData` (any): Task data to send to the agent
- `options` (`TaskRequestOptions`): Additional options

```typescript
interface TaskRequestOptions {
  waitForResult?: boolean;  // Whether to wait for the task result (default: true)
  timeout?: number;         // Timeout in milliseconds (default: 60000)
}
```

**Returns:** `Promise<any>`

```javascript
const result = await client.sendTask(
  'agent-001',
  'Text Processing Agent',
  {
    text: 'hello world',
    operation: 'uppercase',
    options: {
      preserveSpacing: true
    }
  },
  {
    waitForResult: true,
    timeout: 60000
  }
);
```

### `sendMessageDuringTask(taskId, message)`

Sends a message to a running task (typically in response to a task request message).

**Parameters:**
- `taskId` (string): ID of the task to send the message to
- `message` (any): Message content to send

**Returns:** `Promise<any>`

```javascript
await client.sendMessageDuringTask('task-123', {
  targetLanguage: 'spanish',
  preserveFormatting: true
});
```

### `getTaskStatus(taskId)`

Gets the current status of a task.

**Parameters:**
- `taskId` (string): ID of the task to get status for

**Returns:** `Promise<any>`

```javascript
const status = await client.getTaskStatus('task-123');
console.log('Task status:', status);
```

## Agent Management Methods

### `getAgentsList(filters)`

Gets a list of available agents from the orchestrator.

**Parameters:**
- `filters` (`AgentFilters`): Optional filter criteria

```typescript
interface AgentFilters {
  status?: string;        // Filter by agent status
  capabilities?: string[]; // Filter by agent capabilities
  name?: string;          // Filter by agent name (partial match)
}
```

**Returns:** `Promise<Agent[]>`

```typescript
interface Agent {
  id: string;           // Unique agent ID
  name: string;         // Agent name
  capabilities: string[]; // Agent capabilities/functions
  status: string;       // Current agent status
  description?: string; // Optional agent description
}
```

```javascript
const agents = await client.getAgentsList({
  status: 'active',
  capabilities: ['text-processing']
});
```

## MCP (Model Context Protocol) Methods

### `listMCPServers(filters)`

Gets a list of available MCP servers.

**Parameters:**
- `filters` (`MCPServerFilters`): Optional filter criteria

```typescript
interface MCPServerFilters {
  type?: string;          // Filter by server type
  status?: string;        // Filter by server status
  capabilities?: string[]; // Filter by server capabilities
}
```

**Returns:** `Promise<any[]>`

```javascript
const servers = await client.listMCPServers({
  type: 'filesystem',
  status: 'active'
});
```

### `getMCPServerTools(serverId)`

Gets a list of tools available on a specific MCP server.

**Parameters:**
- `serverId` (string): ID of the MCP server

**Returns:** `Promise<any[]>`

```javascript
const tools = await client.getMCPServerTools('filesystem-server');
```

### `executeMCPTool(serverId, toolName, parameters)`

Executes a tool on an MCP server.

**Parameters:**
- `serverId` (string): ID of the MCP server
- `toolName` (string): Name of the tool to execute
- `parameters` (any): Tool parameters

**Returns:** `Promise<any>`

```javascript
const result = await client.executeMCPTool(
  'filesystem-server',
  'read_file',
  {
    path: '/data/input.txt',
    encoding: 'utf8'
  }
);
```

## Utility Methods

### `sendRequestWaitForResponse(message, options)`

Sends a custom request message and waits for a response.

**Parameters:**
- `message` (`Partial<BaseMessage>`): Message to send
- `options` (object): Additional options
  - `timeout` (number): Request timeout in milliseconds

**Returns:** `Promise<any>`

```javascript
const response = await client.sendRequestWaitForResponse({
  type: 'custom.request',
  content: { data: 'example' }
}, { timeout: 15000 });
```

## Events Emitted by Client SDK

The Client SDK emits the following events that can be subscribed to:

### Connection Events

#### `connected`
Emitted when the client connects to the orchestrator.

```javascript
client.on('connected', () => {
  console.log('Client connected to orchestrator');
});
```

#### `disconnected`
Emitted when the client disconnects from the orchestrator.

```javascript
client.on('disconnected', () => {
  console.log('Client disconnected from orchestrator');
});
```

#### `error`
Emitted when an error occurs.

```javascript
client.on('error', (error) => {
  console.error('Client error:', error.message);
});
```

#### `welcome`
Emitted when the welcome message is received from the orchestrator.

```javascript
client.on('welcome', (welcomeData) => {
  console.log('Welcome message:', welcomeData);
});
```

**Event Data Structure:**
```json
{
  "clientId": "client-001",
  "version": "1.0.0",
  "message": "Welcome to Agent Swarm Protocol",
  "config": {
    "maxConcurrentTasks": 10,
    "defaultTimeout": 30000,
    "supportedFeatures": ["tasks", "agents", "mcp"]
  }
}
```

### Task Events

#### `task.created`
Emitted when a task is successfully created.

```javascript
client.on('task.created', (taskData) => {
  console.log('Task created:', taskData);
});
```

**Event Data Structure:**
```json
{
  "taskId": "task-uuid-001",
  "agentId": "agent-001",
  "agentName": "Text Processing Agent",
  "status": "created",
  "createdAt": "2023-12-01T10:00:02.000Z",
  "message": "Task successfully created and assigned to agent"
}
```

#### `task.result`
Emitted when a task result is received.

```javascript
client.on('task.result', (resultData) => {
  console.log('Task result:', resultData);
});
```

**Event Data Structure:**
```json
{
  "taskId": "task-uuid-001",
  "agentId": "agent-001",
  "agentName": "Text Processing Agent",
  "status": "completed",
  "result": {
    "processedText": "HELLO WORLD",
    "metadata": {
      "processingTime": 1500,
      "operation": "uppercase"
    }
  },
  "createdAt": "2023-12-01T10:00:02.000Z",
  "completedAt": "2023-12-01T10:00:15.000Z"
}
```

#### `task.status`
Emitted when a task status update is received.

```javascript
client.on('task.status', (statusData) => {
  console.log('Task status update:', statusData);
});
```

#### `task.error`
Emitted when a task error occurs.

```javascript
client.on('task.error', (errorData) => {
  console.log('Task error:', errorData);
});
```

#### `task.notification`
Emitted when a task notification is received (progress updates, etc.).

```javascript
client.on('task.notification', (notification) => {
  console.log('Task notification:', notification);
});
```

**Event Data Structure:**
```json
{
  "taskId": "task-uuid-001",
  "agentId": "agent-001",
  "agentName": "Text Processing Agent",
  "notificationType": "progress",
  "message": "Processing text content...",
  "data": {
    "progress": 50,
    "step": "text_analysis",
    "estimatedTimeRemaining": 7500
  },
  "level": "info",
  "timestamp": "2023-12-01T10:00:08.000Z"
}
```

#### `task.requestmessage`
Emitted when an agent requests additional input during task execution.

```javascript
client.on('task.requestmessage', (requestData) => {
  console.log('Agent requesting input:', requestData);
  
  // Respond to the request
  client.sendMessageDuringTask(requestData.taskId, {
    response: 'user input here'
  });
});
```

**Event Data Structure:**
```json
{
  "taskId": "task-uuid-001",
  "agentId": "agent-001",
  "agentName": "Text Processing Agent",
  "messageType": "input_request",
  "message": "Please provide the target language for translation",
  "options": ["spanish", "french", "german", "italian"],
  "timeout": 30000
}
```

#### `task.childtask.created`
Emitted when a child task is created by an agent.

```javascript
client.on('task.childtask.created', (childTaskData) => {
  console.log('Child task created:', childTaskData);
});
```

#### `task.childtask.status`
Emitted when a child task status changes.

```javascript
client.on('task.childtask.status', (statusData) => {
  console.log('Child task status:', statusData);
});
```

### Agent Events

#### `agent.list`
Emitted when an agent list is received.

```javascript
client.on('agent.list', (agents) => {
  console.log('Available agents:', agents);
});
```

### Service Events

#### `service.started`
Emitted when a service starts processing.

```javascript
client.on('service.started', (serviceData) => {
  console.log('Service started:', serviceData);
});
```

#### `service.notification`
Emitted when a service sends a notification.

```javascript
client.on('service.notification', (notification) => {
  console.log('Service notification:', notification);
});
```

#### `service.completed`
Emitted when a service completes processing.

```javascript
client.on('service.completed', (completionData) => {
  console.log('Service completed:', completionData);
});
```

### MCP Events

#### `mcp.server.list`
Emitted when an MCP server list is received.

```javascript
client.on('mcp.server.list', (servers) => {
  console.log('MCP servers:', servers);
});
```

#### `mcp.task.execution`
Emitted when an MCP tool execution completes.

```javascript
client.on('mcp.task.execution', (executionData) => {
  console.log('MCP tool execution result:', executionData);
});
```

### Raw Events

#### `raw-message`
Emitted for every raw message received (useful for debugging).

```javascript
client.on('raw-message', (message) => {
  console.log('Raw message:', message);
});
```

## Message Types and JSON Structures

### Events Sent by Client to Orchestrator

#### Agent List Request (`client.agent.list.request`)
```json
{
  "id": "msg-uuid-001",
  "type": "client.agent.list.request",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "content": {
    "filters": {
      "status": "active",
      "capabilities": ["text-processing"]
    }
  }
}
```

#### Task Creation Request (`client.agent.task.create.request`)
```json
{
  "id": "msg-uuid-002",
  "type": "client.agent.task.create.request",
  "timestamp": "2023-12-01T10:00:01.000Z",
  "content": {
    "agentId": "agent-001",
    "agentName": "Text Processing Agent",
    "taskData": {
      "text": "hello world",
      "operation": "uppercase",
      "options": {
        "preserveSpacing": true
      }
    }
  }
}
```

#### Task Status Request (`client.agent.task.status.request`)
```json
{
  "id": "msg-uuid-003",
  "type": "client.agent.task.status.request",
  "timestamp": "2023-12-01T10:00:05.000Z",
  "content": {
    "taskId": "task-uuid-001"
  }
}
```

#### Task Message (`task.message`)
```json
{
  "id": "msg-uuid-004",
  "type": "task.message",
  "timestamp": "2023-12-01T10:00:15.000Z",
  "content": {
    "taskId": "task-uuid-001",
    "messageType": "input_response",
    "message": {
      "targetLanguage": "spanish",
      "preserveFormatting": true
    }
  }
}
```

#### MCP Server List Request (`client.mcp.server.list.request`)
```json
{
  "id": "msg-uuid-005",
  "type": "client.mcp.server.list.request",
  "timestamp": "2023-12-01T10:00:16.000Z",
  "content": {
    "filters": {
      "type": "filesystem",
      "status": "active"
    }
  }
}
```

#### MCP Server Tools Request (`mcp.server.tools`)
```json
{
  "id": "msg-uuid-006",
  "type": "mcp.server.tools",
  "timestamp": "2023-12-01T10:00:17.000Z",
  "content": {
    "serverId": "filesystem-server"
  }
}
```

#### MCP Tool Execute Request (`mcp.tool.execute`)
```json
{
  "id": "msg-uuid-007",
  "type": "mcp.tool.execute",
  "timestamp": "2023-12-01T10:00:18.000Z",
  "content": {
    "serverId": "filesystem-server",
    "toolName": "read_file",
    "parameters": {
      "path": "/data/input.txt",
      "encoding": "utf8"
    }
  }
}
```

## Usage Examples

### Basic Task Execution

```javascript
import { SwarmClientSDK } from '@agentswarmprotocol/clientsdk';

const client = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001'
});

// Connect and wait for welcome
await client.connect();

// Listen for task notifications
client.on('task.notification', (notification) => {
  console.log(`Task ${notification.taskId}: ${notification.message}`);
  if (notification.data && notification.data.progress) {
    console.log(`Progress: ${notification.data.progress}%`);
  }
});

// Get available agents
const agents = await client.getAgentsList({ status: 'active' });
console.log('Available agents:', agents);

// Send a task
const result = await client.sendTask(
  'agent-001',
  'Text Processing Agent',
  {
    text: 'hello world',
    operation: 'uppercase'
  },
  { waitForResult: true, timeout: 60000 }
);

console.log('Task result:', result);
```

### Interactive Task with User Input

```javascript
const client = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001'
});

await client.connect();

// Listen for input requests from agents
client.on('task.requestmessage', async (request) => {
  console.log(`Agent requesting input: ${request.message}`);
  
  if (request.messageType === 'input_request') {
    // Simulate getting user input
    const userInput = await getUserInput(request.message, request.options);
    
    // Send response back to the agent
    await client.sendMessageDuringTask(request.taskId, {
      response: userInput
    });
  }
});

// Start an interactive task
const result = await client.sendTask(
  'survey-agent',
  'Interactive Survey Agent',
  {
    surveyQuestions: [
      {
        id: 'q1',
        text: 'What is your favorite color?',
        options: ['red', 'blue', 'green', 'yellow']
      },
      {
        id: 'q2',
        text: 'How would you rate our service?',
        options: ['excellent', 'good', 'fair', 'poor']
      }
    ]
  },
  { waitForResult: true, timeout: 300000 } // 5 minute timeout for interactive task
);

console.log('Survey results:', result);
```

### Real-time Task Monitoring

```javascript
const client = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001'
});

await client.connect();

// Monitor all task events
client.on('task.created', (task) => {
  console.log(`✅ Task created: ${task.taskId} assigned to ${task.agentName}`);
});

client.on('task.notification', (notification) => {
  const progress = notification.data?.progress || 0;
  console.log(`🔄 ${notification.agentName}: ${notification.message} (${progress}%)`);
});

client.on('task.result', (result) => {
  console.log(`✅ Task completed: ${result.taskId}`);
  console.log('Result:', result.result);
});

client.on('task.error', (error) => {
  console.error(`❌ Task failed: ${error.taskId} - ${error.error}`);
});

// Monitor child tasks
client.on('task.childtask.created', (childTask) => {
  console.log(`🔗 Child task created: ${childTask.childTaskId} by ${childTask.agentId}`);
});

client.on('task.childtask.status', (status) => {
  console.log(`🔗 Child task ${status.childTaskId}: ${status.status}`);
});

// Send multiple tasks
const tasks = [
  { agentName: 'Text Processing Agent', data: { text: 'hello', operation: 'uppercase' } },
  { agentName: 'Data Analysis Agent', data: { dataset: 'sales.csv', analysis: 'trends' } },
  { agentName: 'Image Processing Agent', data: { image: 'photo.jpg', filter: 'blur' } }
];

for (const task of tasks) {
  const agents = await client.getAgentsList({ name: task.agentName });
  if (agents.length > 0) {
    client.sendTask(agents[0].id, task.agentName, task.data, { waitForResult: false });
  }
}
```

### MCP Integration Example

```javascript
const client = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001'
});

await client.connect();

// List available MCP servers
const servers = await client.listMCPServers();
console.log('Available MCP servers:', servers);

// Find filesystem server
const fsServer = servers.find(s => s.type === 'filesystem');
if (fsServer) {
  // Get available tools
  const tools = await client.getMCPServerTools(fsServer.id);
  console.log('Filesystem tools:', tools);
  
  // Read a file
  const fileContent = await client.executeMCPTool(
    fsServer.id,
    'read_file',
    { path: '/data/config.json' }
  );
  console.log('File content:', fileContent);
  
  // Write a file
  await client.executeMCPTool(
    fsServer.id,
    'write_file',
    {
      path: '/data/output.txt',
      content: 'Hello from Client SDK!'
    }
  );
}
```

### Error Handling and Reconnection

```javascript
const client = new SwarmClientSDK({
  orchestratorUrl: 'ws://localhost:3001',
  autoReconnect: true,
  reconnectInterval: 5000
});

// Handle connection events
client.on('connected', () => {
  console.log('✅ Connected to orchestrator');
});

client.on('disconnected', () => {
  console.log('❌ Disconnected from orchestrator');
});

client.on('error', (error) => {
  console.error('❌ Client error:', error.message);
});

// Robust task execution with error handling
async function executeTaskSafely(agentName, taskData) {
  try {
    // Ensure we're connected
    if (!client.isConnected()) {
      console.log('Not connected, attempting to connect...');
      await client.connect();
    }
    
    // Get agents
    const agents = await client.getAgentsList({ name: agentName });
    if (agents.length === 0) {
      throw new Error(`No agent found with name: ${agentName}`);
    }
    
    // Execute task with timeout
    const result = await client.sendTask(
      agents[0].id,
      agentName,
      taskData,
      { waitForResult: true, timeout: 60000 }
    );
    
    return result;
    
  } catch (error) {
    console.error('Task execution failed:', error.message);
    throw error;
  }
}

// Usage
try {
  const result = await executeTaskSafely('Text Processing Agent', {
    text: 'hello world',
    operation: 'uppercase'
  });
  console.log('Success:', result);
} catch (error) {
  console.error('Failed to execute task:', error.message);
}
``` 