---
sidebar_position: 5
---

# Orchestrator Services

The orchestrator is the central component of the Agent Swarm Protocol (ASP), providing a suite of core services that agents can leverage. This document outlines the available services and how agents can interact with them.

## Orchestrator-Services Interface

The orchestrator communicates with services through WebSocket connections. This section documents all events and their JSON message formats for bidirectional communication between the orchestrator and services.


### Events Sent by Orchestrator to Services

#### 1. Welcome Message (`orchestrator.welcome`)

Sent when a service first connects to the orchestrator.

```json
{
  "id": "msg-uuid-123",
  "type": "orchestrator.welcome",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "content": {
    "version": "1.0.0",
    "message": "Welcome to Agent Swarm Protocol",
    "config": {
      "maxConcurrentTasks": 10,
      "heartbeatInterval": 30000
    }
  }
}
```

#### 2. Service Registration Confirmation (`service.registered`)

Confirms successful service registration.

```json
{
  "id": "msg-uuid-124",
  "type": "service.registered",
  "timestamp": "2023-12-01T10:00:01.000Z",
  "content": {
    "serviceId": "llm-service-001",
    "name": "LLM Service",
    "message": "Service registered successfully"
  }
}
```

#### 3. Task Execution Request (`service.task.execute`)

Requests the service to execute a specific function/tool.

```json
{
  "id": "task-uuid-125",
  "type": "service.task.execute",
  "timestamp": "2023-12-01T10:00:02.000Z",
  "content": {
    "functionName": "generate_text",
    "params": {
      "prompt": "Write a summary of AI trends",
      "temperature": 0.7,
      "maxTokens": 500
    },
    "metadata": {
      "agentId": "agent-001",
      "clientId": "client-123",
      "timestamp": "2023-12-01T10:00:02.000Z",
      "priority": "normal"
    }
  }
}
```

#### 4. Notification Acknowledgment (`notification.received`)

Acknowledges receipt of a service notification.

```json
{
  "id": "msg-uuid-126",
  "type": "notification.received",
  "timestamp": "2023-12-01T10:00:03.000Z",
  "content": {
    "message": "Notification received and processed",
    "notificationId": "notif-uuid-100"
  }
}
```

#### 5. Status Update Confirmation (`service.status.updated`)

Confirms a service status update.

```json
{
  "id": "msg-uuid-127",
  "type": "service.status.updated",
  "timestamp": "2023-12-01T10:00:04.000Z",
  "content": {
    "status": "active",
    "message": "Service status updated successfully"
  }
}
```

#### 6. Ping (`ping`)

Health check message to verify service connectivity.

```json
{
  "id": "msg-uuid-128",
  "type": "ping",
  "timestamp": "2023-12-01T10:00:05.000Z",
  "content": {
    "timestamp": "2023-12-01T10:00:05.000Z"
  }
}
```

#### 7. Error Message (`error`)

Error notification from orchestrator to service.

```json
{
  "id": "msg-uuid-129",
  "type": "error",
  "timestamp": "2023-12-01T10:00:06.000Z",
  "content": {
    "error": "Invalid function name provided",
    "code": "INVALID_FUNCTION",
    "stack": "Error stack trace..."
  }
}
```

### Events Sent by Services to Orchestrator

#### 1. Service Registration (`service.register`)

Initial registration message sent by service to orchestrator.

```json
{
  "id": "msg-uuid-200",
  "type": "service.register",
  "timestamp": "2023-12-01T10:00:00.500Z",
  "content": {
    "id": "llm-service-001",
    "name": "LLM Service",
    "capabilities": ["generate", "chat", "embed"],
    "tools": [
      {
        "id": "generate_text",
        "name": "Text Generation",
        "description": "Generate text based on prompts",
        "inputSchema": {
          "type": "object",
          "properties": {
            "prompt": { "type": "string" },
            "temperature": { "type": "number" },
            "maxTokens": { "type": "number" }
          },
          "required": ["prompt"]
        },
        "outputSchema": {
          "type": "object",
          "properties": {
            "text": { "type": "string" },
            "tokens": { "type": "number" }
          }
        }
      }
    ],
    "manifest": {
      "description": "OpenAI-powered language model service",
      "version": "1.2.0",
      "supportsNotifications": true,
      "author": "ASP Team"
    }
  }
}
```

#### 2. Task Result (`service.task.result`)

Result of a completed task execution.

```json
{
  "id": "msg-uuid-201",
  "type": "service.task.result",
  "taskId": "task-uuid-125",
  "timestamp": "2023-12-01T10:00:10.000Z",
  "content": {
    "serviceId": "llm-service-001",
    "taskId": "task-uuid-125",
    "result": {
      "text": "AI trends in 2023 include the rise of large language models...",
      "tokens": 487,
      "model": "gpt-4",
      "usage": {
        "promptTokens": 13,
        "completionTokens": 487,
        "totalTokens": 500
      }
    }
  }
}
```

#### 3. Task Notification (`service.task.notification`)

Progress updates and notifications during task execution.

```json
{
  "id": "msg-uuid-202",
  "type": "service.task.notification",
  "timestamp": "2023-12-01T10:00:07.000Z",
  "content": {
    "serviceId": "llm-service-001",
    "taskId": "task-uuid-125",
    "notification": {
      "type": "progress",
      "message": "Processing prompt...",
      "timestamp": "2023-12-01T10:00:07.000Z",
      "data": {
        "progress": 50,
        "step": "tokenization",
        "estimatedTimeRemaining": 3000
      }
    }
  }
}
```

**Notification Types:**
- `progress`: Task progress updates
- `info`: General information
- `warning`: Warning messages
- `error`: Error notifications
- `debug`: Debug information
- `started`: Task started
- `completed`: Task completed
- `failed`: Task failed

#### 4. Service Status Update (`service.status`)

Updates the service's operational status.

```json
{
  "id": "msg-uuid-203",
  "type": "service.status",
  "timestamp": "2023-12-01T10:00:08.000Z",
  "content": {
    "serviceId": "llm-service-001",
    "status": "active",
    "message": "Service is running normally",
    "timestamp": "2023-12-01T10:00:08.000Z"
  }
}
```

**Status Values:**
- `active`: Service is operational
- `inactive`: Service is not operational
- `busy`: Service is at capacity
- `error`: Service has encountered an error
- `maintenance`: Service is under maintenance

#### 5. General Service Notification (`service.notification`)

General notifications sent to clients or orchestrator.

```json
{
  "id": "msg-uuid-204",
  "type": "service.notification",
  "timestamp": "2023-12-01T10:00:09.000Z",
  "content": {
    "serviceId": "llm-service-001",
    "notification": {
      "type": "info",
      "message": "Model updated to latest version",
      "timestamp": "2023-12-01T10:00:09.000Z",
      "data": {
        "previousVersion": "gpt-4-0613",
        "newVersion": "gpt-4-1106-preview",
        "improvements": ["Better reasoning", "Longer context"]
      }
    }
  }
}
```

#### 6. Service Error (`service.error`)

Error messages from service to orchestrator.

```json
{
  "id": "msg-uuid-205",
  "type": "service.error",
  "timestamp": "2023-12-01T10:00:11.000Z",
  "content": {
    "error": "API rate limit exceeded",
    "code": "RATE_LIMIT_EXCEEDED",
    "taskId": "task-uuid-125",
    "stack": "Error: Rate limit exceeded at..."
  }
}
```

#### 7. Pong Response (`pong`)

Response to ping health check.

```json
{
  "id": "msg-uuid-206",
  "type": "pong",
  "timestamp": "2023-12-01T10:00:05.100Z",
  "content": {
    "timestamp": "2023-12-01T10:00:05.100Z"
  }
}
```


