# Agent Swarm Protocol Configuration

This directory contains configuration files for the Agent Swarm Protocol orchestrator.

## Orchestrator Configuration

The main configuration file `orchestrator-config.json` defines:

1. **MCP Servers** - Pre-configured Model Context Protocol servers
2. **Agents** - Predefined agent configurations
3. **Orchestrator Settings** - Core orchestrator settings

### MCP Servers Configuration

MCP servers can be predefined using the following format:

```json
"mcpServers": {
  "weather": {
    "name": "Weather MCP Server",
    "command": "uv",
    "args": [
      "--directory",
      "C:\\PATH\\TO\\PARENT\\FOLDER\\weather",
      "run",
      "weather.py"
    ],
    "metadata": {
      "description": "Provides weather information",
      "version": "1.0.0"
    }
  }
}
```

Each MCP server entry supports:

- `name`: Display name for the MCP server
- `command`: The command to run the server (e.g., `python`, `node`, `uv`)
- `args`: Array of command-line arguments
- `metadata`: Additional metadata about the server

You can configure MCP servers using two approaches:
1. Direct command execution (as shown above)
2. Script path specification:

```json
"search": {
  "name": "Search MCP Server",
  "path": "./mcp-servers/search-server.js",
  "type": "node",
  "metadata": {
    "description": "Web search capabilities"
  }
}
```

### Agents Configuration

Predefined agent configurations help the orchestrator recognize and work with agents when they connect:

```json
"agents": {
  "research-agent": {
    "name": "Research Agent",
    "capabilities": ["research", "summarization", "web-search"],
    "metadata": {
      "description": "Conducts research and provides summaries",
      "model": "gpt-4"
    }
  }
}
```

Each agent entry supports:

- `name`: Display name for the agent
- `capabilities`: Array of capabilities the agent provides
- `metadata`: Additional metadata about the agent

### Orchestrator Settings

Core orchestrator settings:

```json
"orchestrator": {
  "agentPort": 3000,
  "clientPort": 3001,
  "logLevel": "info",
  "taskTimeout": 300000
}
```

Available settings:

- `agentPort`: Port for agent connections
- `clientPort`: Port for client connections 
- `logLevel`: Logging level (debug, info, warn, error)
- `taskTimeout`: Default timeout for tasks in milliseconds

## Using Custom Configuration Files

You can specify a custom configuration file path when starting the orchestrator:

```bash
node orchestrator/index.js --config ./configs/my-custom-config.json
```

You can also override specific configuration values via command-line arguments:

```bash
node orchestrator/index.js --agentPort 4000 --clientPort 4001
``` 