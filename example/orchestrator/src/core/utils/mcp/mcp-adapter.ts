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
  toolArgs?: Record<string, any>;
  parameters?: Record<string, any>;
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
    this.eventBus.on('mcp.server.register', this.handleServerRegister.bind(this));

    // Listen for MCP server connection
    this.eventBus.on('mcp.server.connect', this.handleServerConnect.bind(this));

    // Listen for MCP server disconnection
    this.eventBus.on('mcp.server.disconnect', this.handleServerDisconnect.bind(this));

    // Listen for MCP tool execution requests
    this.eventBus.on('mcp.tool.execute', this.handleToolExecute.bind(this));

    // Listen for MCP server list requests
    this.eventBus.on('mcp.server.list', this.handleServerList.bind(this));
    
    // Also listen for SDK-style 'mcp.servers.list' for compatibility
    this.eventBus.on('mcp.servers.list', this.handleServerList.bind(this));

    // Listen for MCP tool list requests
    this.eventBus.on('mcp.tool.list', this.handleToolList.bind(this));
    
    // Also listen for SDK-style 'mcp.tools.list' for compatibility
    this.eventBus.on('mcp.tools.list', this.handleToolList.bind(this));
    
    // Listen for agent task requests that might involve MCP
    this.eventBus.on('agent.task.mcp', this.handleAgentTaskMcp.bind(this));
    
    // Agent MCP Servers List Request
    this.eventBus.on('agent.mcp.servers.list', this.handleAgentMcpServersList.bind(this));
    
    // Agent MCP Tools List Request
    this.eventBus.on('agent.mcp.tools.list', this.handleAgentMcpToolsList.bind(this));
    
    // Agent MCP Tool Execute Request
    this.eventBus.on('agent.mcp.tool.execute', this.handleAgentMcpToolExecute.bind(this));
  }

  /**
   * Handle MCP server registration event
   */
  private async handleServerRegister(message: MCPServerConfig, requestId?: string): Promise<void> {
    try {
      const result = await this.registerMCPServer(message);
      this.eventBus.emit('mcp.server.register.result', result, requestId);
    } catch (error) {
      this.eventBus.emit('mcp.server.register.error', { error: (error as Error).message }, requestId);
    }
  }

  /**
   * Handle MCP server connection event
   */
  private async handleServerConnect(message: { serverId: string }, requestId?: string): Promise<void> {
    try {
      const result = await this.connectToMCPServer(message.serverId);
      this.eventBus.emit('mcp.server.connect.result', result, requestId);
    } catch (error) {
      this.eventBus.emit('mcp.server.connect.error', { error: (error as Error).message }, requestId);
    }
  }

  /**
   * Handle MCP server disconnection event
   */
  private async handleServerDisconnect(message: { serverId: string }, requestId?: string): Promise<void> {
    try {
      const result = await this.disconnectMCPServer(message.serverId);
      this.eventBus.emit('mcp.server.disconnect.result', result, requestId);
    } catch (error) {
      this.eventBus.emit('mcp.server.disconnect.error', { error: (error as Error).message }, requestId);
    }
  }

  /**
   * Handle MCP tool execution event
   */
  private async handleToolExecute(message: MCPExecuteToolMessage, requestId?: string): Promise<void> {
    try {
      const result = await this.executeMCPTool(
        message.serverId,
        message.toolName,
        message.toolArgs || message.parameters || {}
      );
      this.eventBus.emit('mcp.tool.execute.result', {
        serverId: message.serverId,
        toolName: message.toolName,
        result,
        status: 'success'
      }, requestId);
    } catch (error) {
      this.eventBus.emit('mcp.tool.execute.error', {
        serverId: message.serverId,
        toolName: message.toolName,
        status: 'error',
        error: (error as Error).message
      }, requestId);
    }
  }

  /**
   * Handle MCP server list event
   */
  private handleServerList(message: { filters?: MCPServerFilters }, requestId?: string): void {
    try {
      const result = this.listMCPServers(message.filters);
      this.eventBus.emit('mcp.server.list.result', { servers: result }, requestId);
    } catch (error) {
      this.eventBus.emit('mcp.server.list.error', { error: (error as Error).message }, requestId);
    }
  }

  /**
   * Handle MCP tool list event
   */
  private async handleToolList(message: { serverId: string }, requestId?: string): Promise<void> {
    try {
      const result = await this.listMCPTools(message.serverId);
      this.eventBus.emit('mcp.tool.list.result', {
        serverId: message.serverId,
        tools: result
      }, requestId);
    } catch (error) {
      this.eventBus.emit('mcp.tool.list.error', { error: (error as Error).message }, requestId);
    }
  }

  /**
   * Handle agent task MCP event
   */
  private async handleAgentTaskMcp(message: MCPAgentRequest, agentId: string, requestId?: string): Promise<void> {
    try {
      const result = await this.handleAgentMCPRequest(message, agentId);
      this.eventBus.emit('agent.task.mcp.result', result, requestId);
    } catch (error) {
      this.eventBus.emit('agent.task.mcp.error', { error: (error as Error).message }, requestId);
    }
  }

  /**
   * Handle agent MCP servers list event
   */
  private handleAgentMcpServersList(message: { filters?: MCPServerFilters }, requestId?: string): void {
    try {
      const servers = this.listMCPServers(message.filters || {});
      this.eventBus.emit('agent.mcp.servers.list.result', {
        servers
      }, requestId);
    } catch (error) {
      this.eventBus.emit('agent.mcp.servers.list.error', { error: (error as Error).message }, requestId);
    }
  }

  /**
   * Handle agent MCP tools list event
   */
  private async handleAgentMcpToolsList(message: { serverId: string }, requestId?: string): Promise<void> {
    try {
      const tools = await this.listMCPTools(message.serverId);
      const serverInfo = this.mcpManager.getServerById(message.serverId);
      this.eventBus.emit('agent.mcp.tools.list.result', {
        serverId: message.serverId,
        serverName: serverInfo?.name || 'unknown',
        tools
      }, requestId);
    } catch (error) {
      this.eventBus.emit('agent.mcp.tools.list.error', { error: (error as Error).message }, requestId);
    }
  }

  /**
   * Handle agent MCP tool execute event
   */
  private async handleAgentMcpToolExecute(message: { serverId: string, toolName: string, parameters: Record<string, any> }, requestId?: string): Promise<void> {
    try {
      const result = await this.executeMCPTool(
        message.serverId,
        message.toolName,
        message.parameters
      );
      this.eventBus.emit('agent.mcp.tool.execute.result', {
        serverId: message.serverId,
        toolName: message.toolName,
        result,
        status: 'success'
      }, requestId);
    } catch (error) {
      this.eventBus.emit('agent.mcp.tool.execute.error', {
        serverId: message.serverId,
        toolName: message.toolName,
        status: 'error',
        error: (error as Error).message
      }, requestId);
    }
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