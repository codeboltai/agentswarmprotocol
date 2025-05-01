const { v4: uuidv4 } = require('uuid');
const { MCPClient } = require('./mcp-client');
const { MCPManager } = require('./mcp-manager');

/**
 * MCPAdapter - Adapter for integrating MCP servers with the orchestrator
 * Handles the translation between orchestrator requests and MCP protocol
 */
class MCPAdapter {
  constructor(eventBus) {
    this.mcpManager = new MCPManager();
    this.eventBus = eventBus;
    this.activeClients = new Map();  // Map of serverIds to MCPClient instances
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for MCP-related events
   */
  setupEventListeners() {
    // Listen for MCP server registration
    this.eventBus.on('mcp.server.register', async (message, callback) => {
      try {
        const result = await this.registerMCPServer(message);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });

    // Listen for MCP server connection
    this.eventBus.on('mcp.server.connect', async (message, callback) => {
      try {
        const result = await this.connectToMCPServer(message.serverId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });

    // Listen for MCP server disconnection
    this.eventBus.on('mcp.server.disconnect', async (message, callback) => {
      try {
        const result = await this.disconnectMCPServer(message.serverId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });

    // Listen for MCP tool execution requests
    this.eventBus.on('mcp.tool.execute', async (message, callback) => {
      try {
        const result = await this.executeMCPTool(
          message.serverId,
          message.toolName,
          message.toolArgs
        );
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });

    // Listen for MCP server list requests
    this.eventBus.on('mcp.server.list', (message, callback) => {
      try {
        const result = this.listMCPServers(message.filters);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });

    // Listen for MCP tool list requests
    this.eventBus.on('mcp.tool.list', async (message, callback) => {
      try {
        const result = await this.listMCPTools(message.serverId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Listen for agent task requests that might involve MCP
    this.eventBus.on('agent.task.mcp', async (message, agentId, callback) => {
      try {
        const result = await this.handleAgentMCPRequest(message, agentId);
        callback(result);
      } catch (error) {
        callback({ error: error.message });
      }
    });
  }

  /**
   * Register a new MCP server
   * @param {Object} message - Server registration message
   * @returns {Object} Registration result
   */
  async registerMCPServer(message) {
    const { name, path, type, capabilities } = message;
    
    if (!name || !path) {
      throw new Error('Server name and path are required for MCP server registration');
    }
    
    const server = this.mcpManager.registerServer({
      name,
      path,
      type: type || 'node',
      capabilities: capabilities || []
    });
    
    return {
      serverId: server.id,
      name: server.name,
      status: server.status
    };
  }

  /**
   * Connect to an MCP server and create a client
   * @param {string} serverId - ID of the server to connect to
   * @returns {Object} Connection result with tools
   */
  async connectToMCPServer(serverId) {
    const server = this.mcpManager.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP Server not found: ${serverId}`);
    }
    
    // Check if we already have a client for this server
    if (this.activeClients.has(serverId)) {
      console.log(`Client already exists for server ${server.name}, reconnecting`);
      await this.activeClients.get(serverId).disconnect();
      this.activeClients.delete(serverId);
    }
    
    // Create and connect a new client
    const client = new MCPClient({
      name: server.name,
      path: server.path,
      type: server.type
    });
    
    const tools = await client.connect();
    
    // Store the client
    this.activeClients.set(serverId, client);
    
    // Update server status
    server.status = 'online';
    server.connectionId = client.connectionId;
    
    return {
      serverId,
      status: 'connected',
      tools
    };
  }

  /**
   * Disconnect from an MCP server
   * @param {string} serverId - ID of the server to disconnect from
   * @returns {Object} Disconnection result
   */
  async disconnectMCPServer(serverId) {
    const server = this.mcpManager.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP Server not found: ${serverId}`);
    }
    
    const client = this.activeClients.get(serverId);
    if (client) {
      await client.disconnect();
      this.activeClients.delete(serverId);
    }
    
    server.status = 'registered';
    server.connectionId = null;
    
    return {
      serverId,
      status: 'disconnected'
    };
  }

  /**
   * Execute a tool on an MCP server
   * @param {string} serverId - ID of the server
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} toolArgs - Arguments for the tool
   * @returns {Object} Tool execution result
   */
  async executeMCPTool(serverId, toolName, toolArgs) {
    const client = this.activeClients.get(serverId);
    if (!client) {
      throw new Error(`No active connection to MCP Server: ${serverId}`);
    }
    
    const result = await client.callTool(toolName, toolArgs);
    
    return {
      serverId,
      toolName,
      result: result.result,
      metadata: result.metadata
    };
  }

  /**
   * List all registered MCP servers
   * @param {Object} filters - Optional filters
   * @returns {Array} Array of server objects
   */
  listMCPServers(filters = {}) {
    const servers = this.mcpManager.getServers(filters);
    
    return servers.map(server => ({
      id: server.id,
      name: server.name,
      type: server.type,
      status: server.status,
      capabilities: server.capabilities
    }));
  }

  /**
   * List tools available on an MCP server
   * @param {string} serverId - ID of the server
   * @returns {Array} Array of tool objects
   */
  async listMCPTools(serverId) {
    const client = this.activeClients.get(serverId);
    if (!client) {
      throw new Error(`No active connection to MCP Server: ${serverId}`);
    }
    
    return client.tools || [];
  }

  /**
   * Handle an MCP request from an agent
   * @param {Object} message - The agent's request message
   * @param {string} agentId - ID of the requesting agent
   * @returns {Object} Response to the agent
   */
  async handleAgentMCPRequest(message, agentId) {
    const { mcpServerName, toolName, toolArgs } = message.content;
    
    if (!mcpServerName) {
      throw new Error('MCP server name is required');
    }
    
    if (!toolName) {
      throw new Error('Tool name is required');
    }
    
    // Find the server by name
    const server = this.mcpManager.getServerByName(mcpServerName);
    if (!server) {
      throw new Error(`MCP Server not found: ${mcpServerName}`);
    }
    
    // Check if the server is connected, connect if needed
    let client = this.activeClients.get(server.id);
    if (!client) {
      console.log(`Automatically connecting to MCP server ${mcpServerName}`);
      await this.connectToMCPServer(server.id);
      client = this.activeClients.get(server.id);
    }
    
    // Validate that the tool exists
    const toolExists = client.tools.some(tool => tool.name === toolName);
    if (!toolExists) {
      throw new Error(`Tool not found on MCP server ${mcpServerName}: ${toolName}`);
    }
    
    // Execute the tool
    const result = await client.callTool(toolName, toolArgs);
    
    return {
      mcpServerName,
      toolName,
      result: result.result,
      metadata: {
        ...result.metadata,
        serverId: server.id,
        agentId
      }
    };
  }
}

module.exports = { MCPAdapter }; 