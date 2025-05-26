# BaseClient - Agent Swarm Protocol Test Client

A test client specifically designed to interact with the BaseAgent and demonstrate the task delegation functionality between BaseAgent and ChildAgent.

## Features

- **BaseAgent Targeting**: Specifically looks for and connects to the "BaseAgent" instead of the first available agent
- **Task Delegation Testing**: Sends various types of tasks to test both delegation and local processing
- **Comprehensive Logging**: Color-coded output with emojis for better readability
- **Multiple Test Scenarios**: Tests different task types to demonstrate the full delegation workflow

## Test Tasks

The client sends 4 different types of tasks to demonstrate the delegation functionality:

### 1. Echo Task (Delegated to ChildAgent)
```json
{
  "taskType": "echo",
  "message": "Hello from baseclient! This should be processed by ChildAgent."
}
```

### 2. Text Processing Task (Delegated to ChildAgent)
```json
{
  "taskType": "processText",
  "text": "The Agent Swarm Protocol enables seamless communication between distributed agents in a microservices architecture."
}
```

### 3. Calculation Task (Delegated to ChildAgent)
```json
{
  "taskType": "calculate",
  "operation": "sum",
  "numbers": [15, 25, 35, 45, 55]
}
```

### 4. Custom Task (Processed Locally by BaseAgent)
```json
{
  "taskType": "customProcessing",
  "query": "This is a custom task that should be processed locally by BaseAgent.",
  "metadata": {
    "source": "baseclient",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Expected Behavior

1. **Tasks 1-3**: Will be delegated by BaseAgent to ChildAgent
   - BaseAgent receives the task
   - BaseAgent determines the task should be delegated
   - BaseAgent sends task to ChildAgent via orchestrator
   - ChildAgent processes the task and sends result back
   - BaseAgent receives result and forwards to client

2. **Task 4**: Will be processed locally by BaseAgent
   - BaseAgent receives the task
   - BaseAgent determines the task should be processed locally
   - BaseAgent processes the task directly
   - BaseAgent sends result to client

## Usage

### Prerequisites

1. **Start the orchestrator:**
   ```bash
   cd orchestrator
   npm run dev
   ```

2. **Start ChildAgent:**
   ```bash
   cd agents/childagent
   npm start
   ```

3. **Start BaseAgent:**
   ```bash
   cd agents/baseagent
   npm start
   ```

### Running the Client

```bash
cd clients/baseclient
npm start
```

or for development:

```bash
npm run dev
```

## Configuration

- **Orchestrator URL**: `ws://localhost:3001` (Client server port)
- **Target Agent**: Specifically looks for "BaseAgent"
- **Timeout**: 60 seconds per task
- **Auto-reconnect**: Disabled for debugging

## Output

The client provides detailed, color-coded output showing:
- Connection status
- Agent discovery and selection
- Task execution progress
- Results from both delegated and local processing
- Error handling and fallback scenarios

## Architecture Flow

```
BaseClient
    ↓ (sends tasks)
BaseAgent
    ↓ (delegates specific tasks)
Orchestrator
    ↓
ChildAgent
    ↓ (returns results)
Orchestrator
    ↓
BaseAgent
    ↓ (forwards results)
BaseClient
```

## Error Handling

- If BaseAgent is not found, the client lists all available agents
- If task execution fails, detailed error information is provided
- The client gracefully handles timeouts and connection issues 