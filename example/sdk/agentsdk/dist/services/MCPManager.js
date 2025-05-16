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
}
exports.MCPManager = MCPManager;
