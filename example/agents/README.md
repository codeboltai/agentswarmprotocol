# Agents

This directory contains example agents that demonstrate the Agent Swarm Protocol's task delegation capabilities.

## Available Agents

### BaseAgent
A parent agent that can delegate tasks to child agents or process them locally. It demonstrates:
- Task delegation to child agents
- Fallback to local processing if delegation fails
- Progress reporting during task execution
- Comprehensive error handling

### ChildAgent
A specialized child agent that receives and executes tasks from parent agents. It supports:
- Multiple task types (text processing, calculations, data analysis, echo)
- Progress reporting during execution
- Detailed result reporting
- Error handling with informative messages

## Task Delegation Flow

1. **BaseAgent** receives a task
2. **BaseAgent** determines if the task should be delegated based on task type
3. If delegating:
   - **BaseAgent** sends task request to **ChildAgent** via orchestrator
   - **ChildAgent** receives and processes the task
   - **ChildAgent** sends progress updates and final result
   - **BaseAgent** receives the result and forwards it to the original requester
4. If processing locally:
   - **BaseAgent** processes the task directly
   - **BaseAgent** sends progress updates and final result

## Supported Task Types for Delegation

The following task types are automatically delegated to the ChildAgent:
- `processText`: Text analysis and processing
- `calculate`: Mathematical operations (sum, multiply, average)
- `analyzeData`: Dataset analysis and statistics
- `echo`: Simple echo for testing

All other task types are processed locally by the BaseAgent.

## Running the Agents

### Prerequisites
1. Start the orchestrator: `cd orchestrator && npm run dev`
2. Ensure the orchestrator is running on `ws://localhost:3000`

### Starting the Agents

1. **Start ChildAgent first:**
   ```bash
   cd agents/childagent
   npm start
   ```

2. **Start BaseAgent:**
   ```bash
   cd agents/baseagent
   npm start
   ```

### Testing the Delegation

The BaseAgent automatically runs delegation tests when it starts up. You can also send tasks to the BaseAgent using a client, and it will automatically delegate appropriate tasks to the ChildAgent.

## Example Task Delegation

```typescript
// This task will be delegated to ChildAgent
const textTask = {
  taskType: 'processText',
  text: 'Hello, Agent Swarm Protocol!'
};

// This task will be processed locally by BaseAgent
const customTask = {
  taskType: 'customProcessing',
  data: { some: 'data' }
};
```

## Architecture

```
Client/External System
        ↓
    BaseAgent (Parent)
        ↓ (delegates specific tasks)
    Orchestrator
        ↓
    ChildAgent (Child)
        ↓ (returns results)
    Orchestrator
        ↓
    BaseAgent
        ↓
Client/External System
```

## Configuration

Both agents connect to the orchestrator at `ws://localhost:3000` by default. This can be modified in their respective configuration objects. 