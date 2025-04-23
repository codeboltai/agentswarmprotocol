---
sidebar_position: 6
---

# Orchestrator API

The Orchestrator API provides a set of endpoints to manage and interact with your Agent Swarm Protocol deployment.

## Authentication

All API endpoints require authentication using API keys or tokens. Include the authentication token in the Authorization header:

```
Authorization: Bearer YOUR_API_TOKEN
```

## Base URL

By default, the API is accessible at:

```
http://localhost:3000/api/v1
```

## Endpoints

### Agent Management

#### List Agents

```
GET /agents
```

Returns a list of all registered agents.

#### Register Agent

```
POST /agents/register
```

Register a new agent with the orchestrator.

Request body:
```json
{
  "name": "research-agent",
  "description": "Performs research tasks",
  "capabilities": ["search", "summarize", "extract"],
  "endpoint": "http://research-agent:8080"
}
```

#### Get Agent Details

```
GET /agents/{agent_id}
```

Get detailed information about a specific agent.

#### Update Agent

```
PUT /agents/{agent_id}
```

Update the configuration of an existing agent.

#### Deregister Agent

```
DELETE /agents/{agent_id}
```

Remove an agent from the orchestrator.

### Task Management

#### Create Task

```
POST /tasks
```

Create a new task to be processed by the agent swarm.

Request body:
```json
{
  "type": "research",
  "description": "Find information about climate change",
  "inputs": {
    "query": "latest climate change statistics",
    "sources": ["academic", "news"]
  },
  "agents": ["research-agent", "summarization-agent"]
}
```

#### Get Task Status

```
GET /tasks/{task_id}
```

Check the status of a task.

#### Cancel Task

```
DELETE /tasks/{task_id}
```

Cancel an in-progress task.

### System Information

#### Health Check

```
GET /health
```

Check the health of the orchestrator service.

#### Metrics

```
GET /metrics
```

Get system metrics and statistics. 