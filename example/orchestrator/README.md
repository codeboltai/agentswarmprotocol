# ASP Orchestrator

The ASP Orchestrator is a component designed to manage services and tasks within the Agent Swarm Protocol ecosystem. It provides a centralized way to track agents, the services they provide, and the tasks they can perform.

## Features

- **Agent Management**: Register and track agent properties, capabilities, and status
- **Connection Management**: Efficiently handle WebSocket connections for agents with clean separation between connection and agent data
- **Service Registry**: Catalog of services offered by agents with their input/output schemas
- **Task Management**: Create, assign, and track task status across the system
- **Agent-Task Matching**: Find suitable agents for tasks based on capabilities
- **Service Recommendations**: Suggest services based on task requirements
- **System Statistics**: Monitor usage and performance metrics
- **MCP Support**: Integrate with Model Context Protocol servers for expanded tool capabilities

## Components

### Orchestrator

The main controller that integrates all aspects of the system:

- Maintains agent information and status
- Manages the service registry
- Handles task creation and assignment
- Provides system-wide statistics
- Manages MCP server connections

### Agent Registry

Manages agents with improved connection handling:

- Separates connected and disconnected agent states for better lifecycle management
- Handles WebSocket connections alongside agent metadata
- Maintains a registry of pending connections during authentication process
- Provides efficient lookups by agent ID, name, or connection ID
- Supports smooth transitions between connection states

### Service Registry

Catalogs all services that agents can provide:

- Service definitions with input/output schemas
- Service categorization 
- Provider tracking

### Task Registry 

Tracks all tasks in the system:

- Task status monitoring
- Assignment tracking
- Result storage

### MCP Integration

Manages Model Context Protocol servers:

- MCP server registration and connection
- Tool discovery and execution
- Protocol-compliant communication

## Connection Management

The orchestrator implements an improved connection management system that separates the concerns of agent identity from connection state:

### Key Features

1. **Separation of Agent Identity and Connections**: Agents and their WebSocket connections are managed independently, allowing for better lifecycle management.

2. **Connection State Tracking**: The system tracks three connection states:
   - Pending: New connections that haven't been authenticated or associated with an agent
   - Connected: Active WebSocket connections that are associated with registered agents
   - Disconnected: Agents that were previously connected but have lost their connection

3. **Efficient Lookups**: The system provides fast lookups by:
   - Connection ID
   - Agent ID
   - Agent name

4. **Smooth Reconnection**: When agents disconnect and reconnect, their state is properly maintained and tasks can be resumed.

5. **Task Management on Disconnect**: When an agent disconnects, any pending tasks are automatically handled:
   - Tasks are marked as failed with appropriate error messages
   - Clients are notified about the task failure
   - Resources are properly cleaned up

### Implementation

The connection management system is implemented across three main components:

1. **AgentRegistry**: Maintains the mappings between agents and connections
2. **AgentServer**: Handles WebSocket connections and initial registration
3. **MessageHandler**: Provides business logic for connection events

This system ensures robust handling of agent connections, disconnections, and reconnections, creating a more resilient and maintainable orchestrator.

## Usage

### Basic Setup

```javascript
const { Orchestrator } = require('./orchestrator');
const orchestrator = new Orchestrator();
```

### Registering Agents

```javascript
const agent = orchestrator.registerAgent({
  id: 'agent-1',
  name: 'Example Agent',
  type: 'assistant',
  capabilities: ['text-generation', 'question-answering']
});
```

### Registering Services

```javascript
const service = orchestrator.registerService({
  name: 'text-generation',
  providerId: agent.id,
  category: 'content',
  schema: {
    input: {
      prompt: 'string',
      maxTokens: 'number'
    },
    output: {
      text: 'string'
    }
  }
});
```

### Creating and Assigning Tasks

```javascript
// Create a task
const task = orchestrator.createTask({
  type: 'content',
  name: 'Generate product description',
  description: 'Create a compelling product description for our new item',
  input: {
    product: 'Smart Lamp',
    targetAudience: 'tech enthusiasts'
  },
  requesterId: 'requester-agent-id'
});

// Find suitable agents
const suitableAgents = orchestrator.findAgentsForTask(
  task,
  ['text-generation', 'marketing']
);

// Assign the task
orchestrator.assignTask(task.id, suitableAgents[0].id);

// Update task status
orchestrator.updateTaskStatus(task.id, 'in_progress', {
  note: 'Working on the description'
});

// Complete task
orchestrator.updateTaskStatus(task.id, 'completed', {
  note: 'Description completed',
  result: {
    description: 'An innovative smart lamp that transforms your living space...'
  }
});
```

### Working with MCP Servers

MCP (Model Context Protocol) servers provide additional tool capabilities to agents through a standardized protocol. Agents can use these tools through the orchestrator's MCP service.

#### Registering an MCP Server

```javascript
// Agent requests to register a new MCP server
const mcpServer = await agent.executeServiceTask('mcp-service', 'register-server', {
  name: 'weather-server',
  path: '/path/to/weather-server.js',
  type: 'node'
});

// Get the server ID for future reference
const serverId = mcpServer.serverId;
```

#### Connecting to an MCP Server

```javascript
// Connect to the registered server
const connection = await agent.executeServiceTask('mcp-service', 'connect-server', {
  serverId: serverId // Or use server name with: mcpServerName: 'weather-server'
});

// The server tools are available in the response
const tools = connection.tools;
```

#### Listing Available Tools

```javascript
// Get tools provided by a specific MCP server
const toolList = await agent.executeServiceTask('mcp-service', 'list-tools', {
  serverId: serverId
});

// Tools include name, description and input schema
console.log(toolList.tools);
```

#### Executing an MCP Tool

```javascript
// Execute a tool from the MCP server
const taskExecution = await agent.executeServiceTask('mcp-service', 'execute-tool', {
  serverId: serverId,
  toolName: 'get-weather',
  toolArgs: {
    location: 'San Francisco',
    units: 'metric'
  }
});

// Get the task ID to track progress
const taskId = taskExecution.taskId;

// Check task status later
const taskStatus = await agent.getTaskStatus(taskId);

// Process the result when task is completed
if (taskStatus.status === 'completed') {
  const result = taskStatus.result;
  console.log(`Weather in San Francisco: ${result.data.temperature}°C`);
}
```

### Getting Recommended Services

```javascript
const recommendedServices = orchestrator.getRecommendedServices(
  task,
  'content'
);
```

### System Statistics

```javascript
const stats = orchestrator.getStatistics();
console.log(stats);
```

## Example

See [example-usage.js](./example-usage.js) for a complete example of how to use the Orchestrator.

For MCP integration examples, see [mcp/example-usage.js](./utils/mcp/example-usage.js).

## Integration with ASP

The Orchestrator is designed to work within the Agent Swarm Protocol ecosystem, providing service and task management capabilities to enhance coordination among multiple agents. It can be used by controller agents to:

1. Discover available services
2. Assign tasks to specialized agents
3. Monitor task progress
4. Collect and distribute results
5. Optimize resource allocation based on agent capabilities and availability
6. Access external tools through MCP servers 