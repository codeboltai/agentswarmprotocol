# ASP Orchestrator

The ASP Orchestrator is a component designed to manage services and tasks within the Agent Swarm Protocol ecosystem. It provides a centralized way to track agents, the services they provide, and the tasks they can perform.

## Features

- **Agent Management**: Register and track agent properties, capabilities, and status
- **Service Registry**: Catalog of services offered by agents with their input/output schemas
- **Task Management**: Create, assign, and track task status across the system
- **Agent-Task Matching**: Find suitable agents for tasks based on capabilities
- **Service Recommendations**: Suggest services based on task requirements
- **System Statistics**: Monitor usage and performance metrics

## Components

### Orchestrator

The main controller that integrates all aspects of the system:

- Maintains agent information and status
- Manages the service registry
- Handles task creation and assignment
- Provides system-wide statistics

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

## Integration with ASP

The Orchestrator is designed to work within the Agent Swarm Protocol ecosystem, providing service and task management capabilities to enhance coordination among multiple agents. It can be used by controller agents to:

1. Discover available services
2. Assign tasks to specialized agents
3. Monitor task progress
4. Collect and distribute results
5. Optimize resource allocation based on agent capabilities and availability 