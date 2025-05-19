# Simple Base Agent

This is a minimal example of an agent built using the Agent Swarm Protocol SDK.

## Features

- Connects to an Agent Swarm Protocol orchestrator
- Handles text processing tasks
- Sends progress notifications
- Error handling

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the agent:
   ```bash
   npm start
   ```

## Using the Agent

Once the agent is running and connected to the orchestrator, it can receive text processing tasks.

Example task data format:
```json
{
  "text": "hello world"
}
```

The agent will:
1. Convert the text to uppercase
2. Send a progress notification
3. Return the processed text with metadata

## Development

To run in development mode with auto-reload:
```bash
npm run dev
```

To build the TypeScript code:
```bash
npm run build
``` 