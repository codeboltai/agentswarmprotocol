# Terminal Client for Agent Swarm Protocol

A command-line interface to interact with the ASP Orchestrator using the SwarmClientSDK.

## Directory Structure

The terminal client is organized into the following modules:

```
clients/
├── handlers/              # Command handlers
│   ├── chat-handler.js    # Handles chat functionality
│   └── task-handler.js    # Handles task-related functionality
├── models/               
│   └── state.js           # Client state model
├── utils/                
│   ├── connection.js      # Connection to orchestrator
│   ├── display.js         # Display formatting
│   └── helpers.js         # Common helper functions
└── terminal-client.js     # Main terminal client (modular implementation)
```

## Components

### Models

- **state.js**: Manages the client's global application state.

### Utils

- **helpers.js**: Contains common helper functions like prompting users and displaying help.
- **display.js**: Contains functions for formatting and displaying data.
- **connection.js**: Handles connecting to the orchestrator and setting up event handlers.

### Handlers

- **chat-handler.js**: Handles functionality related to chat sessions with agents.
- **task-handler.js**: Handles sending tasks to agents and checking task status.

## Usage

Run the terminal client:

```bash
# From the example directory
node clients/terminal-client-refactored.js

# Or directly
./clients/terminal-client-refactored.js
```

Available commands:

- `agents` - List available agents
- `task` - Send a task to an agent
- `chat` - Start a chat session with an agent
- `status` - Check task status
- `mcp` - List available MCP servers
- `help` - Show help message
- `exit` - Exit the client

## Advantages of Modular Design

1. **Maintainability**: Each module has a single responsibility, making it easier to understand and maintain.
2. **Reusability**: Functions can be reused across different parts of the application.
3. **Testability**: Isolated components are easier to test independently.
4. **Scalability**: New features can be added by creating new modules without modifying existing code.
5. **Readability**: Smaller files are easier to navigate and understand. 