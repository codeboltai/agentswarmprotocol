"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPAdapter = void 0;
const mcp_client_1 = require("./mcp-client");
const mcp_manager_1 = require("./mcp-manager");
/**
 * MCPAdapter - Adapter for integrating MCP servers with the orchestrator
 * Handles the translation between orchestrator requests and MCP protocol
 */
class MCPAdapter {
    constructor(eventBus) {
        this.mcpManager = new mcp_manager_1.MCPManager();
        this.eventBus = eventBus;
        this.activeClients = new Map(); // Map of serverIds to MCPClient instances
        this.setupEventListeners();
    }
    /**
     * Set up event listeners for MCP-related events
     */
    setupEventListeners() {
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
    async handleServerRegister(message, requestId) {
        try {
            const result = await this.registerMCPServer(message);
            this.eventBus.emit('mcp.server.register.result', result, requestId);
        }
        catch (error) {
            this.eventBus.emit('mcp.server.register.error', { error: error.message }, requestId);
        }
    }
    /**
     * Handle MCP server connection event
     */
    async handleServerConnect(message, requestId) {
        try {
            const result = await this.connectToMCPServer(message.serverId);
            this.eventBus.emit('mcp.server.connect.result', result, requestId);
        }
        catch (error) {
            this.eventBus.emit('mcp.server.connect.error', { error: error.message }, requestId);
        }
    }
    /**
     * Handle MCP server disconnection event
     */
    async handleServerDisconnect(message, requestId) {
        try {
            const result = await this.disconnectMCPServer(message.serverId);
            this.eventBus.emit('mcp.server.disconnect.result', result, requestId);
        }
        catch (error) {
            this.eventBus.emit('mcp.server.disconnect.error', { error: error.message }, requestId);
        }
    }
    /**
     * Handle MCP tool execution event
     */
    async handleToolExecute(message, requestId) {
        try {
            const result = await this.executeMCPTool(message.serverId, message.toolName, message.toolArgs || message.parameters || {});
            this.eventBus.emit('mcp.tool.execute.result', {
                serverId: message.serverId,
                toolName: message.toolName,
                result,
                status: 'success'
            }, requestId);
        }
        catch (error) {
            this.eventBus.emit('mcp.tool.execute.error', {
                serverId: message.serverId,
                toolName: message.toolName,
                status: 'error',
                error: error.message
            }, requestId);
        }
    }
    /**
     * Handle MCP server list event
     */
    handleServerList(message, requestId) {
        try {
            const result = this.listMCPServers(message.filters);
            this.eventBus.emit('mcp.server.list.result', { servers: result }, requestId);
        }
        catch (error) {
            this.eventBus.emit('mcp.server.list.error', { error: error.message }, requestId);
        }
    }
    /**
     * Handle MCP tool list event
     */
    async handleToolList(message, requestId) {
        try {
            const result = await this.listMCPTools(message.serverId);
            this.eventBus.emit('mcp.tool.list.result', {
                serverId: message.serverId,
                tools: result
            }, requestId);
        }
        catch (error) {
            this.eventBus.emit('mcp.tool.list.error', { error: error.message }, requestId);
        }
    }
    /**
     * Handle agent task MCP event
     */
    async handleAgentTaskMcp(message, agentId, requestId) {
        try {
            const result = await this.handleAgentMCPRequest(message, agentId);
            this.eventBus.emit('agent.task.mcp.result', result, requestId);
        }
        catch (error) {
            this.eventBus.emit('agent.task.mcp.error', { error: error.message }, requestId);
        }
    }
    /**
     * Handle agent MCP servers list event
     */
    handleAgentMcpServersList(message, requestId) {
        try {
            const servers = this.listMCPServers(message.filters || {});
            this.eventBus.emit('agent.mcp.servers.list.result', {
                servers
            }, requestId);
        }
        catch (error) {
            this.eventBus.emit('agent.mcp.servers.list.error', { error: error.message }, requestId);
        }
    }
    /**
     * Handle agent MCP tools list event
     */
    async handleAgentMcpToolsList(message, requestId) {
        try {
            const tools = await this.listMCPTools(message.serverId);
            const serverInfo = this.mcpManager.getServerById(message.serverId);
            this.eventBus.emit('agent.mcp.tools.list.result', {
                serverId: message.serverId,
                serverName: serverInfo?.name || 'unknown',
                tools
            }, requestId);
        }
        catch (error) {
            this.eventBus.emit('agent.mcp.tools.list.error', { error: error.message }, requestId);
        }
    }
    /**
     * Handle agent MCP tool execute event
     */
    async handleAgentMcpToolExecute(message, requestId) {
        try {
            const result = await this.executeMCPTool(message.serverId, message.toolName, message.parameters);
            this.eventBus.emit('agent.mcp.tool.execute.result', {
                serverId: message.serverId,
                toolName: message.toolName,
                result,
                status: 'success'
            }, requestId);
        }
        catch (error) {
            this.eventBus.emit('agent.mcp.tool.execute.error', {
                serverId: message.serverId,
                toolName: message.toolName,
                status: 'error',
                error: error.message
            }, requestId);
        }
    }
    /**
     * Register a new MCP server
     * @param {MCPServerConfig} message - Server registration message
     * @returns {Object} Registration result
     */
    async registerMCPServer(message) {
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
    async connectToMCPServer(serverId) {
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
        const client = new mcp_client_1.MCPClient({
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
     * @param {Record<string, any>} toolArgs - Arguments for the tool
     * @returns {Promise<any>} Tool execution result
     */
    async executeMCPTool(serverId, toolName, toolArgs) {
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
    listMCPServers(filters = {}) {
        let servers = this.mcpManager.getAllServers();
        // Apply filters
        if (filters.type) {
            servers = servers.filter((server) => server.type === filters.type);
        }
        if (filters.status) {
            servers = servers.filter((server) => server.status === filters.status);
        }
        if (filters.capabilities && filters.capabilities.length > 0) {
            servers = servers.filter((server) => {
                return filters.capabilities.every(cap => server.capabilities.includes(cap));
            });
        }
        return servers.map((server) => ({
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
    async listMCPTools(serverId) {
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
    async handleAgentMCPRequest(message, agentId) {
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
exports.MCPAdapter = MCPAdapter;
