---
sidebar_position: 8
---

# Orchestrator-Client Interface

The orchestrator communicates with clients through WebSocket connections. This document outlines all events and their JSON message formats for bidirectional communication between the orchestrator and clients.



## Events Sent by Orchestrator to Clients

### 1. Welcome Message (`orchestrator.client.welcome`)

Sent when a client first connects to the orchestrator, providing the client ID and configuration.

```json
{
  "id": "msg-uuid-123",
  "type": "orchestrator.client.welcome",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "content": {
    "clientId": "client-001",
    "version": "1.0.0",
    "message": "Welcome to Agent Swarm Protocol",
    "config": {
      "maxConcurrentTasks": 10,
      "defaultTimeout": 30000,
      "supportedFeatures": ["tasks", "agents", "mcp"]
    }
  }
}
```

### 2. Agent List Response (`client.agent.list.response`)

Response to agent list request with available agents.

```json
{
  "id": "msg-uuid-124",
  "type": "client.agent.list.response",
  "timestamp": "2023-12-01T10:00:01.000Z",
  "content": {
    "agents": [
      {
        "id": "agent-001",
        "name": "Text Processing Agent",
        "status": "active",
        "capabilities": ["text-processing", "summarization", "translation"],
        "description": "Advanced text processing and analysis agent"
      },
      {
        "id": "agent-002",
        "name": "Data Analysis Agent",
        "status": "active",
        "capabilities": ["data-analysis", "visualization", "statistics"],
        "description": "Comprehensive data analysis and visualization agent"
      }
    ]
  }
}
```

### 3. Task Creation Response (`client.agent.task.create.response`)

Confirmation that a task has been created and assigned to an agent.

```json
{
  "id": "msg-uuid-125",
  "type": "client.agent.task.create.response",
  "timestamp": "2023-12-01T10:00:02.000Z",
  "content": {
    "taskId": "task-uuid-001",
    "agentId": "agent-001",
    "agentName": "Text Processing Agent",
    "status": "created",
    "createdAt": "2023-12-01T10:00:02.000Z",
    "message": "Task successfully created and assigned to agent"
  }
}
```

### 4. Task Result (`client.agent.task.result`)

Final result of a completed task.

```json
{
  "id": "msg-uuid-126",
  "type": "client.agent.task.result",
  "timestamp": "2023-12-01T10:00:15.000Z",
  "content": {
    "taskId": "task-uuid-001",
    "agentId": "agent-001",
    "agentName": "Text Processing Agent",
    "status": "completed",
    "result": {
      "processedText": "HELLO WORLD",
      "summary": "Text converted to uppercase",
      "metadata": {
        "processingTime": 1500,
        "wordCount": 2,
        "operation": "uppercase"
      }
    },
    "createdAt": "2023-12-01T10:00:02.000Z",
    "completedAt": "2023-12-01T10:00:15.000Z"
  }
}
```

### 5. Task Status Response (`client.agent.task.status.response`)

Response to task status request.

```json
{
  "id": "msg-uuid-127",
  "type": "client.agent.task.status.response",
  "timestamp": "2023-12-01T10:00:10.000Z",
  "content": {
    "taskId": "task-uuid-001",
    "status": "running",
    "agentId": "agent-001",
    "agentName": "Text Processing Agent",
    "createdAt": "2023-12-01T10:00:02.000Z",
    "progress": {
      "percentage": 75,
      "currentStep": "text_analysis",
      "estimatedTimeRemaining": 5000
    }
  }
}
```

### 6. Task Notification (`task.notification`)

Real-time updates about task progress or agent actions.

```json
{
  "id": "msg-uuid-128",
  "type": "task.notification",
  "timestamp": "2023-12-01T10:00:08.000Z",
  "content": {
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
}
```

**Notification Types:**
- `progress`: Task progress updates
- `info`: General information
- `warning`: Warning messages
- `error`: Error notifications
- `debug`: Debug information
- `step`: Step-by-step progress
- `status`: Status updates

### 7. Task Error (`task.error`)

Error notification when a task fails.

```json
{
  "id": "msg-uuid-129",
  "type": "task.error",
  "timestamp": "2023-12-01T10:00:20.000Z",
  "content": {
    "taskId": "task-uuid-002",
    "agentId": "agent-001",
    "agentName": "Text Processing Agent",
    "error": "Invalid input format",
    "code": "INVALID_INPUT",
    "details": "Expected string input, received object",
    "timestamp": "2023-12-01T10:00:20.000Z"
  }
}
```

### 8. Task Request Message (`task.requestmessage`)

Message from agent requesting additional input during task execution.

```json
{
  "id": "msg-uuid-130",
  "type": "task.requestmessage",
  "timestamp": "2023-12-01T10:00:12.000Z",
  "content": {
    "taskId": "task-uuid-001",
    "agentId": "agent-001",
    "agentName": "Text Processing Agent",
    "messageType": "input_request",
    "message": "Please provide the target language for translation",
    "options": ["spanish", "french", "german", "italian"],
    "timeout": 30000
  }
}
```

### 9. Child Task Created (`task.childtask.created`)

Notification when an agent creates a subtask.

```json
{
  "id": "msg-uuid-131",
  "type": "task.childtask.created",
  "timestamp": "2023-12-01T10:00:14.000Z",
  "content": {
    "parentTaskId": "task-uuid-001",
    "childTaskId": "task-uuid-003",
    "agentId": "agent-001",
    "childAgentId": "agent-002",
    "childAgentName": "Data Analysis Agent",
    "taskType": "data_analysis",
    "description": "Analyze sentiment of processed text"
  }
}
```

### 10. Child Task Status (`task.childtask.status`)

Status update for a child task.

```json
{
  "id": "msg-uuid-132",
  "type": "task.childtask.status",
  "timestamp": "2023-12-01T10:00:18.000Z",
  "content": {
    "parentTaskId": "task-uuid-001",
    "childTaskId": "task-uuid-003",
    "status": "completed",
    "result": {
      "sentiment": "positive",
      "confidence": 0.85,
      "emotions": ["joy", "satisfaction"]
    }
  }
}
```

### 11. Service Started (`service.started`)

Notification when a service starts processing.

```json
{
  "id": "msg-uuid-133",
  "type": "service.started",
  "timestamp": "2023-12-01T10:00:05.000Z",
  "content": {
    "serviceId": "llm-service-001",
    "serviceName": "LLM Processing Service",
    "taskId": "task-uuid-001",
    "operation": "text_generation",
    "estimatedDuration": 5000
  }
}
```

### 12. Service Notification (`service.notification`)

Updates from services during processing.

```json
{
  "id": "msg-uuid-134",
  "type": "service.notification",
  "timestamp": "2023-12-01T10:00:07.000Z",
  "content": {
    "serviceId": "llm-service-001",
    "serviceName": "LLM Processing Service",
    "taskId": "task-uuid-001",
    "notificationType": "progress",
    "message": "Generating response...",
    "data": {
      "tokensGenerated": 45,
      "estimatedTotal": 100
    }
  }
}
```

### 13. Service Completed (`service.completed`)

Notification when a service completes processing.

```json
{
  "id": "msg-uuid-135",
  "type": "service.completed",
  "timestamp": "2023-12-01T10:00:12.000Z",
  "content": {
    "serviceId": "llm-service-001",
    "serviceName": "LLM Processing Service",
    "taskId": "task-uuid-001",
    "status": "success",
    "result": {
      "generatedText": "This is the generated response",
      "tokensUsed": 87,
      "model": "gpt-4"
    },
    "executionTime": 7000
  }
}
```

### 14. MCP Server List Response (`client.mcp.server.list.response`)

Response with available MCP servers.

```json
{
  "id": "msg-uuid-136",
  "type": "client.mcp.server.list.response",
  "timestamp": "2023-12-01T10:00:16.000Z",
  "content": {
    "servers": [
      {
        "id": "filesystem-server",
        "name": "File System Server",
        "type": "filesystem",
        "status": "active",
        "capabilities": ["read", "write", "list", "delete"]
      },
      {
        "id": "database-server",
        "name": "Database Server",
        "type": "database",
        "status": "active",
        "capabilities": ["query", "insert", "update", "delete"]
      }
    ]
  }
}
```

### 15. MCP Task Execution (`mcp.task.execution`)

Result of MCP tool execution.

```json
{
  "id": "msg-uuid-137",
  "type": "mcp.task.execution",
  "timestamp": "2023-12-01T10:00:18.000Z",
  "content": {
    "serverId": "filesystem-server",
    "toolName": "read_file",
    "status": "success",
    "result": {
      "content": "File content here...",
      "size": 1024,
      "lastModified": "2023-12-01T09:30:00.000Z"
    },
    "executionTime": 150
  }
}
```

### 16. Error Message (`error`)

General error notification from orchestrator.

```json
{
  "id": "msg-uuid-138",
  "type": "error",
  "timestamp": "2023-12-01T10:00:20.000Z",
  "content": {
    "error": "Agent not found",
    "code": "AGENT_NOT_FOUND",
    "details": "No agent found with name 'NonExistentAgent'"
  }
}
```

## Events Sent by Clients to Orchestrator

### 1. Agent List Request (`client.agent.list.request`)

Request for list of available agents.

```json
{
  "id": "msg-uuid-200",
  "type": "client.agent.list.request",
  "timestamp": "2023-12-01T10:00:00.500Z",
  "content": {
    "filters": {
      "status": "active",
      "capabilities": ["text-processing"],
      "name": "Text"
    }
  }
}
```

### 2. Task Creation Request (`client.agent.task.create.request`)

Request to create a task for an agent.

```json
{
  "id": "msg-uuid-201",
  "type": "client.agent.task.create.request",
  "timestamp": "2023-12-01T10:00:01.000Z",
  "content": {
    "agentId": "agent-001",
    "agentName": "Text Processing Agent",
    "taskData": {
      "text": "hello world",
      "operation": "uppercase",
      "options": {
        "preserveSpacing": true,
        "addTimestamp": false
      }
    }
  }
}
```

### 3. Task Status Request (`client.agent.task.status.request`)

Request for task status information.

```json
{
  "id": "msg-uuid-202",
  "type": "client.agent.task.status.request",
  "timestamp": "2023-12-01T10:00:05.000Z",
  "content": {
    "taskId": "task-uuid-001"
  }
}
```

### 4. Task Message (`task.message`)

Send a message to a running task (response to task.requestmessage).

```json
{
  "id": "msg-uuid-203",
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

### 5. MCP Server List Request (`client.mcp.server.list.request`)

Request for available MCP servers.

```json
{
  "id": "msg-uuid-204",
  "type": "client.mcp.server.list.request",
  "timestamp": "2023-12-01T10:00:16.000Z",
  "content": {
    "filters": {
      "type": "filesystem",
      "status": "active",
      "capabilities": ["read", "write"]
    }
  }
}
```

### 6. MCP Server Tools Request (`mcp.server.tools`)

Request for tools available in an MCP server.

```json
{
  "id": "msg-uuid-205",
  "type": "mcp.server.tools",
  "timestamp": "2023-12-01T10:00:17.000Z",
  "content": {
    "serverId": "filesystem-server"
  }
}
```

### 7. MCP Tool Execute Request (`mcp.tool.execute`)

Request to execute an MCP tool.

```json
{
  "id": "msg-uuid-206",
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

### 8. Client Registration (`client.register`)

Register client with the orchestrator (optional).

```json
{
  "id": "msg-uuid-207",
  "type": "client.register",
  "timestamp": "2023-12-01T10:00:00.100Z",
  "content": {
    "clientName": "Web Dashboard",
    "clientType": "web",
    "version": "1.0.0",
    "capabilities": ["task_management", "agent_monitoring"]
  }
}
```

### 9. Client List Request (`client.list`)

Request for list of connected clients.

```json
{
  "id": "msg-uuid-208",
  "type": "client.list",
  "timestamp": "2023-12-01T10:00:19.000Z",
  "content": {
    "filters": {
      "clientType": "web",
      "status": "active"
    }
  }
}
```

### 10. Direct Message (`client.message`)

Send a direct message through the orchestrator.

```json
{
  "id": "msg-uuid-209",
  "type": "client.message",
  "timestamp": "2023-12-01T10:00:20.000Z",
  "content": {
    "targetClientId": "client-002",
    "messageType": "notification",
    "data": {
      "title": "Task Completed",
      "message": "Your text processing task has been completed",
      "taskId": "task-uuid-001"
    }
  }
}
```

## Client SDK Events

The Client SDK emits the following events that applications can subscribe to:

### Connection Events
- `connected` - Emitted when connected to the orchestrator
- `disconnected` - Emitted when disconnected from the orchestrator
- `error` - Emitted when an error occurs
- `welcome` - Emitted when receiving the welcome message

### Task Events
- `task.created` - Emitted when a task is created
- `task.result` - Emitted when a task result is received
- `task.status` - Emitted when a task status changes
- `task.error` - Emitted when a task error occurs
- `task.notification` - Emitted when a task notification is received
- `task.requestmessage` - Emitted when an agent requests input
- `task.childtask.created` - Emitted when a child task is created
- `task.childtask.status` - Emitted when a child task status changes

### Agent Events
- `agent.list` - Emitted when an agent list is received

### Service Events
- `service.started` - Emitted when a service starts
- `service.notification` - Emitted when a service sends a notification
- `service.completed` - Emitted when a service completes

### MCP Events
- `mcp.server.list` - Emitted when MCP server list is received
- `mcp.task.execution` - Emitted when MCP tool execution completes

### Raw Events
- `raw-message` - Emitted for every message received (for debugging)

