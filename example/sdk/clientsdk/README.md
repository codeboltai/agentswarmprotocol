# SwarmClientSDK

The SwarmClientSDK provides a simple way for clients to connect to and interact with the Agent Swarm Protocol orchestrator.

## Installation

```bash
npm install @agent-swarm/client-sdk
```

## Basic Usage

```javascript
const { createClient } = require('@agent-swarm/client-sdk');

// Create a new client
const client = createClient({
  orchestratorUrl: 'ws://localhost:3001'
});

// Connect to the orchestrator
client.connect()
  .then(async () => {
    console.log('Connected to orchestrator');
    
    // Get list of available agents
    const agents = await client.getAgents();
    
    // Send a task to an agent
    const task = await client.sendTask('MyAgent', {
      taskType: 'text-processing',
      text: 'Hello, world!'
    });
    
    console.log(`Task created with ID: ${task.taskId}`);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });

// Listen for events
client.on('task-result', (result) => {
  console.log('Task completed:', result);
});

// Subscribe to task notifications to get real-time updates
const unsubscribe = client.subscribeToNotifications((notification) => {
  console.log(`Notification: ${notification.message}`);
  console.log(`Type: ${notification.notificationType}`);
  console.log(`From: ${notification.agentName}`);
  console.log(`Data:`, notification.data);
});

// Later, when you no longer want to receive notifications
// unsubscribe();
```

## Configuration Options

The SwarmClientSDK constructor accepts a configuration object with the following properties:

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| orchestratorUrl | string | WebSocket URL of the orchestrator | 'ws://localhost:3001' |
| autoReconnect | boolean | Whether to auto-reconnect | true |
| reconnectInterval | number | Reconnect interval in ms | 5000 |

## Methods

### Connection Management

- **connect()**: Connect to the orchestrator
- **disconnect()**: Disconnect from the orchestrator

### Agent Interaction

- **getAgents(filters)**: Get a list of all available agents
- **sendTask(agentName, taskData, options)**: Send a task to an agent
- **getTaskStatus(taskId)**: Get the status of a task

### Task Notifications

- **subscribeToNotifications(options, callback)**: Subscribe to real-time task notifications
  - **options.taskId**: Filter notifications for a specific task
  - **options.agentId**: Filter notifications from a specific agent
  - **options.notificationType**: Filter notifications by type

### MCP Server Information

- **listMCPServers(filters)**: List available MCP servers

> **Note:** MCP operations (like executing tools) can only be performed by agents, not clients. Clients can view available MCP servers but cannot register new servers or execute MCP tools directly. Instead, clients should send tasks to agents that have MCP capabilities.

### Communication

- **send(message)**: Send a message to the orchestrator
- **sendAndWaitForResponse(message, options)**: Send a message and wait for a response

## Events

The SDK emits the following events:

- **connected**: Emitted when connected to the orchestrator
- **disconnected**: Emitted when disconnected from the orchestrator
- **welcome**: Emitted when a welcome message is received from the orchestrator
- **error**: Emitted when an error occurs
- **message**: Emitted for all received messages
- **agent-list**: Emitted when an agent list is received
- **task-result**: Emitted when a task result is received
- **task-status**: Emitted when task status information is received
- **task-created**: Emitted when a task is created
- **task-notification**: Emitted when a task notification is received from an agent
- **orchestrator-error**: Emitted when the orchestrator reports an error

## Example

For a complete example of how to use the SwarmClientSDK, check out the [terminal-client.js](../../clients/terminal-client.js) in the clients directory.

## License

MIT