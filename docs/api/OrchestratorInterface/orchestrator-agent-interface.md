---
sidebar_position: 7
---

# Orchestrator-Agent Interface

The orchestrator communicates with agents through WebSocket connections. This document outlines all events and their JSON message formats for bidirectional communication between the orchestrator and agents.


## Events Sent by Orchestrator to Agents

### 1. Welcome Message (`orchestrator.welcome`)

Sent when an agent first connects to the orchestrator.

```json
{
  "id": "msg-uuid-123",
  "type": "orchestrator.welcome",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "content": {
    "version": "1.0.0",
    "message": "Welcome to Agent Swarm Protocol",
    "config": {
      "maxConcurrentTasks": 5,
      "heartbeatInterval": 30000,
      "taskTimeout": 300000
    }
  }
}
```

### 2. Agent Registration Confirmation (`agent.registered`)

Confirms successful agent registration.

```json
{
  "id": "msg-uuid-124",
  "type": "agent.registered",
  "timestamp": "2023-12-01T10:00:01.000Z",
  "content": {
    "agentId": "agent-001",
    "name": "Text Processing Agent",
    "message": "Agent registered successfully"
  }
}
```

### 3. Task Execution Request (`task.execute`)

Requests the agent to execute a specific task.

```json
{
  "id": "task-uuid-125",
  "type": "task.execute",
  "timestamp": "2023-12-01T10:00:02.000Z",
  "content": {
    "taskType": "text-processing",
    "input": {
      "text": "Process this text content",
      "operation": "summarize",
      "maxLength": 100
    },
    "metadata": {
      "clientId": "client-123",
      "requestingAgentId": "agent-002",
      "timestamp": "2023-12-01T10:00:02.000Z",
      "priority": "normal",
      "timeout": 60000
    }
  }
}
```

### 4. Agent List Response (`agent.list.response`)

Response to agent list request with available agents.

```json
{
  "id": "msg-uuid-126",
  "type": "agent.list.response",
  "timestamp": "2023-12-01T10:00:03.000Z",
  "content": {
    "agents": [
      {
        "id": "agent-001",
        "name": "Text Processing Agent",
        "capabilities": ["text-processing", "summarization"],
        "status": "active",
        "agentType": "nlp"
      },
      {
        "id": "agent-002",
        "name": "Data Analysis Agent",
        "capabilities": ["data-analysis", "visualization"],
        "status": "active",
        "agentType": "analytics"
      }
    ]
  }
}
```

### 5. Agent Request (`agent.request`)

Request from another agent for task execution.

```json
{
  "id": "msg-uuid-127",
  "type": "agent.request",
  "timestamp": "2023-12-01T10:00:04.000Z",
  "content": {
    "sourceAgent": {
      "id": "agent-002",
      "name": "Data Analysis Agent"
    },
    "taskData": {
      "operation": "process_text",
      "text": "Analyze this content",
      "parameters": {
        "sentiment": true,
        "entities": true
      }
    }
  }
}
```

### 6. Agent Request Accepted (`agent.request.accepted`)

Confirmation that an agent request was accepted.

```json
{
  "id": "msg-uuid-128",
  "type": "agent.request.accepted",
  "timestamp": "2023-12-01T10:00:05.000Z",
  "content": {
    "targetAgent": "Text Processing Agent",
    "status": "accepted",
    "message": "Request accepted and queued for processing"
  }
}
```

### 7. Service Response (`service.response`)

Response from a service execution request.

```json
{
  "id": "msg-uuid-129",
  "type": "service.response",
  "timestamp": "2023-12-01T10:00:06.000Z",
  "content": {
    "serviceId": "llm-service-001",
    "result": {
      "text": "Generated response from LLM service",
      "tokens": 45,
      "model": "gpt-4"
    },
    "status": "success",
    "executionTime": 2500
  }
}
```

### 8. MCP Servers List (`mcp.servers.list`)

List of available MCP servers.

```json
{
  "id": "msg-uuid-130",
  "type": "mcp.servers.list",
  "timestamp": "2023-12-01T10:00:07.000Z",
  "content": {
    "servers": [
      {
        "id": "filesystem-server",
        "name": "File System Server",
        "type": "filesystem",
        "capabilities": ["read", "write", "list"],
        "status": "active"
      },
      {
        "id": "database-server",
        "name": "Database Server",
        "type": "database",
        "capabilities": ["query", "insert", "update"],
        "status": "active"
      }
    ]
  }
}
```

### 9. MCP Tools List (`mcp.tools.list`)

List of tools available in an MCP server.

```json
{
  "id": "msg-uuid-131",
  "type": "mcp.tools.list",
  "timestamp": "2023-12-01T10:00:08.000Z",
  "content": {
    "serverId": "filesystem-server",
    "serverName": "File System Server",
    "tools": [
      {
        "name": "read_file",
        "description": "Read contents of a file",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string" }
          },
          "required": ["path"]
        }
      },
      {
        "name": "write_file",
        "description": "Write content to a file",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string" },
            "content": { "type": "string" }
          },
          "required": ["path", "content"]
        }
      }
    ]
  }
}
```

### 10. MCP Tool Execution Result (`mcp.tool.execution.result`)

Result of MCP tool execution.

```json
{
  "id": "msg-uuid-132",
  "type": "mcp.tool.execution.result",
  "timestamp": "2023-12-01T10:00:09.000Z",
  "content": {
    "serverId": "filesystem-server",
    "toolName": "read_file",
    "result": {
      "content": "File content here...",
      "size": 1024,
      "lastModified": "2023-12-01T09:30:00.000Z"
    },
    "status": "success"
  }
}
```

### 11. Ping (`ping`)

Health check message to verify agent connectivity.

```json
{
  "id": "msg-uuid-133",
  "type": "ping",
  "timestamp": "2023-12-01T10:00:10.000Z",
  "content": {
    "timestamp": "2023-12-01T10:00:10.000Z"
  }
}
```

### 12. Error Message (`error`)

Error notification from orchestrator to agent.

```json
{
  "id": "msg-uuid-134",
  "type": "error",
  "timestamp": "2023-12-01T10:00:11.000Z",
  "content": {
    "error": "Task execution failed",
    "code": "TASK_EXECUTION_ERROR",
    "stack": "Error stack trace..."
  }
}
```

## Events Sent by Agents to Orchestrator

### 1. Agent Registration (`agent.register`)

Initial registration message sent by agent to orchestrator.

```json
{
  "id": "msg-uuid-200",
  "type": "agent.register",
  "timestamp": "2023-12-01T10:00:00.500Z",
  "content": {
    "id": "agent-001",
    "agentId": "agent-001",
    "name": "Text Processing Agent",
    "capabilities": ["text-processing", "summarization", "translation"],
    "manifest": {
      "id": "agent-001",
      "description": "Advanced text processing and analysis agent",
      "requiredServices": ["llm", "storage"],
      "version": "1.2.0",
      "author": "AI Team",
      "agentType": "nlp"
    }
  }
}
```

### 2. Task Result (`task.result`)

Result of a completed task execution.

```json
{
  "id": "msg-uuid-201",
  "type": "task.result",
  "taskId": "task-uuid-125",
  "requestId": "task-uuid-125",
  "timestamp": "2023-12-01T10:00:15.000Z",
  "content": {
    "result": {
      "processedText": "PROCESS THIS TEXT CONTENT",
      "summary": "Text processing completed successfully",
      "metadata": {
        "processingTime": 1500,
        "wordCount": 4,
        "operation": "uppercase"
      }
    },
    "status": "success"
  }
}
```

### 3. Task Notification (`task.notification`)

Progress updates and notifications during task execution.

```json
{
  "id": "msg-uuid-202",
  "type": "task.notification",
  "timestamp": "2023-12-01T10:00:12.000Z",
  "content": {
    "taskId": "task-uuid-125",
    "notificationType": "progress",
    "message": "Processing text content...",
    "data": {
      "progress": 50,
      "step": "text_analysis",
      "estimatedTimeRemaining": 3000
    },
    "level": "info",
    "clientId": "client-123"
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

### 4. Agent Status Update (`agent.status.update`)

Updates the agent's operational status.

```json
{
  "id": "msg-uuid-203",
  "type": "agent.status.update",
  "timestamp": "2023-12-01T10:00:13.000Z",
  "content": {
    "status": "active",
    "message": "Agent is ready to process tasks"
  }
}
```

**Status Values:**
- `active`: Agent is operational and ready
- `inactive`: Agent is not operational
- `busy`: Agent is processing tasks
- `error`: Agent has encountered an error
- `maintenance`: Agent is under maintenance

### 5. Service Request (`service.request`)

Request to execute a service function.

```json
{
  "id": "msg-uuid-204",
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

### 6. Agent List Request (`agent.list.request`)

Request for list of available agents.

```json
{
  "id": "msg-uuid-205",
  "type": "agent.list.request",
  "timestamp": "2023-12-01T10:00:15.000Z",
  "content": {
    "filters": {
      "status": "active",
      "capabilities": ["text-processing"],
      "agentType": "nlp"
    }
  }
}
```

### 7. Agent Task Request (`agent.task.request`)

Request for another agent to execute a task.

```json
{
  "id": "msg-uuid-206",
  "type": "agent.task.request",
  "timestamp": "2023-12-01T10:00:16.000Z",
  "content": {
    "targetAgentName": "Data Analysis Agent",
    "taskType": "data-analysis",
    "taskData": {
      "dataset": "user_behavior_data.csv",
      "analysis_type": "trend_analysis",
      "parameters": {
        "timeframe": "last_30_days",
        "metrics": ["engagement", "retention"]
      }
    },
    "timeout": 60000
  }
}
```

### 8. Agent Response (`agent.response`)

Response to another agent's request.

```json
{
  "id": "msg-uuid-207",
  "type": "agent.response",
  "timestamp": "2023-12-01T10:00:17.000Z",
  "content": {
    "targetAgentId": "agent-002",
    "data": {
      "analysis_result": {
        "trends": ["increasing_engagement", "stable_retention"],
        "insights": ["Peak usage on weekends", "Mobile users more engaged"],
        "recommendations": ["Optimize mobile experience", "Weekend promotions"]
      },
      "status": "completed"
    },
    "sourceAgent": {
      "id": "agent-001",
      "name": "Text Processing Agent"
    }
  }
}
```

### 9. MCP Servers List Request (`mcp.servers.list.request`)

Request for available MCP servers.

```json
{
  "id": "msg-uuid-208",
  "type": "mcp.servers.list.request",
  "timestamp": "2023-12-01T10:00:18.000Z",
  "content": {
    "filters": {
      "type": "filesystem",
      "capabilities": ["read", "write"]
    }
  }
}
```

### 10. MCP Tools List Request (`mcp.tools.list.request`)

Request for tools available in an MCP server.

```json
{
  "id": "msg-uuid-209",
  "type": "mcp.tools.list.request",
  "timestamp": "2023-12-01T10:00:19.000Z",
  "content": {
    "serverId": "filesystem-server"
  }
}
```

### 11. MCP Tool Execute Request (`mcp.tool.execute.request`)

Request to execute an MCP tool.

```json
{
  "id": "msg-uuid-210",
  "type": "mcp.tool.execute.request",
  "timestamp": "2023-12-01T10:00:20.000Z",
  "content": {
    "serverId": "filesystem-server",
    "toolName": "read_file",
    "parameters": {
      "path": "/data/input.txt"
    },
    "timeout": 30000
  }
}
```

### 12. Pong Response (`pong`)

Response to ping health check.

```json
{
  "id": "msg-uuid-211",
  "type": "pong",
  "timestamp": "2023-12-01T10:00:10.100Z",
  "content": {
    "timestamp": "2023-12-01T10:00:10.100Z"
  }
}
```

