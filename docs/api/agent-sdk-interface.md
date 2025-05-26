---
sidebar_position: 9
---

# Agent SDK Interface

The SwarmAgentSDK provides a comprehensive interface for creating agents that connect to the Agent Swarm Protocol orchestrator. This document outlines all available methods, events, and their usage patterns.

## Installation

```bash
npm install @agentswarmprotocol/agentsdk
```

## Quick Start

```javascript
const { SwarmAgentSDK } = require('@agentswarmprotocol/agentsdk');

const agent = new SwarmAgentSDK({
  name: 'Text Processing Agent',
  description: 'Advanced text processing and analysis agent',
  capabilities: ['text-processing', 'summarization', 'translation'],
  agentType: 'nlp'
});

// Register task handler
agent.onTask(async (taskData, message) => {
  // Process the task
  const result = await processTask(taskData);
  
  // Send result back
  agent.sendTaskResult(message.content.taskId, result);
  
  return result;
});

await agent.connect();
```

## Constructor

### `new SwarmAgentSDK(config)`

Creates a new agent instance.

**Parameters:**
- `config` (`AgentConfig`): Configuration object

```typescript
interface AgentConfig {
  agentId?: string;           // Unique agent ID (auto-generated if not provided)
  name?: string;              // Agent name (default: 'Generic Agent')
  agentType?: string;         // Agent type (default: 'generic')
  capabilities?: string[];    // Agent capabilities (default: [])
  description?: string;       // Agent description
  manifest?: object;          // Additional agent metadata
  orchestratorUrl?: string;   // Orchestrator WebSocket URL (default: 'ws://localhost:3000')
  autoReconnect?: boolean;    // Auto-reconnect on disconnect (default: true)
  reconnectInterval?: number; // Reconnect interval in ms (default: 5000)
  logger?: Console;           // Custom logger (default: console)
}
```

## Connection Methods

### `connect()`

Connects to the orchestrator and registers the agent.

**Returns:** `Promise<SwarmAgentSDK>`

```javascript
await agent.connect();
```

### `disconnect()`

Disconnects from the orchestrator.

**Returns:** `SwarmAgentSDK`

```javascript
agent.disconnect();
```

### `setStatus(status)`

Updates the agent's status.

**Parameters:**
- `status` (`AgentStatus`): New status ('active' | 'inactive' | 'busy' | 'error' | 'maintenance')

**Returns:** `Promise<void>`

```javascript
await agent.setStatus('busy');
```

## Task Management Methods

### `onTask(handler)`

Registers a task handler function that will be called when tasks are received.

**Parameters:**
- `handler` (`TaskHandler`): Function to handle incoming tasks

**Returns:** `SwarmAgentSDK`

```javascript
agent.onTask(async (taskData, message) => {
  console.log('Received task:', taskData);
  
  // Process the task
  const result = await processTask(taskData);
  
  // Send result back
  agent.sendTaskResult(message.content.taskId, result);
  
  return result;
});
```

### `sendTaskResult(taskId, result)`

Sends the result of a completed task back to the orchestrator.

**Parameters:**
- `taskId` (string): ID of the task
- `result` (any): Task result data

**Returns:** `void`

```javascript
agent.sendTaskResult('task-123', {
  processedText: 'HELLO WORLD',
  metadata: { processingTime: 1500 }
});
```

### `sendTaskMessage(taskId, content)`

Sends a message during task execution (for notifications or updates).

**Parameters:**
- `taskId` (string): ID of the task being executed
- `content` (any): Message content

**Returns:** `void`

```javascript
agent.sendTaskMessage('task-123', {
  type: 'progress',
  message: 'Processing step 1 of 3...',
  progress: 33
});
```

### `requestMessageDuringTask(taskId, content, timeout)`

Sends a request message during task execution and waits for a response.

**Parameters:**
- `taskId` (string): ID of the task being executed
- `content` (any): Request content
- `timeout` (number): Timeout in milliseconds (default: 30000)

**Returns:** `Promise<any>`

```javascript
const userInput = await agent.requestMessageDuringTask('task-123', {
  type: 'input_request',
  message: 'Please provide the target language for translation',
  options: ['spanish', 'french', 'german']
}, 30000);
```

## Agent Communication Methods

### `getAgentList(filters)`

Gets a list of available agents from the orchestrator.

**Parameters:**
- `filters` (`Record<string, any>`): Optional filter criteria

**Returns:** `Promise<any[]>`

```javascript
const agents = await agent.getAgentList({
  status: 'active',
  capabilities: ['text-processing']
});
```

### `executeChildAgentTask(targetAgentName, taskData, timeout)`

Requests another agent to perform a task.

**Parameters:**
- `targetAgentName` (string): Name of the target agent
- `taskData` (any): Task data to send
- `timeout` (number): Request timeout in milliseconds (default: 30000)

**Returns:** `Promise<any>`

```javascript
const result = await agent.executeChildAgentTask(
  'Data Analysis Agent',
  {
    dataset: 'user_behavior.csv',
    analysis_type: 'sentiment'
  },
  60000
);
```

## Service Communication Methods

### `getServiceList(filters)`

Gets a list of available services.

**Parameters:**
- `filters` (`Record<string, any>`): Optional filter criteria

**Returns:** `Promise<any[]>`

```javascript
const services = await agent.getServiceList({
  type: 'llm',
  status: 'active'
});
```

### `getServiceToolList(serviceId, options)`

Gets a list of tools available for a specific service.

**Parameters:**
- `serviceId` (string): Service ID or name
- `options` (object): Optional parameters
  - `timeout` (number): Request timeout

**Returns:** `Promise<any[]>`

```javascript
const tools = await agent.getServiceToolList('llm-service', {
  timeout: 10000
});
```

### `executeServiceTool(serviceId, toolId, params, options)`

Executes a tool on a service.

**Parameters:**
- `serviceId` (string): Service ID or name
- `toolId` (string): Tool ID
- `params` (`Record<string, any>`): Tool parameters
- `options` (object): Additional options
  - `timeout` (number): Request timeout (default: 30000)

**Returns:** `Promise<any>`

```javascript
const result = await agent.executeServiceTool(
  'llm-service',
  'generate_text',
  {
    prompt: 'Write a summary of AI agents',
    max_tokens: 100,
    temperature: 0.7
  },
  { timeout: 60000 }
);
```

### `executeServiceTask(serviceId, toolName, params, options)`

Legacy method for executing service tasks (delegates to `executeServiceTool`).

**Parameters:**
- `serviceId` (string): Service ID or name
- `toolName` (string): Tool name
- `params` (`Record<string, any>`): Tool parameters
- `options` (object): Additional options

**Returns:** `Promise<any>`

## MCP (Model Context Protocol) Methods

### `getMCPServers(filters, timeout)`

Gets a list of available MCP servers.

**Parameters:**
- `filters` (`Record<string, any>`): Optional filter criteria
- `timeout` (number): Request timeout in milliseconds (default: 30000)

**Returns:** `Promise<any[]>`

```javascript
const servers = await agent.getMCPServers({
  type: 'filesystem',
  status: 'active'
}, 10000);
```

### `getMCPTools(serverId, timeout)`

Gets a list of tools available on an MCP server.

**Parameters:**
- `serverId` (string): Server ID
- `timeout` (number): Request timeout in milliseconds (default: 30000)

**Returns:** `Promise<any[]>`

```javascript
const tools = await agent.getMCPTools('filesystem-server', 15000);
```

### `executeMCPTool(serverId, toolName, parameters, timeout)`

Executes a tool on an MCP server.

**Parameters:**
- `serverId` (string): Server ID
- `toolName` (string): Tool name
- `parameters` (`Record<string, any>`): Tool parameters
- `timeout` (number): Request timeout in milliseconds (default: 60000)

**Returns:** `Promise<any>`

```javascript
const result = await agent.executeMCPTool(
  'filesystem-server',
  'read_file',
  {
    path: '/data/input.txt',
    encoding: 'utf8'
  },
  30000
);
```

## Utility Methods

### `sendRequestWaitForResponse(message, options)`

Sends a custom request message and waits for a response.

**Parameters:**
- `message` (`Partial<BaseMessage>`): Message to send
- `options` (object): Additional options
  - `timeout` (number): Request timeout

**Returns:** `Promise<any>`

```javascript
const response = await agent.sendRequestWaitForResponse({
  type: 'custom.request',
  content: { data: 'example' }
}, { timeout: 15000 });
```

## Events Emitted by Agent SDK

The Agent SDK emits the following events that can be subscribed to:

### Connection Events

#### `connected`
Emitted when the agent connects to the orchestrator.

```javascript
agent.on('connected', () => {
  console.log('Agent connected to orchestrator');
});
```

#### `registered`
Emitted when the agent is successfully registered with the orchestrator.

```javascript
agent.on('registered', (registrationData) => {
  console.log('Agent registered:', registrationData);
});
```

**Event Data Structure:**
```json
{
  "agentId": "agent-001",
  "name": "Text Processing Agent",
  "message": "Agent registered successfully"
}
```

#### `disconnected`
Emitted when the agent disconnects from the orchestrator.

```javascript
agent.on('disconnected', () => {
  console.log('Agent disconnected from orchestrator');
});
```

#### `error`
Emitted when an error occurs.

```javascript
agent.on('error', (error) => {
  console.error('Agent error:', error.message);
});
```

### Task Events

#### `task`
Emitted when a task is received from the orchestrator.

```javascript
agent.on('task', (taskData, message) => {
  console.log('Task received:', taskData);
});
```

**Event Data Structure:**
```json
{
  "taskType": "text-processing",
  "input": {
    "text": "hello world",
    "operation": "uppercase"
  },
  "metadata": {
    "taskId": "task-123",
    "clientId": "client-001",
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

#### `task.messageresponse`
Emitted when a response to a task message request is received.

```javascript
agent.on('task.messageresponse', (responseData) => {
  console.log('Task message response:', responseData);
});
```

### Agent Communication Events

#### `agent-request-accepted`
Emitted when a child agent request is accepted.

```javascript
agent.on('agent-request-accepted', (data) => {
  console.log('Child agent request accepted:', data);
});
```

#### `childagent.response`
Emitted when a response is received from a child agent.

```javascript
agent.on('childagent.response', (responseData) => {
  console.log('Child agent response:', responseData);
});
```

### Service Events

#### `service-request-accepted`
Emitted when a service request is accepted.

```javascript
agent.on('service-request-accepted', (data) => {
  console.log('Service request accepted:', data);
});
```

#### `service-response`
Emitted when a response is received from a service.

```javascript
agent.on('service-response', (responseData) => {
  console.log('Service response:', responseData);
});
```

#### `service-task-execute-response`
Emitted when a service task execution response is received.

```javascript
agent.on('service-task-execute-response', (responseData) => {
  console.log('Service task execution response:', responseData);
});
```

#### `service-tools-list-response`
Emitted when a service tools list response is received.

```javascript
agent.on('service-tools-list-response', (toolsList) => {
  console.log('Service tools list:', toolsList);
});
```

#### `service-notification`
Emitted when a service sends a notification.

```javascript
agent.on('service-notification', (notification) => {
  console.log('Service notification:', notification);
});
```

### MCP Events

#### `mcp-servers-list`
Emitted when an MCP servers list is received.

```javascript
agent.on('mcp-servers-list', (servers) => {
  console.log('MCP servers:', servers);
});
```

#### `mcp-tools-list`
Emitted when an MCP tools list is received.

```javascript
agent.on('mcp-tools-list', (tools) => {
  console.log('MCP tools:', tools);
});
```

#### `mcp-tool-execution-result`
Emitted when an MCP tool execution result is received.

```javascript
agent.on('mcp-tool-execution-result', (result) => {
  console.log('MCP tool execution result:', result);
});
```

#### `agent-mcp-servers-list-result`
Emitted when an agent MCP servers list result is received.

```javascript
agent.on('agent-mcp-servers-list-result', (servers) => {
  console.log('Agent MCP servers list result:', servers);
});
```

#### `mcp-tools-list-result`
Emitted when an MCP tools list result is received.

```javascript
agent.on('mcp-tools-list-result', (tools) => {
  console.log('MCP tools list result:', tools);
});
```

#### `mcp-tool-execute-result`
Emitted when an MCP tool execute result is received.

```javascript
agent.on('mcp-tool-execute-result', (result) => {
  console.log('MCP tool execute result:', result);
});
```

### System Events

#### `welcome`
Emitted when a welcome message is received from the orchestrator.

```javascript
agent.on('welcome', (welcomeData) => {
  console.log('Welcome message:', welcomeData);
});
```

#### `task-message-received`
Emitted when a task message is received confirmation.

```javascript
agent.on('task-message-received', (data) => {
  console.log('Task message received confirmation:', data);
});
```

#### `raw-message`
Emitted for every raw message received (useful for debugging).

```javascript
agent.on('raw-message', (message) => {
  console.log('Raw message:', message);
});
```

## Message Types and JSON Structures

### Events Sent by Agent to Orchestrator

#### Agent Registration (`agent.register`)
```json
{
  "id": "msg-uuid-001",
  "type": "agent.register",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "content": {
    "id": "agent-001",
    "agentId": "agent-001",
    "name": "Text Processing Agent",
    "capabilities": ["text-processing", "summarization", "translation"],
    "manifest": {
      "id": "agent-001",
      "description": "Advanced text processing and analysis agent",
      "version": "1.0.0",
      "agentType": "nlp"
    }
  }
}
```

#### Task Result (`task.result`)
```json
{
  "id": "msg-uuid-002",
  "type": "task.result",
  "taskId": "task-123",
  "requestId": "task-123",
  "timestamp": "2023-12-01T10:00:15.000Z",
  "content": {
    "result": {
      "processedText": "HELLO WORLD",
      "metadata": {
        "processingTime": 1500,
        "wordCount": 2,
        "operation": "uppercase"
      }
    },
    "status": "success"
  }
}
```

#### Task Notification (`task.notification`)
```json
{
  "id": "msg-uuid-003",
  "type": "task.notification",
  "timestamp": "2023-12-01T10:00:08.000Z",
  "content": {
    "taskId": "task-123",
    "notificationType": "progress",
    "message": "Processing text content...",
    "data": {
      "progress": 50,
      "step": "text_analysis",
      "estimatedTimeRemaining": 7500
    },
    "level": "info",
    "clientId": "client-001"
  }
}
```

#### Agent Status Update (`agent.status.update`)
```json
{
  "id": "msg-uuid-004",
  "type": "agent.status.update",
  "timestamp": "2023-12-01T10:00:05.000Z",
  "content": {
    "status": "busy",
    "message": "Processing multiple tasks"
  }
}
```

#### Agent List Request (`agent.list.request`)
```json
{
  "id": "msg-uuid-005",
  "type": "agent.list.request",
  "timestamp": "2023-12-01T10:00:10.000Z",
  "content": {
    "filters": {
      "status": "active",
      "capabilities": ["text-processing"]
    }
  }
}
```

#### Agent Task Request (`agent.task.request`)
```json
{
  "id": "msg-uuid-006",
  "type": "agent.task.request",
  "timestamp": "2023-12-01T10:00:12.000Z",
  "content": {
    "targetAgentName": "Data Analysis Agent",
    "taskType": "data-analysis",
    "taskData": {
      "dataset": "user_behavior.csv",
      "analysis_type": "sentiment"
    },
    "timeout": 60000
  }
}
```

#### Service Request (`service.request`)
```json
{
  "id": "msg-uuid-007",
  "type": "service.request",
  "timestamp": "2023-12-01T10:00:14.000Z",
  "content": {
    "service": "llm",
    "params": {
      "prompt": "Summarize this text",
      "temperature": 0.7,
      "maxTokens": 100
    }
  }
}
```

#### MCP Servers List Request (`mcp.servers.list.request`)
```json
{
  "id": "msg-uuid-008",
  "type": "mcp.servers.list.request",
  "timestamp": "2023-12-01T10:00:16.000Z",
  "content": {
    "filters": {
      "type": "filesystem",
      "status": "active"
    }
  }
}
```

#### MCP Tools List Request (`mcp.tools.list.request`)
```json
{
  "id": "msg-uuid-009",
  "type": "mcp.tools.list.request",
  "timestamp": "2023-12-01T10:00:18.000Z",
  "content": {
    "serverId": "filesystem-server"
  }
}
```

#### MCP Tool Execute Request (`mcp.tool.execute.request`)
```json
{
  "id": "msg-uuid-010",
  "type": "mcp.tool.execute.request",
  "timestamp": "2023-12-01T10:00:20.000Z",
  "content": {
    "serverId": "filesystem-server",
    "toolName": "read_file",
    "parameters": {
      "path": "/data/input.txt",
      "encoding": "utf8"
    },
    "timeout": 30000
  }
}
```

#### Pong Response (`pong`)
```json
{
  "id": "msg-uuid-011",
  "type": "pong",
  "timestamp": "2023-12-01T10:00:22.000Z",
  "content": {}
}
```

## Usage Examples

### Basic Agent Implementation

```javascript
import { SwarmAgentSDK } from '@agentswarmprotocol/agentsdk';

const agent = new SwarmAgentSDK({
  name: 'Text Processing Agent',
  description: 'Processes and transforms text content',
  capabilities: ['text-processing', 'uppercase', 'lowercase', 'reverse'],
  agentType: 'nlp'
});

// Register task handler
agent.onTask(async (taskData, message) => {
  const { text, operation } = taskData;
  const taskId = message.content.taskId;
  
  // Send progress notification
  agent.sendTaskMessage(taskId, {
    type: 'progress',
    message: `Starting ${operation} operation...`,
    progress: 0
  });
  
  let result;
  switch (operation) {
    case 'uppercase':
      result = text.toUpperCase();
      break;
    case 'lowercase':
      result = text.toLowerCase();
      break;
    case 'reverse':
      result = text.split('').reverse().join('');
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  
  // Send completion notification
  agent.sendTaskMessage(taskId, {
    type: 'progress',
    message: 'Operation completed',
    progress: 100
  });
  
  return {
    processedText: result,
    originalText: text,
    operation: operation,
    timestamp: new Date().toISOString()
  };
});

// Connect to orchestrator
await agent.connect();
console.log('Agent connected and ready');
```

### Advanced Agent with Service Integration

```javascript
const agent = new SwarmAgentSDK({
  name: 'AI Content Generator',
  capabilities: ['content-generation', 'text-analysis'],
  agentType: 'ai-assistant'
});

agent.onTask(async (taskData, message) => {
  const { prompt, maxTokens = 100 } = taskData;
  const taskId = message.content.taskId;
  
  try {
    // Get available LLM services
    const services = await agent.getServiceList({ type: 'llm' });
    if (services.length === 0) {
      throw new Error('No LLM services available');
    }
    
    // Use the first available LLM service
    const llmService = services[0];
    
    // Generate content using the service
    const result = await agent.executeServiceTool(
      llmService.id,
      'generate_text',
      {
        prompt: prompt,
        max_tokens: maxTokens,
        temperature: 0.7
      }
    );
    
    return {
      generatedText: result.text,
      tokensUsed: result.tokens,
      model: result.model
    };
    
  } catch (error) {
    agent.sendTaskMessage(taskId, {
      type: 'error',
      message: `Content generation failed: ${error.message}`
    });
    throw error;
  }
});

await agent.connect();
```

### Agent with MCP Integration

```javascript
const agent = new SwarmAgentSDK({
  name: 'File Processing Agent',
  capabilities: ['file-processing', 'data-analysis'],
  agentType: 'utility'
});

agent.onTask(async (taskData, message) => {
  const { filePath, operation } = taskData;
  const taskId = message.content.taskId;
  
  try {
    // Get filesystem MCP servers
    const servers = await agent.getMCPServers({ type: 'filesystem' });
    if (servers.length === 0) {
      throw new Error('No filesystem servers available');
    }
    
    const fsServer = servers[0];
    
    // Read file content
    const fileContent = await agent.executeMCPTool(
      fsServer.id,
      'read_file',
      { path: filePath }
    );
    
    // Process the content based on operation
    let result;
    switch (operation) {
      case 'word_count':
        result = {
          wordCount: fileContent.split(/\s+/).length,
          charCount: fileContent.length
        };
        break;
      case 'line_count':
        result = {
          lineCount: fileContent.split('\n').length
        };
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    return {
      filePath: filePath,
      operation: operation,
      result: result,
      processedAt: new Date().toISOString()
    };
    
  } catch (error) {
    agent.sendTaskMessage(taskId, {
      type: 'error',
      message: `File processing failed: ${error.message}`
    });
    throw error;
  }
});

await agent.connect();
```

### Interactive Agent with User Input

```javascript
const agent = new SwarmAgentSDK({
  name: 'Interactive Survey Agent',
  capabilities: ['survey', 'data-collection'],
  agentType: 'interactive'
});

agent.onTask(async (taskData, message) => {
  const { surveyQuestions } = taskData;
  const taskId = message.content.taskId;
  const responses = [];
  
  for (let i = 0; i < surveyQuestions.length; i++) {
    const question = surveyQuestions[i];
    
    // Request user input
    const response = await agent.requestMessageDuringTask(
      taskId,
      {
        type: 'input_request',
        message: question.text,
        options: question.options,
        required: question.required
      },
      60000 // 60 second timeout
    );
    
    responses.push({
      questionId: question.id,
      question: question.text,
      answer: response.answer
    });
    
    // Send progress update
    agent.sendTaskMessage(taskId, {
      type: 'progress',
      message: `Question ${i + 1} of ${surveyQuestions.length} completed`,
      progress: ((i + 1) / surveyQuestions.length) * 100
    });
  }
  
  return {
    surveyId: taskData.surveyId,
    responses: responses,
    completedAt: new Date().toISOString()
  };
});

await agent.connect();
``` 