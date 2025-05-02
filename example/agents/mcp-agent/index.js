/**
 * MCP Agent - Demonstrates MCP functionality in Agent Swarm Protocol
 */

const SwarmAgentSDK = require('../../sdk/agentsdk');
const { v4: uuidv4 } = require('uuid');

// Initialize the agent with configuration
const agent = new SwarmAgentSDK({
  name: process.env.AGENT_NAME || 'MCP Agent',
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000',
  autoReconnect: true,
  capabilities: ['mcp-integration'],
  description: 'Agent that demonstrates MCP functionality',
});

// Register event handlers
agent.on('connected', () => {
  console.log('MCP agent connected to orchestrator');
});

agent.on('registered', (data) => {
  console.log(`MCP agent registered with ID: ${agent.agentId}`);
  console.log(`Registration details: ${JSON.stringify(data)}`);
});

// Handle errors
agent.on('error', (error) => {
  console.error('Agent error:', error.message);
});

// Listen for MCP specific events
agent.on('mcp-servers-list', (content) => {
  console.log(`Received MCP servers list: ${JSON.stringify(content.servers)}`);
});

agent.on('mcp-tools-list', (content) => {
  console.log(`Received MCP tools list for server ${content.serverId}: ${JSON.stringify(content.tools)}`);
});

agent.on('mcp-tool-execution-result', (content) => {
  console.log(`Received MCP tool execution result for ${content.toolName} on server ${content.serverId}: ${JSON.stringify(content.result)}`);
});

// Handle list servers task
agent.onMessage('mcp:list-servers', async (taskData, metadata) => {
  console.log(`Handling mcp:list-servers task`);
  
  try {
    const servers = await agent.getMCPServers(taskData.filters || {});
    return {
      operation: 'list-servers',
      servers,
      count: servers.length
    };
  } catch (error) {
    console.error(`Error listing MCP servers: ${error.message}`);
    return {
      error: error.message
    };
  }
});

// Handle list tools task
agent.onMessage('mcp:list-tools', async (taskData, metadata) => {
  console.log(`Handling mcp:list-tools task`);
  
  const { serverId } = taskData;
  
  if (!serverId) {
    return {
      error: 'Server ID is required to list tools'
    };
  }
  
  try {
    const tools = await agent.getMCPTools(serverId);
    return {
      operation: 'list-tools',
      serverId,
      tools,
      count: tools.length
    };
  } catch (error) {
    console.error(`Error listing MCP tools: ${error.message}`);
    return {
      error: error.message
    };
  }
});

// Handle execute tool task
agent.onMessage('mcp:execute-tool', async (taskData, metadata) => {
  console.log(`Handling mcp:execute-tool task`);
  
  const { serverId, toolName, parameters } = taskData;
  
  if (!serverId) {
    return {
      error: 'Server ID is required to execute a tool'
    };
  }
  
  if (!toolName) {
    return {
      error: 'Tool name is required to execute a tool'
    };
  }
  
  try {
    const result = await agent.executeMCPTool(serverId, toolName, parameters || {});
    return {
      operation: 'execute-tool',
      serverId,
      toolName,
      result
    };
  } catch (error) {
    console.error(`Error executing MCP tool: ${error.message}`);
    return {
      error: error.message
    };
  }
});

// Handle simple tool execution by name (no server ID needed)
agent.onMessage('mcp:tool', async (taskData, metadata) => {
  console.log(`Handling mcp:tool task`);
  
  const { toolName, parameters } = taskData;
  
  if (!toolName) {
    return {
      error: 'Tool name is required'
    };
  }
  
  try {
    // This method will find the appropriate server automatically
    const result = await agent.executeTool(toolName, parameters || {});
    return {
      operation: 'execute-tool',
      toolName,
      result
    };
  } catch (error) {
    console.error(`Error executing tool ${toolName}: ${error.message}`);
    return {
      error: error.message
    };
  }
});

// Connect to the orchestrator and start the agent
(async () => {
  try {
    await agent.connect();
    console.log('MCP agent is running...');
    
    // Demo: List available MCP servers
    try {
      const servers = await agent.getMCPServers();
      console.log(`Available MCP servers (${servers.length}):`);
      servers.forEach(server => {
        console.log(`- ${server.name} (${server.id}): ${server.status}`);
      });
      
      // If there's at least one server, list its tools
      if (servers.length > 0) {
        const firstServer = servers[0];
        
        try {
          const tools = await agent.getMCPTools(firstServer.id);
          console.log(`Tools available on server ${firstServer.name} (${tools.length}):`);
          tools.forEach(tool => {
            console.log(`- ${tool.name}: ${tool.description || 'No description'}`);
          });
        } catch (error) {
          console.warn(`Could not list tools for server ${firstServer.name}: ${error.message}`);
        }
      }
    } catch (error) {
      console.warn('Could not list MCP servers:', error.message);
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('Shutting down MCP agent...');
      agent.disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start agent:', error);
    process.exit(1);
  }
})(); 