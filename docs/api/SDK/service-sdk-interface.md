---
sidebar_position: 6
---

# Service SDK Interface

The SwarmServiceSDK provides a comprehensive interface for creating services that connect to the Agent Swarm Protocol orchestrator. This document outlines all available methods, events, and their usage patterns.

## Installation

```bash
npm install @agentswarmprotocol/servicesdk
```

## Quick Start

```javascript
const { SwarmServiceSDK } = require('@agentswarmprotocol/servicesdk');

const service = new SwarmServiceSDK({
  name: 'My Service',
  description: 'A custom service for the Agent Swarm Protocol',
  capabilities: ['process', 'analyze']
});

await service.connect();
```

## Constructor

### `new SwarmServiceSDK(config)`

Creates a new service instance.

**Parameters:**
- `config` (ServiceConfig): Configuration object

**ServiceConfig Interface:**
```typescript
interface ServiceConfig {
  serviceId?: string;           // Unique service identifier (auto-generated if not provided)
  name?: string;               // Service name (default: 'Generic Service')
  capabilities?: string[];     // List of service capabilities
  tools?: ServiceTool[];       // Pre-defined tools
  description?: string;        // Service description
  manifest?: Record<string, any>; // Additional service metadata
  orchestratorUrl?: string;    // WebSocket URL (default: 'ws://localhost:3002')
  autoReconnect?: boolean;     // Auto-reconnect on disconnect (default: true)
  reconnectInterval?: number;  // Reconnect interval in ms (default: 5000)
  logger?: Console;           // Custom logger (default: console)
}
```

**Example:**
```javascript
const service = new SwarmServiceSDK({
  name: 'LLM Service',
  description: 'AI text generation service',
  capabilities: ['generate', 'chat', 'embed'],
  orchestratorUrl: 'ws://localhost:3002',
  autoReconnect: true,
  reconnectInterval: 5000,
  manifest: {
    version: '1.0.0',
    author: 'Your Name',
    supportsNotifications: true
  }
});
```

## Connection Methods

### `connect()`

Connects to the orchestrator and registers the service.

**Returns:** `Promise<SwarmServiceSDK>`

**Example:**
```javascript
try {
  await service.connect();
  console.log('Service connected successfully');
} catch (error) {
  console.error('Connection failed:', error.message);
}
```

### `disconnect()`

Disconnects from the orchestrator.

**Returns:** `SwarmServiceSDK`

**Example:**
```javascript
service.disconnect();
```

## Tool Registration Methods

### `registerTool(toolId, toolInfo, handler)`

Registers a tool with its handler function.

**Parameters:**
- `toolId` (string): Unique identifier for the tool
- `toolInfo` (`Omit<ServiceTool, 'id'>`): Tool information
- `handler` (TaskHandler): Function to execute when tool is called

**ServiceTool Interface:**
```typescript
interface ServiceTool {
  id: string;                    // Tool identifier
  name: string;                  // Human-readable tool name
  description: string;           // Tool description
  inputSchema?: Record<string, any>;  // JSON schema for input validation
  outputSchema?: Record<string, any>; // JSON schema for output validation
  metadata?: Record<string, any>;     // Additional tool metadata
}
```

**TaskHandler Type:**
```typescript
type TaskHandler = (params: any, message: ServiceTaskExecuteMessage) => Promise<any>;
```

**Example:**
```javascript
service.registerTool('generate_text', {
  name: 'Text Generation',
  description: 'Generate text based on prompts using AI models',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Text prompt' },
      temperature: { type: 'number', minimum: 0, maximum: 2 },
      maxTokens: { type: 'number', minimum: 1 }
    },
    required: ['prompt']
  },
  outputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      tokens: { type: 'number' }
    }
  }
}, async (params, message) => {
  // Send progress notification
  await service.sendTaskNotification(
    message.id, 
    'Starting text generation...', 
    'progress', 
    { progress: 0 }
  );
  
  // Process the request
  const result = await generateText(params.prompt, params.temperature);
  
  // Send completion notification
  await service.sendTaskNotification(
    message.id, 
    'Text generation completed', 
    'completed', 
    { progress: 100 }
  );
  
  return {
    text: result.text,
    tokens: result.tokenCount
  };
});
```

### `onTask(toolId, handler)` (Legacy)

Registers a task handler. This is a legacy method that auto-registers tools.

**Parameters:**
- `toolId` (string): Tool identifier
- `handler` (TaskHandler): Handler function

**Returns:** `SwarmServiceSDK`

**Example:**
```javascript
service.onTask('process_data', async (params, message) => {
  return { processed: true, data: params.data };
});
```

## Tool Management Methods

### `getTools()`

Returns all registered tools.

**Returns:** `ServiceTool[]`

**Example:**
```javascript
const tools = service.getTools();
console.log('Registered tools:', tools.map(t => t.name));
```

### `getTool(toolId)`

Returns a specific tool by ID.

**Parameters:**
- `toolId` (string): Tool identifier

**Returns:** `ServiceTool | undefined`

**Example:**
```javascript
const tool = service.getTool('generate_text');
if (tool) {
  console.log('Tool found:', tool.name);
}
```

## Status and Notification Methods

### `setStatus(status, message)`

Updates the service status.

**Parameters:**
- `status` (ServiceStatus): New status
- `message` (string): Optional status message

**Returns:** `Promise<void>`

**ServiceStatus Values:**
- `'active'`: Service is operational
- `'inactive'`: Service is not operational
- `'busy'`: Service is at capacity
- `'error'`: Service has encountered an error
- `'maintenance'`: Service is under maintenance

**Example:**
```javascript
await service.setStatus('active', 'Service is running normally');
await service.setStatus('busy', 'Processing high load');
await service.setStatus('maintenance', 'Updating models');
```

### `sendTaskNotification(taskId, message, notificationType, data)`

Sends a task-specific notification.

**Parameters:**
- `taskId` (string): Task identifier
- `message` (string): Notification message
- `notificationType` (ServiceNotificationType): Type of notification (default: 'info')
- `data` (any): Additional notification data (default: {})

**Returns:** `Promise<void>`

**ServiceNotificationType Values:**
- `'progress'`: Task progress updates
- `'info'`: General information
- `'warning'`: Warning messages
- `'error'`: Error notifications
- `'debug'`: Debug information
- `'started'`: Task started
- `'completed'`: Task completed
- `'failed'`: Task failed

**Example:**
```javascript
// Progress notification
await service.sendTaskNotification(
  'task-123', 
  'Processing step 2 of 5', 
  'progress', 
  { 
    progress: 40, 
    step: 2, 
    totalSteps: 5,
    estimatedTimeRemaining: 30000
  }
);

// Error notification
await service.sendTaskNotification(
  'task-123', 
  'Failed to process input', 
  'error', 
  { 
    errorCode: 'INVALID_INPUT',
    details: 'Input validation failed'
  }
);
```

### `sendClientInfoNotification(notification)`

Sends a general notification to clients.

**Parameters:**
- `notification` (any): Notification object

**Returns:** `Promise<void>`

**Example:**
```javascript
await service.sendClientInfoNotification({
  type: 'info',
  message: 'Service updated to version 2.0',
  data: {
    version: '2.0.0',
    features: ['Improved performance', 'New capabilities']
  }
});
```

### `sendOrchestratorNotification(notification)`

Sends a notification to the orchestrator.

**Parameters:**
- `notification` (ServiceNotification | any): Notification object

**Returns:** `Promise<void>`

**Example:**
```javascript
await service.sendOrchestratorNotification({
  type: 'warning',
  message: 'High memory usage detected',
  data: {
    memoryUsage: '85%',
    threshold: '80%'
  }
});
```

## Events

The SwarmServiceSDK extends EventEmitter and emits the following events:

### Connection Events

#### `connected`

Emitted when the service successfully connects to the orchestrator.

**Event Data:** None

**Example:**
```javascript
service.on('connected', () => {
  console.log('Service connected to orchestrator');
});
```

#### `disconnected`

Emitted when the service disconnects from the orchestrator.

**Event Data:** None

**Example:**
```javascript
service.on('disconnected', () => {
  console.log('Service disconnected from orchestrator');
});
```

#### `registered`

Emitted when the service is successfully registered with the orchestrator.

**Event Data:**
```json
{
  "serviceId": "llm-service-001",
  "name": "LLM Service",
  "message": "Service registered successfully"
}
```

**Example:**
```javascript
service.on('registered', (data) => {
  console.log(`Service registered with ID: ${data.serviceId}`);
});
```

### Message Events

#### `welcome`

Emitted when the orchestrator sends a welcome message.

**Event Data:**
```json
{
  "version": "1.0.0",
  "message": "Welcome to Agent Swarm Protocol",
  "config": {
    "maxConcurrentTasks": 10,
    "heartbeatInterval": 30000
  }
}
```

**Example:**
```javascript
service.on('welcome', (data) => {
  console.log(`Connected to orchestrator version: ${data.version}`);
});
```

#### `notification-received`

Emitted when the orchestrator acknowledges a notification.

**Event Data:**
```json
{
  "message": "Notification received and processed",
  "notificationId": "notif-uuid-100"
}
```

**Example:**
```javascript
service.on('notification-received', (data) => {
  console.log(`Notification acknowledged: ${data.notificationId}`);
});
```

### Task Events

#### `notification`

Emitted when the service generates internal notifications during task processing.

**Event Data:**
```json
{
  "taskId": "task-123",
  "message": "Starting tool: Text Generation",
  "type": "started",
  "data": {
    "toolId": "generate_text",
    "toolName": "Text Generation"
  }
}
```

**Example:**
```javascript
service.on('notification', (notification) => {
  console.log(`Task ${notification.taskId}: ${notification.message}`);
});
```

### Dynamic Message Events

The SDK also emits events for specific message types received from the orchestrator:

#### `orchestrator.welcome`

Raw welcome message from orchestrator.

#### `service.registered`

Raw registration confirmation message.

#### `service.task.execute`

Raw task execution request (handled internally).

#### `notification.received`

Raw notification acknowledgment.

#### `ping`

Ping message (automatically responded to with pong).

### Error Events

#### `error`

Emitted when an error occurs.

**Event Data:** Error object

**Example:**
```javascript
service.on('error', (error) => {
  console.error('Service error:', error.message);
});
```

## Complete Usage Example

```javascript
const { SwarmServiceSDK } = require('@agentswarmprotocol/servicesdk');

// Create service
const service = new SwarmServiceSDK({
  name: 'AI Processing Service',
  description: 'Advanced AI processing capabilities',
  capabilities: ['text-generation', 'image-analysis', 'data-processing'],
  manifest: {
    version: '1.0.0',
    author: 'AI Team',
    supportsNotifications: true
  }
});

// Register tools
service.registerTool('analyze_text', {
  name: 'Text Analysis',
  description: 'Analyze text for sentiment, entities, and topics',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      analysisType: { 
        type: 'string', 
        enum: ['sentiment', 'entities', 'topics', 'all'] 
      }
    },
    required: ['text']
  }
}, async (params, message) => {
  await service.sendTaskNotification(
    message.id, 
    'Starting text analysis...', 
    'progress', 
    { progress: 0 }
  );
  
  const result = await analyzeText(params.text, params.analysisType);
  
  await service.sendTaskNotification(
    message.id, 
    'Analysis completed', 
    'completed', 
    { progress: 100 }
  );
  
  return result;
});

// Set up event listeners
service.on('connected', () => {
  console.log('Service connected');
  service.setStatus('active', 'Ready to process requests');
});

service.on('registered', (data) => {
  console.log(`Registered as: ${data.serviceId}`);
});

service.on('error', (error) => {
  console.error('Service error:', error.message);
  service.setStatus('error', error.message);
});

service.on('notification', (notification) => {
  console.log(`Task notification: ${notification.message}`);
});

// Connect to orchestrator
service.connect()
  .then(() => console.log('Service startup complete'))
  .catch(error => console.error('Startup failed:', error));

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down service...');
  service.setStatus('inactive', 'Service shutting down');
  service.disconnect();
  process.exit(0);
});
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import { SwarmServiceSDK, ServiceConfig, ServiceTool, TaskHandler } from '@agentswarmprotocol/servicesdk';

const config: ServiceConfig = {
  name: 'Typed Service',
  capabilities: ['process']
};

const service = new SwarmServiceSDK(config);

const handler: TaskHandler = async (params, message) => {
  return { result: 'processed' };
};

service.registerTool('process', {
  name: 'Process Data',
  description: 'Process incoming data'
}, handler);
```

## Best Practices

1. **Error Handling**: Always wrap async operations in try-catch blocks
2. **Progress Updates**: Send regular progress notifications for long-running tasks
3. **Resource Management**: Properly clean up resources in task handlers
4. **Status Updates**: Keep service status current to help with orchestrator management
5. **Schema Validation**: Define input/output schemas for better integration
6. **Graceful Shutdown**: Handle shutdown signals to clean up connections
7. **Logging**: Use the provided logger for consistent logging across the service

## Related Documentation

- [Orchestrator Services](./orchestrator-services.md) - Complete orchestrator-services interface
- [Orchestrator API](./orchestrator-api.md) - Orchestrator REST API
- [Orchestrator Configuration](./orchestrator-configuration.md) - Configuration options
