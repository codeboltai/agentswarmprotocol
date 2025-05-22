"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPAdapter = void 0;
const uuid_1 = require("uuid");
const mcp_client_1 = require("./mcp-client");
const mcp_manager_1 = require("./mcp-manager");
/**
 * MCPAdapter - Adapter for integrating MCP servers with the orchestrator
 * Handles the translation between orchestrator requests and MCP protocol
 * Implements MCPInterface for MessageHandler
 */
class MCPAdapter {
    constructor(eventBus) {
        this.mcpManager = new mcp_manager_1.MCPManager();
        this.eventBus = eventBus;
        this.activeClients = new Map(); // Map of serverIds to MCPClient instances
    }
    /**
     * Register a new MCP server
     * Implementation of MCPInterface.registerServer
     * @param {any} server - Server to register
     */
    registerServer(server) {
        this.mcpManager.registerServer({
            id: server.id || (0, uuid_1.v4)(),
            name: server.name,
            path: server.path,
            type: server.type || 'node',
            capabilities: server.capabilities || [],
            command: server.command,
            args: server.args,
            metadata: server.metadata || {}
        });
    }
    /**
     * Get server list
     * Implementation of MCPInterface.getServerList
     * @param {any} filters - Optional filters
     * @returns {any[]} List of servers
     */
    getServerList(filters = {}) {
        return this.listMCPServers(filters);
    }
    /**
     * Get tool list for a server
     * Implementation of MCPInterface.getToolList
     * @param {string} serverId - Server ID
     * @returns {any[]} List of tools
     */
    getToolList(serverId) {
        // This is a synchronous method in the interface but our implementation is async
        // We need to return a placeholder and manage expectations in implementations
        return [];
    }
    /**
     * Execute a tool on a server
     * Implementation of MCPInterface.executeServerTool
     * @param {string} serverId - Server ID
     * @param {string} toolName - Tool name
     * @param {any} args - Tool arguments
     * @returns {Promise<any>} Tool result
     */
    async executeServerTool(serverId, toolName, args) {
        return this.executeMCPTool(serverId, toolName, args);
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
    /**
     * Get a server by ID
     * @param {string} serverId - ID of the server
     * @returns {MCPServer|undefined} Server if found, undefined otherwise
     */
    getServerById(serverId) {
        return this.mcpManager.getServerById(serverId);
    }
}
exports.MCPAdapter = MCPAdapter;
