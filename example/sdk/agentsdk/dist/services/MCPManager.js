"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPManager = void 0;
const uuid_1 = require("uuid");
class MCPManager {
    constructor(webSocketManager, logger = console) {
        this.webSocketManager = webSocketManager;
        this.logger = logger;
    }
    /**
     * Request MCP service (deprecated)
     * @param params Service parameters
     * @param timeout Request timeout
     * @deprecated Use getMCPServers, getMCPTools, and executeMCPTool instead
     */
    async requestMCPService(params = {}, timeout = 30000) {
        this.logger.warn('requestMCPService is deprecated. Use getMCPServers, getMCPTools, and executeMCPTool instead.');
        const response = await this.webSocketManager.sendAndWaitForResponse({
            id: (0, uuid_1.v4)(),
            type: 'mcp.request',
            content: params
        }, timeout);
        if (response.content.error) {
            throw new Error(response.content.error);
        }
        return response.content.result;
    }
    /**
     * Get list of MCP servers
     * @param filters Filter criteria
     * @param timeout Request timeout
     */
    async getMCPServers(filters = {}, timeout = 30000) {
        const response = await this.webSocketManager.sendAndWaitForResponse({
            id: (0, uuid_1.v4)(),
            type: 'mcp.servers.request',
            content: { filters }
        }, timeout);
        if (response.content.error) {
            throw new Error(response.content.error);
        }
        return response.content.servers || [];
    }
    /**
     * Get list of tools for an MCP server
     * @param serverId Server ID
     * @param timeout Request timeout
     */
    async getMCPTools(serverId, timeout = 30000) {
        const response = await this.webSocketManager.sendAndWaitForResponse({
            id: (0, uuid_1.v4)(),
            type: 'mcp.tools.request',
            content: { serverId }
        }, timeout);
        if (response.content.error) {
            throw new Error(response.content.error);
        }
        return response.content.tools || [];
    }
    /**
     * Execute an MCP tool
     * @param serverId Server ID
     * @param toolName Tool name
     * @param parameters Tool parameters
     * @param timeout Request timeout
     */
    async executeMCPTool(serverId, toolName, parameters = {}, timeout = 60000) {
        const response = await this.webSocketManager.sendAndWaitForResponse({
            id: (0, uuid_1.v4)(),
            type: 'mcp.tool.execute',
            content: {
                serverId,
                tool: toolName,
                parameters
            }
        }, timeout);
        if (response.content.error) {
            throw new Error(response.content.error);
        }
        return response.content.result;
    }
    /**
     * Execute a tool by name (will find server automatically)
     * @param toolName Tool name
     * @param parameters Tool parameters
     * @param serverId Optional server ID (if known)
     * @param timeout Request timeout
     */
    async executeTool(toolName, parameters = {}, serverId = null, timeout = 60000) {
        // If server ID is provided, execute directly
        if (serverId) {
            return this.executeMCPTool(serverId, toolName, parameters, timeout);
        }
        // Otherwise, find a server that provides this tool
        const servers = await this.getMCPServers();
        for (const server of servers) {
            try {
                const tools = await this.getMCPTools(server.id);
                const hasTool = tools.some((tool) => tool.name === toolName);
                if (hasTool) {
                    return this.executeMCPTool(server.id, toolName, parameters, timeout);
                }
            }
            catch (err) {
                this.logger.warn(`Failed to check tools for server ${server.id}: ${err.message}`);
            }
        }
        throw new Error(`No MCP server found that provides tool: ${toolName}`);
    }
}
exports.MCPManager = MCPManager;
