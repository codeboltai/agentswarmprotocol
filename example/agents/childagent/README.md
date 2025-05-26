# Child Agent

A specialized agent designed to receive and execute tasks delegated from parent agents through the Agent Swarm Protocol orchestrator.

## Features

- **Task Delegation**: Receives tasks from parent agents via the orchestrator
- **Multiple Task Types**: Supports various task types including text processing, calculations, data analysis, and echo tasks
- **Progress Reporting**: Sends progress updates during task execution
- **Error Handling**: Comprehensive error handling with detailed error messages
- **Extensible**: Easy to add new task types and capabilities

## Supported Task Types

### 1. processText
Processes and analyzes text content.
```json
{
  "taskType": "processText",
  "text": "Your text content here"
}
```

### 2. calculate
Performs mathematical operations on arrays of numbers.
```json
{
  "taskType": "calculate",
  "operation": "sum|multiply|average",
  "numbers": [1, 2, 3, 4, 5]
}
```

### 3. analyzeData
Analyzes datasets and provides statistical information.
```json
{
  "taskType": "analyzeData",
  "dataset": [1, "text", true, 42]
}
```

### 4. echo
Simple echo task for testing purposes.
```json
{
  "taskType": "echo",
  "message": "Hello from parent agent!"
}
```

### 5. generic
Handles any other task type with basic processing.

## Usage

### Starting the Child Agent

```bash
npm start
```

or for development with auto-restart:

```bash
npm run dev
```

### Task Execution Flow

1. Child agent connects to the orchestrator
2. Parent agent sends task request through orchestrator
3. Child agent receives task and sends progress update
4. Child agent processes the task based on task type
5. Child agent sends completion progress update
6. Child agent sends final result back to parent agent

## Configuration

The child agent connects to the orchestrator at `ws://localhost:3000` by default. This can be modified in the agent configuration.

## Integration with Parent Agents

Parent agents can delegate tasks to this child agent using the `executeChildAgentTask` method:

```typescript
const result = await parentAgent.executeChildAgentTask('ChildAgent', {
  taskType: 'processText',
  text: 'Hello world!'
});
```

## Dependencies

- `@agent-swarm/agent-sdk`: Core SDK for agent functionality
- `chalk`: Terminal styling for better logging
- `uuid`: Unique identifier generation 