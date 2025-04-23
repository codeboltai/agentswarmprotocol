---
sidebar_position: 5
---

# Orchestrator Services

The orchestrator is the central component of the Agent Swarm Protocol (ASP), providing a suite of core services that agents can leverage. This document outlines the available services and how agents can interact with them.

## Core Services Overview

The ASP orchestrator provides several categories of services:

1. **Foundation Services**: Basic capabilities required by most agents
2. **Integration Services**: Connections to external systems and APIs
3. **Agent Management Services**: Services for working with other agents
4. **Utility Services**: Helper functionalities for common tasks

## Accessing Services

Agents can request services using the `requestService` method:

```javascript
const result = await agent.requestService('serviceName', {
  // Service-specific parameters
  param1: 'value1',
  param2: 'value2'
});
```

## Foundation Services

### LLM Service

Provides access to language models for text generation, analysis, and more.

```javascript
// Basic LLM request
const completion = await agent.requestService('llm', {
  prompt: 'Generate a summary of the following text: ...',
  temperature: 0.7,
  model: 'gpt-4' // Optional, defaults to configured model
});

// Chat completion
const chatResponse = await agent.requestService('llm', {
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  temperature: 0.5
});

// Function calling
const functionResult = await agent.requestService('llm', {
  messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
  functions: [{
    name: 'get_weather',
    description: 'Get the current weather in a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' }
      },
      required: ['location']
    }
  }],
  function_call: 'auto'
});
```

### Storage Service

Provides persistent storage capabilities for agents.

```javascript
// Store data
await agent.requestService('storage', {
  action: 'set',
  key: 'user-preferences',
  value: { theme: 'dark', notifications: true }
});

// Retrieve data
const preferences = await agent.requestService('storage', {
  action: 'get',
  key: 'user-preferences'
});

// Delete data
await agent.requestService('storage', {
  action: 'delete',
  key: 'user-preferences'
});

// List keys with a prefix
const keys = await agent.requestService('storage', {
  action: 'list',
  prefix: 'user-'
});
```

### State Management Service

Manages shared state between agents.

```javascript
// Update state (creates if doesn't exist)
await agent.requestService('state', {
  action: 'update',
  path: 'workflow.status',
  value: 'running'
});

// Get state
const status = await agent.requestService('state', {
  action: 'get',
  path: 'workflow.status'
});

// Watch for state changes
await agent.requestService('state', {
  action: 'watch',
  path: 'workflow',
  callback: (newState) => {
    console.log('Workflow state changed:', newState);
  }
});

// Transaction (atomic update)
await agent.requestService('state', {
  action: 'transaction',
  operations: [
    { action: 'update', path: 'counter', value: 5 },
    { action: 'update', path: 'lastUpdated', value: new Date().toISOString() }
  ]
});
```

### Logging Service

Provides structured logging for debugging and monitoring.

```javascript
// Log a message
await agent.requestService('logging', {
  level: 'info', // 'debug', 'info', 'warn', 'error'
  message: 'Processing user request',
  context: {
    userId: '12345',
    requestId: 'req-abc-123'
  }
});

// Log an error
await agent.requestService('logging', {
  level: 'error',
  message: 'Failed to process user request',
  error: new Error('Invalid input'),
  context: {
    userId: '12345',
    requestId: 'req-abc-123'
  }
});
```

## Integration Services

### Web Search Service

Provides web search capabilities.

```javascript
const searchResults = await agent.requestService('web-search', {
  query: 'latest AI research papers',
  numResults: 5,
  includeSnippets: true
});
```

### Web Browsing Service

Enables agents to browse and extract information from web pages.

```javascript
const pageContent = await agent.requestService('web-browser', {
  action: 'fetchPage',
  url: 'https://example.com/article'
});

const extractedData = await agent.requestService('web-browser', {
  action: 'extractData',
  url: 'https://example.com/products',
  selectors: {
    products: '.product-item',
    name: '.product-name',
    price: '.product-price'
  }
});
```

### File Service

Provides file operations for agents.

```javascript
// Read file
const fileContent = await agent.requestService('file', {
  action: 'read',
  path: '/temp/data.json'
});

// Write file
await agent.requestService('file', {
  action: 'write',
  path: '/temp/results.json',
  content: JSON.stringify({ results: [1, 2, 3] })
});

// List files
const files = await agent.requestService('file', {
  action: 'list',
  path: '/temp',
  pattern: '*.json'
});
```

### Database Service

Provides database access for agents.

```javascript
// Execute query
const results = await agent.requestService('database', {
  type: 'query',
  query: 'SELECT * FROM users WHERE status = ?',
  params: ['active']
});

// Execute transaction
await agent.requestService('database', {
  type: 'transaction',
  statements: [
    { query: 'INSERT INTO users (name, email) VALUES (?, ?)', params: ['John', 'john@example.com'] },
    { query: 'UPDATE stats SET user_count = user_count + 1' }
  ]
});
```

### API Gateway Service

Provides access to external REST APIs.

```javascript
const response = await agent.requestService('api-gateway', {
  method: 'GET',
  url: 'https://api.example.com/data',
  headers: {
    'Authorization': 'Bearer token123'
  },
  params: {
    limit: 10,
    offset: 0
  }
});
```

## Agent Management Services

### Agent Discovery Service

Allows agents to discover other agents in the system.

```javascript
// List all available agents
const allAgents = await agent.requestService('agent-discovery', {
  action: 'list'
});

// Find agents with specific capabilities
const searchAgents = await agent.requestService('agent-discovery', {
  action: 'find',
  capabilities: ['search', 'summarize']
});

// Get agent details
const agentDetails = await agent.requestService('agent-discovery', {
  action: 'getDetails',
  agentName: 'research-agent'
});
```

### Child Agent Service

Allows an agent to create and manage child agents.

```javascript
// Start a child agent
const childAgent = await agent.requestService('agent', {
  action: 'start',
  agentName: 'specialized-processor',
  config: {
    customOption: 'value'
  }
});

// Send a message to a child agent
const response = await agent.requestService('agent', {
  action: 'send',
  agentId: childAgent.id,
  message: {
    type: 'process.request',
    content: { data: 'to process' }
  },
  waitForResponse: true
});

// Stop a child agent
await agent.requestService('agent', {
  action: 'stop',
  agentId: childAgent.id
});
```

### Workflow Service

Allows agents to create and execute workflows.

```javascript
// Execute a workflow
const workflowResult = await agent.requestService('workflow', {
  action: 'execute',
  workflowName: 'data-processing',
  inputs: {
    data: ['item1', 'item2', 'item3']
  }
});

// Get workflow status
const status = await agent.requestService('workflow', {
  action: 'getStatus',
  workflowId: 'wf-123456'
});

// Register a new workflow
await agent.requestService('workflow', {
  action: 'register',
  workflow: {
    name: 'custom-workflow',
    description: 'A custom workflow',
    steps: [
      // Workflow step definitions
    ]
  }
});
```

## Utility Services

### Tool Execution Service (MCP)

Allows agents to use Machine Communication Protocol (MCP) tools.

```javascript
// Execute an MCP tool
const result = await agent.requestService('mcp', {
  tool: 'calculator',
  params: {
    operation: 'multiply',
    a: 5,
    b: 3
  }
});

// List available MCP tools
const tools = await agent.requestService('mcp', {
  action: 'listTools'
});
```

### Vector Database Service

Provides vector database capabilities for semantic search.

```javascript
// Store embeddings
await agent.requestService('vector-db', {
  action: 'store',
  collection: 'documents',
  items: [
    { id: 'doc1', vector: [...], metadata: { title: 'Document 1' } },
    { id: 'doc2', vector: [...], metadata: { title: 'Document 2' } }
  ]
});

// Search by vector similarity
const results = await agent.requestService('vector-db', {
  action: 'search',
  collection: 'documents',
  vector: [...],
  limit: 5
});

// Create embeddings and store
const textEmbeddings = await agent.requestService('vector-db', {
  action: 'embed',
  texts: ['Document text 1', 'Document text 2'],
  model: 'text-embedding-ada-002'
});
```

### Scheduling Service

Allows agents to schedule tasks for future execution.

```javascript
// Schedule a one-time task
await agent.requestService('scheduler', {
  action: 'schedule',
  task: {
    type: 'agent.message',
    agent: 'reminder-agent',
    message: {
      type: 'reminder',
      content: 'Follow up with client'
    }
  },
  when: '2023-12-25T09:00:00Z'
});

// Schedule a recurring task
await agent.requestService('scheduler', {
  action: 'schedule',
  task: {
    type: 'agent.message',
    agent: 'report-generator',
    message: {
      type: 'generate-report'
    }
  },
  cron: '0 9 * * 1' // Every Monday at 9 AM
});

// Cancel a scheduled task
await agent.requestService('scheduler', {
  action: 'cancel',
  taskId: 'task-123456'
});
```

### Notification Service

Provides notification capabilities for agents.

```javascript
// Send a notification
await agent.requestService('notification', {
  channel: 'email',
  recipient: 'user@example.com',
  subject: 'Task Completed',
  message: 'Your requested task has been completed.',
  data: {
    taskId: '12345',
    result: 'success'
  }
});
```

## Service Security and Access Control

By default, agents can only access services that they declare in their manifest file's `requiredServices` array. The orchestrator enforces this access control to ensure agents only use the services they need.

```json
{
  "name": "example-agent",
  "version": "1.0.0",
  "requiredServices": [
    "llm",
    "storage",
    "web-search"
  ]
}
```

## Creating Custom Services

The ASP orchestrator can be extended with custom services. Here's an example of creating a custom service:

```javascript
// In your orchestrator configuration
const customService = {
  name: 'custom-service',
  handler: async (params, context) => {
    // Service implementation
    return { result: 'Custom service result' };
  }
};

const orchestrator = new Orchestrator({
  // ... other options
  customServices: [customService]
});
```

## Best Practices

- **Error Handling**: Always handle errors when calling services
- **Timeouts**: Set reasonable timeouts for service calls
- **Batching**: Batch related service calls when possible
- **Caching**: Cache service results when appropriate
- **Rate Limiting**: Be aware of service rate limits and throttle requests when necessary
- **Security**: Never expose sensitive information through service calls
- **Minimal Permissions**: Request only the services your agent actually needs

## Next Steps

Now that you understand the orchestrator services, you can:

1. Learn about [agent communication patterns](./../user-guide/agent-communication)
2. Explore [agent marketplace](./../user-guide/agent-marketplace) publishing
3. Dive into [advanced workflows](./../user-guide/advanced-workflows)

## Related Topics

1. Learn about agent communication patterns 