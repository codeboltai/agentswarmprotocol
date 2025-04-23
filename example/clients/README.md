# Agent Swarm Protocol Clients

This directory contains client applications for interacting with the Agent Swarm Protocol orchestrator.

## Terminal Client

The Terminal Client provides a command-line interface for interacting with the orchestrator:

- List available agents
- Send tasks to agents
- Check task status
- Execute workflows

### Installation

```bash
# From the clients directory
npm install
npm link  # Installs the client globally as 'asp-cli'

# Or from the parent directory
npm run client:install
```

### Usage

You can run the client in two ways:

```bash
# Using the global command (if linked)
asp-cli

# Or directly with Node
node terminal-client.js

# Or from the parent directory using npm
npm run client:terminal
```

### Configuration

The client connects to the Orchestrator's client WebSocket port. By default, it uses:

- `ws://localhost:3001`

You can configure the connection URL by setting the `ORCHESTRATOR_CLIENT_URL` environment variable
in the `.env` file in the parent directory.

### Available Commands

Once the client is running, the following commands are available:

- `agents` - List all available agents
- `task` - Send a task to an agent
- `status` - Check the status of a task
- `workflow` - Execute a workflow
- `help` - Show the help menu
- `exit` or `quit` - Exit the client

### Example: Sending a Task to the Conversation Agent

```
> agents
# View the available agents

> task
# Select the conversation-agent
Enter agent name: conversation-agent

# Enter the task data
Task data: {"message": "Hello, how are you?", "conversationId": "test-123"}

# The agent will process the task and send back a response
```

### Example: Executing a Workflow

```
> workflow
Enter workflow name: example-workflow

# Enter any additional options
Options: {"initialMessage": "Start the process", "parameters": {"key": "value"}}

# The workflow will execute and return its results
```

## Creating New Clients

You can use the Terminal Client as a template for creating new clients. The key components are:

1. Establish a WebSocket connection to the orchestrator's client port
2. Send messages with the correct format for listing agents, creating tasks, etc.
3. Process the responses from the orchestrator

See the [Agent Swarm Protocol documentation](https://github.com/your-repo/agentswarmprotocol) for more details on the message formats and API. 