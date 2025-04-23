---
id: overview
title: SDK Overview
sidebar_position: 3
---

# SDK Reference

The Agent Swarm Protocol SDK provides libraries for building and integrating agents in various programming languages.

## JavaScript/TypeScript SDK

### Installation

```bash
npm install @agent-swarm/sdk
```

### Basic Usage

```typescript
import { Agent, Orchestrator } from '@agent-swarm/sdk';

// Create and configure an agent
const agent = new Agent({
  name: 'my-custom-agent',
  description: 'A custom agent for specific tasks',
  capabilities: ['text-processing', 'summarization']
});

// Register handlers for different task types
agent.registerHandler('summarize', async (task) => {
  const { text } = task.inputs;
  // Process the text
  const summary = await generateSummary(text);
  return { summary };
});

// Connect to the orchestrator
const orchestrator = new Orchestrator('http://localhost:3000');
agent.connect(orchestrator);

// Start the agent
agent.start();
```

### API Reference

#### Agent Class

The main class for creating and managing agents.

```typescript
interface AgentConfig {
  name: string;
  description: string;
  capabilities: string[];
  endpoint?: string;
  version?: string;
}

class Agent {
  constructor(config: AgentConfig)
  
  registerHandler(taskType: string, handler: (task: Task) => Promise<any>): void
  
  connect(orchestrator: Orchestrator): void
  
  start(port?: number): Promise<void>
  
  stop(): Promise<void>
}
```

#### Orchestrator Class

Client for interacting with the orchestrator.

```typescript
class Orchestrator {
  constructor(url: string, apiKey?: string)
  
  registerAgent(agent: Agent): Promise<void>
  
  deregisterAgent(agentId: string): Promise<void>
  
  createTask(taskConfig: TaskConfig): Promise<Task>
  
  getTaskStatus(taskId: string): Promise<TaskStatus>
}
```

#### Task Interface

Represents a task in the system.

```typescript
interface Task {
  id: string;
  type: string;
  description: string;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}
```

## Python SDK

### Installation

```bash
pip install agent-swarm-sdk
```

### Basic Usage

```python
from agent_swarm import Agent, Orchestrator

# Create and configure an agent
agent = Agent(
    name="my-python-agent",
    description="A Python-based agent",
    capabilities=["data-analysis", "visualization"]
)

# Register handlers for different task types
@agent.handler("analyze")
async def analyze_data(task):
    data = task.inputs.get("data")
    # Analyze the data
    result = perform_analysis(data)
    return {"analysis": result}

# Connect to the orchestrator
orchestrator = Orchestrator("http://localhost:3000")
agent.connect(orchestrator)

# Start the agent
agent.start()
```

## Other Language SDKs

SDKs for additional languages are in development, including:

- Java
- Go
- Rust
- C#

Please check our GitHub repository for the latest updates on SDK availability. 