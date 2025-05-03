import { v4 as uuidv4 } from 'uuid';
import { MCPClient } from './mcp-client';
import { MCPManager } from './mcp-manager';
import { EventEmitter } from 'events';

// Interfaces for MCP-related types
interface MCPServerConfig {
  id?: string;
  name: string;
  path?: string;
  type?: string;
  capabilities?: string[];
  command?: string;
  args?: string[];
  metadata?: Record<string, any>;
}

interface MCPServer {
  id: string;
  name: string;
  path?: string;
  type: string;
  status: string;
  capabilities: string[];
  connectionId?: string | null;
  command?: string;
  args?: string[];
  metadata: Record<string, any>;
}

interface MCPExecuteToolMessage {
  serverId: string;
  toolName: string;
  toolArgs: Record<string, any>;
}

interface MCPAgentRequest {
  action: string;
  mcpServerName?: string;
  serverId?: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  filters?: MCPServerFilters;
}

interface MCPServerFilters {
  type?: string;
  status?: string;
  capabilities?: string[];
}

/**
 * MCPAdapter - Adapter for integrating MCP servers with the orchestrator
 * Handles the translation between orchestrator requests and MCP protocol
 */
class MCPAdapter {
  private mcpManager: MCPManager;
  private eventBus: EventEmitter;
  private activeClients: Map<string, MCPClient>;
  
  constructor(eventBus: EventEmitter) {
    this.mcpManager = new MCPManager();
    this.eventBus = eventBus;
    this.activeClients = new Map();  // Map of serverIds to MCPClient instances
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for MCP-related events
   */
  private setupEventListeners(): void {
    // Listen for MCP server registration
    this.eventBus.on('mcp.server.register', async (message: MCPServerConfig, callback: Function) => {
      try {
        const result = await this.registerMCPServer(message);
        callback(result);
      } catch (error) {
        callback({ error: (error as Error).message });
      }
    });

    // Listen for MCP server connection
    this.eventBus.on('mcp.server.connect', async (message: { serverId: string }, callback: Function) => {
      try {
        const result = await this.connectToMCPServer(message.serverId);
        callback(result);
      } catch (error) {
        callback({ error: (error as Error).message });
      }
    });

    // Listen for MCP server disconnection
    this.eventBus.on('mcp.server.disconnect', async (message: { serverId: string }, callback: Function) => {
      try {
        const result = await this.disconnectMCPServer(message.serverId);
        callback(result);
      } catch (error) {
        callback({ error: (error as Error).message });
      }
    });

    // Listen for MCP tool execution requests
    this.eventBus.on('mcp.tool.execute', async (message: MCPExecuteToolMessage, callback: Function) => {
      try {
        const result = await this.executeMCPTool(
          message.serverId,
          message.toolName,
          message.toolArgs
        );
        callback(result);
      } catch (error) {
        callback({ error: (error as Error).message });
      }
    });

    // Listen for MCP server list requests
    this.eventBus.on('mcp.server.list', (message: { filters?: MCPServerFilters }, callback: Function) => {
      try {
        const result = this.listMCPServers(message.filters);
        callback(result);
      } catch (error) {
        callback({ error: (error as Error).message });
      }
    });

    // Listen for MCP tool list requests
    this.eventBus.on('mcp.tool.list', async (message: { serverId: string }, callback: Function) => {
      try {
        const result = await this.listMCPTools(message.serverId);
        callback(result);
      } catch (error) {
        callback({ error: (error as Error).message });
      }
    });
    
    // Listen for agent task requests that might involve MCP
    this.eventBus.on('agent.task.mcp', async (message: MCPAgentRequest, agentId: string, callback: Function) => {
      try {
        const result = await this.handleAgentMCPRequest(message, agentId);
        callback(result);
      } catch (error) {
        callback({ error: (error as Error).message });
      }
    });
    
    // Agent MCP Servers List Request
    this.eventBus.on('agent.mcp.servers.list', async (message: { filters?: MCPServerFilters }, callback: Function) => {
      try {
        const servers = this.listMCPServers(message.filters || {});
        callback({
          servers
        });
      } catch (error) {
        callback({ error: (error as Error).message });
      }
    });
    
    // Agent MCP Tools List Request
    this.eventBus.on('agent.mcp.tools.list', async (message: { serverId: string }, callback: Function) => {
      try {
        const tools = await this.listMCPTools(message.serverId);
        const serverInfo = this.mcpManager.getServerById(message.serverId);
        callback({
          serverId: message.serverId,
          serverName: serverInfo?.name || 'unknown',
          tools
        });
      } catch (error) {
        callback({ error: (error as Error).message });
      }
    });
    
    // Agent MCP Tool Execute Request
    this.eventBus.on('agent.mcp.tool.execute', async (message: { serverId: string, toolName: string, parameters: Record<string, any> }, callback: Function) => {
      try {
        const result = await this.executeMCPTool(
          message.serverId,
          message.toolName,
          message.parameters
        );
        callback({
          serverId: message.serverId,
          toolName: message.toolName,
          result,
          status: 'success'
        });
      } catch (error) {
        callback({
          serverId: message.serverId,
          toolName: message.toolName,
          status: 'error',
          error: (error as Error).message
        });
      }
    });
  }

  /**
   * Register a new MCP server
   * @param {MCPServerConfig} message - Server registration message
   * @returns {Object} Registration result
   */
  async registerMCPServer(message: MCPServerConfig): Promise<{ serverId: string, name: string, status: string }> {
    const { id, name, path, type, capabilities, command, args, metadata } = message;
    
    // For manually registered servers (from API)
    if (!id && (!name || !path)) {
      throw new Error('Server name and path are required for MCP server registration');
    }
    
    // For pre-configured servers (from config)
    if (id && (!name || (!path && !command))) {
      throw new Error('Server name and either path or command are required for MCP server registration');
    }
    
    const server = this.mcpManager.registerServer({
      id, // Allow predefined ID for servers from config
      name,
      path,
      type: type || 'node',
      capabilities: capabilities || [],
      command, // Add command for launching server
      args, // Add arguments for command
      metadata: metadata || {}
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
  async connectToMCPServer(serverId: string): Promise<{ serverId: string, status: string, tools: any[] }> {
    const server = this.mcpManager.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP Server not found: ${serverId}`);
    }
    
    // Check if we already have a client for this server
    if (this.activeClients.has(serverId)) {
      console.log(`Client already exists for server ${server.name}, reconnecting`);
      await this.activeClients.get(serverId)?.disconnect();
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
  async disconnectMCPServer(serverId: string): Promise<{ serverId: string, status: string }> {
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
   * @param {Record<string, any>} toolArgs - Arguments for the tool
   * @returns {Promise<any>} Tool execution result
   */
  async executeMCPTool(serverId: string, toolName: string, toolArgs: Record<string, any>): Promise<any> {
    const server = this.mcpManager.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP Server not found: ${serverId}`);
    }
    
    // Connect to the server if not already connected
    if (!this.activeClients.has(serverId)) {
      await this.connectToMCPServer(serverId);
    }
    
    const client = this.activeClients.get(serverId);
    if (!client) {
      throw new Error(`Client not found for server: ${serverId}`);
    }
    
    return await client.executeTool(toolName, toolArgs);
  }

  /**
   * Get a list of registered MCP servers
   * @param {MCPServerFilters} filters - Optional filters for servers
   * @returns {Array} Server list
   */
  listMCPServers(filters: MCPServerFilters = {}): MCPServer[] {
    let servers = this.mcpManager.getAllServers();
    
    // Apply filters
    if (filters.type) {
      servers = servers.filter((server: MCPServer) => server.type === filters.type);
    }
    if (filters.status) {
      servers = servers.filter((server: MCPServer) => server.status === filters.status);
    }
    if (filters.capabilities && filters.capabilities.length > 0) {
      servers = servers.filter((server: MCPServer) => {
        return filters.capabilities!.every(cap => server.capabilities.includes(cap));
      });
    }
    
    return servers.map((server: MCPServer) => ({
      id: server.id,
      name: server.name,
      type: server.type,
      status: server.status,
      capabilities: server.capabilities,
      metadata: server.metadata
    }));
  }

  /**
   * Get a list of tools available on an MCP server
   * @param {string} serverId - ID of the server
   * @returns {Promise<Array>} List of tools
   */
  async listMCPTools(serverId: string): Promise<any[]> {
    const server = this.mcpManager.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP Server not found: ${serverId}`);
    }
    
    // Connect to the server if not already connected
    if (!this.activeClients.has(serverId)) {
      await this.connectToMCPServer(serverId);
    }
    
    const client = this.activeClients.get(serverId);
    if (!client) {
      throw new Error(`Client not found for server: ${serverId}`);
    }
    
    return client.getTools();
  }

  /**
   * Handle MCP requests from agents
   * @param {MCPAgentRequest} message - MCP request message
   * @param {string} agentId - Requesting agent ID
   * @returns {Promise<Object>} MCP operation result
   */
  async handleAgentMCPRequest(message: MCPAgentRequest, agentId: string): Promise<any> {
    const { action, mcpServerName, serverId, toolName, toolArgs } = message;
    
    if (!action) {
      throw new Error('MCP action is required');
    }
    
    switch (action) {
      case 'list-servers':
        return {
          servers: this.listMCPServers(message.filters || {})
        };
        
      case 'list-tools': {
        const serverIdForTools = serverId || (mcpServerName ? this.mcpManager.getServerIdByName(mcpServerName) : undefined);
        if (!serverIdForTools) {
          throw new Error('Server ID or name is required to list tools');
        }
        return {
          serverId: serverIdForTools,
          tools: await this.listMCPTools(serverIdForTools)
        };
      }
        
      case 'execute-tool': {
        const serverIdForExecution = serverId || (mcpServerName ? this.mcpManager.getServerIdByName(mcpServerName) : undefined);
        if (!serverIdForExecution) {
          throw new Error('Server ID or name is required to execute a tool');
        }
        if (!toolName) {
          throw new Error('Tool name is required');
        }
        
        return {
          serverId: serverIdForExecution,
          toolName,
          result: await this.executeMCPTool(serverIdForExecution, toolName, toolArgs || {})
        };
      }
        
      default:
        throw new Error(`Unknown MCP action: ${action}`);
    }
  }
}

export { MCPAdapter, MCPServerConfig, MCPServer, MCPServerFilters }; 