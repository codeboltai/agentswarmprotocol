# SwarmAgentSDK

The SwarmAgentSDK provides a simple way for agents to connect to and interact with the Agent Swarm Protocol orchestrator.

## Installation

```bash
npm install @agent-swarm/agent-sdk
```

## Basic Usage

```javascript
const { SwarmAgentSDK } = require('@agent-swarm/agent-sdk');

// Create a new agent
const agent = new SwarmAgentSDK({
  name: 'MyAgent',
  description: 'A simple agent built with SwarmAgentSDK',
  capabilities: ['text-processing']
});

// Connect to the orchestrator
agent.connect()
  .then(() => {
    console.log('Connected to orchestrator');
  })
  .catch(error => {
    console.error('Error:', error.message);
  });

// Register a task handler
agent.onMessage('text-processing', async (taskData, metadata) => {
  console.log('Received text processing task:', taskData);
  
  // Process the text
  const processedText = taskData.text.toUpperCase();
  
  // Send task notifications to update the client on progress
  await agent.sendTaskNotification({
    taskId: metadata.taskId,
    notificationType: 'progress',
    message: 'Starting text processing...',
    data: { progress: 0 }
  });
  
  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await agent.sendTaskNotification({
    taskId: metadata.taskId,
    notificationType: 'progress',
    message: 'Processing text...',
    data: { progress: 50 }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await agent.sendTaskNotification({
    taskId: metadata.taskId,
    notificationType: 'progress',
    message: 'Finalizing results...',
    data: { progress: 90 }
  });
  
  // Return the result
  return {
    processedText
  };
});

// Listen for events
agent.on('error', (error) => {
  console.error('Agent error:', error.message);
});
```

## Configuration Options

The SwarmAgentSDK constructor accepts a configuration object with the following properties:

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| name | string | Name of the agent | Required |
| description | string | Agent description | '' |
| orchestratorUrl | string | WebSocket URL of the orchestrator | 'ws://localhost:3000' |
| capabilities | Array<string> | Agent capabilities | [] |
| autoReconnect | boolean | Whether to auto-reconnect | true |
| reconnectInterval | number | Reconnect interval in ms | 5000 |

## Key Features

### Task Handling

- **onMessage(taskType, handler)**: Register a handler for a specific task type
- **onMessage('*', handler)**: Register a default handler for all task types
- **sendTaskResult(taskId, result)**: Send a task result back to the client

### Task Notifications

- **sendTaskNotification(notification)**: Send a notification to inform clients about task progress
- **onNotification(handler)**: Register a handler for receiving notifications from the orchestrator

### Agent Communication

- **getAgentList(filters)**: Get a list of all available agents
- **executeAgentTask(targetAgentName, taskType, taskData)**: Ask another agent to execute a task

### MCP Integration

- **getMCPServers(filters)**: Get a list of available MCP servers
- **getMCPTools(serverId)**: Get a list of tools available on an MCP server
- **executeMCPTool(serverId, toolName, parameters)**: Execute an MCP tool
- **executeTool(toolName, parameters)**: Simplified method to execute an MCP tool

### Connection Management

- **connect()**: Connect to the orchestrator
- **disconnect()**: Disconnect from the orchestrator

### Service Communication

- **executeServiceTask(serviceId, functionName, params, options)**: Execute a task on a service
  - Allows agents to call functions provided by services with real-time notification updates
  - The `options.onNotification` callback receives progress updates during execution
- **getServiceList(filters)**: Get a list of available services

## Events

The SDK emits the following events:

- **connected**: Emitted when connected to the orchestrator
- **registered**: Emitted when the agent is registered with the orchestrator
- **disconnected**: Emitted when disconnected from the orchestrator
- **error**: Emitted when an error occurs
- **message**: Emitted for all received messages
- **task**: Emitted when a task is received

## License

MIT 