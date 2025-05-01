const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const EventEmitter = require('events');

/**
 * MCPManager - Manages MCP servers and client interactions
 * Provides functionality to register, connect to, and execute tasks on MCP servers
 */
class MCPManager {
  constructor() {
    this.servers = new Map(); // Map of server ID to server objects
    this.activeConnections = new Map(); // Map of connection ID to active server connections
    this.events = new EventEmitter();
  }

  /**
   * Register a new MCP server
   * @param {Object} serverConfig - Server configuration
   * @param {string} [serverConfig.id] - Optional ID for the server (for pre-configured servers)
   * @param {string} serverConfig.name - Name of the server
   * @param {string} [serverConfig.path] - Path to the server script (optional if command is provided)
   * @param {string} [serverConfig.command] - Command to run the server (optional if path is provided)
   * @param {Array} [serverConfig.args] - Arguments for the command
   * @param {string} serverConfig.type - Script type (python, node, etc.)
   * @param {Array} serverConfig.capabilities - Server capabilities/tools
   * @param {Object} serverConfig.metadata - Additional metadata for the server
   * @returns {Object} Registered server object
   */
  registerServer(serverConfig) {
    const { 
      id,
      name, 
      path: serverPath, 
      command,
      args = [],
      type = 'node', 
      capabilities = [],
      metadata = {}
    } = serverConfig;
    
    // Either path or command must be provided
    if (!name || (!serverPath && !command)) {
      throw new Error('Server name and either path or command are required for MCP server registration');
    }
    
    // Use provided ID or generate a new one
    const serverId = id || uuidv4();
    
    // If server with this ID already exists, update it
    if (this.servers.has(serverId)) {
      console.log(`Updating existing MCP server: ${name} (${serverId})`);
      const existingServer = this.servers.get(serverId);
      
      // Merge with existing server
      const updatedServer = {
        ...existingServer,
        name,
        path: serverPath || existingServer.path,
        command: command || existingServer.command,
        args: args || existingServer.args,
        type: type || existingServer.type,
        capabilities: capabilities || existingServer.capabilities,
        metadata: { ...existingServer.metadata, ...metadata },
        updatedAt: new Date().toISOString()
      };
      
      this.servers.set(serverId, updatedServer);
      return updatedServer;
    }
    
    // Create new server
    const server = {
      id: serverId,
      name,
      path: serverPath,
      command,
      args,
      type,
      capabilities,
      metadata,
      status: 'registered',
      registeredAt: new Date().toISOString()
    };
    
    this.servers.set(serverId, server);
    console.log(`MCP Server registered: ${name} (${serverId})`);
    
    return server;
  }

  /**
   * Connect to an MCP server
   * @param {string} serverId - ID of the registered server
   * @returns {Promise<Object>} Connection information
   */
  async connectToServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`MCP Server not found: ${serverId}`);
    }
    
    // Close existing connection if any
    if (server.connectionId && this.activeConnections.has(server.connectionId)) {
      await this.disconnectServer(serverId);
    }
    
    try {
      console.log(`Connecting to MCP server: ${server.name}`);
      
      // Determine command based on server configuration
      let command;
      let args;
      
      if (server.command) {
        // If command is explicitly provided in configuration, use it
        command = server.command;
        args = server.args || [];
      } else {
        // Otherwise, determine command based on server type and path
        switch (server.type.toLowerCase()) {
          case 'python':
            command = 'python';
            args = [server.path];
            break;
          case 'node':
            command = 'node';
            args = [server.path];
            break;
          default:
            throw new Error(`Unsupported server type: ${server.type}`);
        }
      }
      
      console.log(`Launching MCP server with command: ${command} ${args.join(' ')}`);
      
      // Spawn the server process
      const serverProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: server.path ? path.dirname(server.path) : process.cwd()
      });
      
      const connectionId = uuidv4();
      
      // Create a connection object
      const connection = {
        id: connectionId,
        serverId,
        process: serverProcess,
        tools: [],
        status: 'connecting'
      };
      
      // Set up process event handlers
      serverProcess.on('error', (error) => {
        console.error(`MCP Server process error (${server.name}):`, error);
        connection.status = 'error';
        this.events.emit('server.error', serverId, error);
      });
      
      serverProcess.on('exit', (code, signal) => {
        console.log(`MCP Server process exited (${server.name}): code=${code}, signal=${signal}`);
        connection.status = 'disconnected';
        this.activeConnections.delete(connectionId);
        server.connectionId = null;
        server.status = 'registered';
        this.events.emit('server.disconnected', serverId);
      });
      
      // Handle stdout/stderr
      serverProcess.stdout.on('data', (data) => {
        console.log(`MCP Server stdout (${server.name}): ${data.toString()}`);
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.error(`MCP Server stderr (${server.name}): ${data.toString()}`);
      });
      
      // Set up stdio for MCP communication
      // This is where the actual MCP protocol implementation would go
      
      // Update connection and server status
      connection.status = 'connected';
      this.activeConnections.set(connectionId, connection);
      
      server.connectionId = connectionId;
      server.status = 'online';
      
      // Fetch available tools from the server
      const tools = await this.listServerTools(connectionId);
      connection.tools = tools;
      
      this.events.emit('server.connected', serverId, tools);
      
      return { connectionId, tools };
    } catch (error) {
      console.error(`Failed to connect to MCP server ${server.name}:`, error);
      server.status = 'error';
      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   * @param {string} serverId - ID of the server to disconnect
   */
  async disconnectServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`MCP Server not found: ${serverId}`);
    }
    
    if (!server.connectionId) {
      console.log(`Server ${server.name} is not connected`);
      return;
    }
    
    const connection = this.activeConnections.get(server.connectionId);
    if (connection) {
      try {
        console.log(`Disconnecting from MCP server: ${server.name}`);
        connection.process.kill();
        this.activeConnections.delete(server.connectionId);
      } catch (error) {
        console.error(`Error disconnecting from MCP server ${server.name}:`, error);
      }
    }
    
    server.connectionId = null;
    server.status = 'registered';
    this.events.emit('server.disconnected', serverId);
  }

  /**
   * List available tools from an MCP server
   * @param {string} connectionId - ID of the connection
   * @returns {Promise<Array>} Array of available tools
   */
  async listServerTools(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      throw new Error(`MCP Connection not found: ${connectionId}`);
    }
    
    // This is where the actual MCP protocol call to list tools would go
    // For now, we'll return a placeholder
    
    return [
      {
        name: 'placeholder_tool',
        description: 'Placeholder tool for MCP integration',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }
    ];
  }

  /**
   * Execute a tool call on an MCP server
   * @param {string} connectionId - ID of the connection
   * @param {string} toolName - Name of the tool to call
   * @param {Object} toolArgs - Arguments for the tool
   * @returns {Promise<Object>} Tool execution result
   */
  async executeToolCall(connectionId, toolName, toolArgs) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      throw new Error(`MCP Connection not found: ${connectionId}`);
    }
    
    try {
      console.log(`Executing MCP tool call: ${toolName}`);
      console.log(`Tool arguments:`, JSON.stringify(toolArgs, null, 2));
      
      // This is where the actual MCP protocol tool call would go
      // For now, we'll return a placeholder response
      
      return {
        result: `Placeholder result for tool ${toolName}`,
        metadata: {
          timestamp: new Date().toISOString(),
          connectionId
        }
      };
    } catch (error) {
      console.error(`MCP tool execution error (${toolName}):`, error);
      throw new Error(`Failed to execute MCP tool ${toolName}: ${error.message}`);
    }
  }

  /**
   * Get a list of all registered servers
   * @param {Object} filters - Optional filters
   * @returns {Array} Array of server objects
   */
  getServers(filters = {}) {
    const servers = Array.from(this.servers.values());
    
    // Apply filters if any
    if (Object.keys(filters).length > 0) {
      return servers.filter(server => {
        for (const [key, value] of Object.entries(filters)) {
          if (server[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    return servers;
  }

  /**
   * Get a specific server by ID
   * @param {string} serverId - ID of the server
   * @returns {Object} Server object
   */
  getServerById(serverId) {
    return this.servers.get(serverId);
  }

  /**
   * Get a server by name
   * @param {string} name - Name of the server
   * @returns {Object} Server object
   */
  getServerByName(name) {
    return Array.from(this.servers.values()).find(
      server => server.name.toLowerCase() === name.toLowerCase()
    );
  }
}

module.exports = { MCPManager }; 